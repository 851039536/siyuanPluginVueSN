// 提交历史 DAG 重建器：预计算重建计划（拓扑序遍历 + 侧链 identity 跳过 + drop 别名重定向），
// 委托 FastImportRewriter 以 git fast-import 单进程流式重建（完整 tree 模型，不碰工作区），
// 最后以 CAS（旧值校验）更新分支引用。全程不触碰工作区与暂存区。
import type { GitExecutor } from "./GitExecutor"
import type { RewriteEntry, RewritePlan } from "./historyRewritePlan"
import { FastImportRewriter } from "./FastImportRewriter"

/** 日志记录（FMT 字段切分产物） */
interface CommitRecord {
  hash: string
  tree: string
  parents: string[]
  an: string
  ae: string
  aI: string
  /** 作者 Unix epoch（%at，fast-import raw 时间格式用） */
  at: number
  cn: string
  ce: string
  cI: string
  /** 提交者 Unix epoch（%ct） */
  ct: number
  message: string
}

/** 目标处理策略：改消息重建（rewrite）/ 跳过删除（drop：目标 hash 别名到其父，后代父指针重定向） */
type TargetAction = { kind: "rewrite", message: string } | { kind: "drop" }

/** 重建配置（目标处理策略 + 进度/日期行为） */
interface RebuildOptions {
  action: TargetAction
  /** 保留提交者三件套原始时间；false = 提交者时间刷新为当前时间（作者三件套恒保留） */
  preserveDate: boolean
  onProgress?: (current: number, total: number) => void
}

export class HistoryRewriter {
  private executor: GitExecutor
  private fastImportRewriter: FastImportRewriter

  constructor(executor: GitExecutor) {
    this.executor = executor
    this.fastImportRewriter = new FastImportRewriter(executor)
  }

  // 字段：hash/tree/parents/作者三件套+epoch/提交者三件套+epoch/完整消息；\x1e 分记录
  private static readonly FMT = "%H%x00%T%x00%P%x00%an%x00%ae%x00%aI%x00%at%x00%cn%x00%ce%x00%cI%x00%ct%x00%B%x1e"

  /**
   * 按 \x1e 单字符分割：execGit 会剥离输出末尾换行，若按 "\x1e\n" 复合分割，
   * 最后一条记录的分隔符会残缺导致 \x1e 字节泄漏进消息字段
   */
  private parseLog(raw: string): CommitRecord[] {
    return raw.split("\x1e")
      .map((r, i) => (i > 0 && r.startsWith("\n") ? r.slice(1) : r))
      .filter((r) => r.trim() !== "")
      .map((record) => {
        const f = record.split("\x00")
        return {
          hash: f[0],
          tree: f[1],
          parents: f[2] ? f[2].split(" ").filter(Boolean) : [],
          an: f[3],
          ae: f[4],
          aI: f[5],
          at: Number.parseInt(f[6] || "0", 10) || 0,
          cn: f[7],
          ce: f[8],
          cI: f[9],
          ct: Number.parseInt(f[10] || "0", 10) || 0,
          message: f[11] ?? "",
        }
      })
  }

  /** 重写目标提交信息（目标以新消息重建，树与父子结构原样保留） */
  async rewriteMessage(
    projectPath: string,
    fullHash: string,
    headHash: string,
    message: string,
    preserveDate: boolean,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    return this.rebuildDag(projectPath, fullHash, headHash, {
      action: { kind: "rewrite", message },
      preserveDate,
      onProgress,
    })
  }

  /**
   * 删除目标提交（记录级删除、内容不变语义）：
   * 目标不重建，其 hash 直接映射到父提交——后代以原树重建、父指针重指向目标的父，
   * 目标的变更被下一提交"吸收"，最终 HEAD 的 tree 与删除前完全一致。
   * 调用方须保证目标非 HEAD、非 merge（单父）且为 HEAD 祖先。
   */
  async drop(
    projectPath: string,
    fullHash: string,
    headHash: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    return this.rebuildDag(projectPath, fullHash, headHash, {
      action: { kind: "drop" },
      preserveDate: true,
      onProgress,
    })
  }

  /**
   * DAG 重建骨架：解析 → 预计算重建计划（纯逻辑）→ fast-import 流式导入临时 ref →
   * CAS 更新原分支引用。与旧 commit-tree 逐条方案相比，1000+ 条重建从 N 次进程收敛为
   * cat-file --batch + fast-import 两次长驻进程，性能提升 1~2 个数量级。
   */
  private async rebuildDag(
    projectPath: string,
    fullHash: string,
    headHash: string,
    opts: RebuildOptions,
  ): Promise<string> {
    const [tgtRaw, restRaw] = await Promise.all([
      this.executor.execGit(projectPath, ["log", "-1", `--format=${HistoryRewriter.FMT}`, fullHash]),
      // topological + reverse = 父先子后；范围含并入的侧链提交（不依赖目标者保持原 hash）
      this.executor.execGit(projectPath, ["log", "--topo-order", "--reverse", `--format=${HistoryRewriter.FMT}`, `${fullHash}..HEAD`]),
    ])
    const target = this.parseLog(tgtRaw)[0]
    if (!target) throw new Error("找不到指定提交")
    const rest = this.parseLog(restRaw)

    const branch = (await this.executor.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])).trim()

    // 预计算重建计划（纯逻辑，不执行 git）：拓扑序构造条目，父指针未变化的侧链保持原 hash 不入列
    const plan = this.buildPlan(target, rest, opts, branch)

    // 祖先守卫：目标必须是 HEAD 祖先（HEAD 必然落入重建集）。
    // 不满足时（目标来自其他分支/校验后用户切换了分支等竞态），newTip 会指向与当前分支
    // 无关的提交链，CAS 校验却仍能通过——分支引用将被错误移动到无关历史，必须显式拦截。
    // 同时兜底空重建集（drop 异常路径等）：零条目导入无意义，直接报错优于静默无操作。
    if (!plan.markedHashes.has(headHash)) {
      throw new Error("该提交不在当前分支的历史上（可能在其他分支），无法从当前分支重写")
    }

    // 流式重建（fast-import 导入临时 ref；失败时临时 ref 已清理、原分支引用未动，仓库保持原状）
    const newTip = await this.fastImportRewriter.rewrite(projectPath, plan, opts.onProgress)

    // CAS 更新引用：当前值与开始时不一致（期间有其他改动）则失败，避免覆盖
    if (branch === "HEAD") {
      await this.executor.execGit(projectPath, ["update-ref", "--no-deref", "HEAD", newTip, headHash])
    } else {
      await this.executor.execGit(projectPath, ["update-ref", `refs/heads/${branch}`, newTip, headHash])
    }
    return newTip
  }

  /**
   * 预计算重建计划：应用目标策略（rewrite 入列重建 / drop 记别名），再拓扑序遍历后代，
   * 任一父被重写或别名重定向的提交入列重建，无关侧链跳过（保持原 hash，等价旧 identity 逻辑）。
   * 每条的父引用在预计算时即解析为最终形态（mark 或原 hash），执行层无需再做映射。
   */
  private buildPlan(target: CommitRecord, rest: CommitRecord[], opts: RebuildOptions, branch: string): RewritePlan {
    /** drop 别名：目标 hash → 其父（后代父指针经此重定向；rewrite 无别名） */
    const aliases = new Map<string, string>()
    if (opts.action.kind === "drop") {
      if (!target.parents[0]) throw new Error("该提交无父提交，无法执行删除")
      aliases.set(target.hash, target.parents[0])
    }

    /** mark 分配：重建条目 hash → mark 序号（后代父引用解析依据） */
    const markOf = new Map<string, number>()
    let markSeq = 0

    /** 父引用解析：先消化别名链，再映射到 mark（已重建）或原 hash（identity 侧链/未涉及提交） */
    const resolveParent = (p: string): string => {
      let cur = p
      while (aliases.has(cur)) {
        cur = aliases.get(cur)!
      }
      const mark = markOf.get(cur)
      return mark !== undefined ? `:${mark}` : cur
    }

    const entries: RewriteEntry[] = []
    const entryOf = (rec: CommitRecord, message: string, mark: number): RewriteEntry => ({
      mark,
      tree: rec.tree,
      an: rec.an,
      ae: rec.ae,
      aI: rec.aI,
      at: rec.at,
      cn: rec.cn,
      ce: rec.ce,
      cI: rec.cI,
      ct: rec.ct,
      message: message.endsWith("\n") ? message : `${message}\n`,
      parents: rec.parents.map(resolveParent),
    })

    // 1. 目标处理：rewrite 以新消息入列重建；drop 记别名（目标不重建，不占 mark）
    if (opts.action.kind === "rewrite") {
      const mark = ++markSeq
      markOf.set(target.hash, mark)
      entries.push(entryOf(target, opts.action.message, mark))
    }

    // 2. 拓扑序遍历后代：任一父被重写/别名重定向的才重建，侧链等无关提交保持原 hash
    for (const rec of rest) {
      if (!rec.parents.some((p) => resolveParent(p) !== p)) continue
      const mark = ++markSeq
      markOf.set(rec.hash, mark)
      entries.push(entryOf(rec, rec.message, mark))
    }

    return {
      tempRef: `refs/gprw/${branch}`,
      entries,
      preserveDate: opts.preserveDate,
      /** 全部被重写提交的原始 hash 集合（含目标；调用方据 HEAD 是否在内做祖先守卫） */
      markedHashes: new Set(markOf.keys()),
    }
  }
}
