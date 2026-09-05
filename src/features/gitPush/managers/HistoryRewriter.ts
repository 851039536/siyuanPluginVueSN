// 提交历史 DAG 重建器：commit-tree 图重建核心（消息改写 / 提交删除双策略共享骨架）。
// 按拓扑序（父先子后）遍历目标提交到 HEAD，依赖目标的后代逐条用 commit-tree 以
// 原树/原父子结构重建（仅消息或父指针变化），侧链等无关提交保持原 hash；
// 最后以 CAS（旧值校验）更新分支引用。全程不触碰工作区与暂存区。
import type { GitExecutor } from "./GitExecutor"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 日志记录（FMT 字段切分产物） */
interface CommitRecord {
  hash: string
  tree: string
  parents: string[]
  an: string
  ae: string
  aI: string
  cn: string
  ce: string
  cI: string
  message: string
}

/** 目标提交处理策略上下文（onTarget 通过 rebuild 重建目标，或直接写 map 实现"跳过"） */
interface TargetContext {
  target: CommitRecord
  /** 以指定消息重建一条提交（保留原树/父映射/作者三件套），并写入 hash 映射 */
  rebuild: (rec: CommitRecord, msg: string) => Promise<void>
  /** 旧 hash → 新 hash 映射（策略可直接写入映射实现"跳过"） */
  map: Map<string, string>
}

/** 重建配置（目标处理策略 + 进度/日期行为） */
interface RebuildOptions {
  /** 目标提交处理策略（改消息重建 / 跳过删除） */
  onTarget: (ctx: TargetContext) => Promise<void>
  /** 目标自身是否计入进度分母（drop 不重建目标，不计入） */
  targetCountsInTotal: boolean
  /** 保留提交者三件套（姓名/邮箱/时间）；作者三件套恒保留 */
  preserveDate: boolean
  onProgress?: (current: number, total: number) => void
}

export class HistoryRewriter {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
  }

  // 字段：hash/tree/parents/作者三件套/提交者三件套/完整消息；\x1e 分记录
  private static readonly FMT = "%H%x00%T%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B%x1e"

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
          cn: f[6],
          ce: f[7],
          cI: f[8],
          message: f[9] ?? "",
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
      onTarget: async ({ target, rebuild }) => {
        await rebuild(target, message)
      },
      targetCountsInTotal: true,
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
      onTarget: async ({ target, map }) => {
        map.set(target.hash, target.parents[0])
      },
      targetCountsInTotal: false,
      preserveDate: true,
      onProgress,
    })
  }

  /** DAG 重建骨架（解析/拓扑遍历/侧链 identity/CAS 引用更新），目标处理由策略注入 */
  private async rebuildDag(
    projectPath: string,
    fullHash: string,
    headHash: string,
    opts: RebuildOptions,
  ): Promise<string> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { fs, os, path } = node

    const [tgtRaw, restRaw] = await Promise.all([
      this.executor.execGit(projectPath, ["log", "-1", `--format=${HistoryRewriter.FMT}`, fullHash]),
      // topological + reverse = 父先子后；范围含并入的侧链提交（不依赖目标者保持原 hash）
      this.executor.execGit(projectPath, ["log", "--topo-order", "--reverse", `--format=${HistoryRewriter.FMT}`, `${fullHash}..HEAD`]),
    ])
    const target = this.parseLog(tgtRaw)[0]
    if (!target) throw new Error("找不到指定提交")
    const rest = this.parseLog(restRaw)

    const branch = (await this.executor.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])).trim()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gprw-"))
    /** 旧 hash → 新 hash 映射（含 identity 映射） */
    const map = new Map<string, string>()

    /** 以原树/映射后的父指针重建一条提交；preserveDate=true 时精确保留作者与提交者三件套 */
    const rebuild = async (rec: CommitRecord, msg: string) => {
      const msgFile = path.join(dir, "msg.txt")
      fs.writeFileSync(msgFile, msg.endsWith("\n") ? msg : `${msg}\n`, "utf8")
      const env: Record<string, string> = {
        GIT_AUTHOR_NAME: rec.an,
        GIT_AUTHOR_EMAIL: rec.ae,
        GIT_AUTHOR_DATE: rec.aI,
      }
      if (opts.preserveDate) {
        env.GIT_COMMITTER_NAME = rec.cn
        env.GIT_COMMITTER_EMAIL = rec.ce
        env.GIT_COMMITTER_DATE = rec.cI
      }
      const parents = rec.parents.flatMap((p) => ["-p", map.get(p) ?? p])
      const newHash = (await this.executor.execGit(projectPath, ["commit-tree", rec.tree, ...parents, "-F", msgFile], undefined, 30000, undefined, { env })).trim()
      map.set(rec.hash, newHash)
    }

    try {
      // 预计算必要重建数（纯逻辑，不执行 git）：目标计入时 +1；后代中任一父已被重写的才重建，
      // 侧链等无关提交不计入 total，保证进度分母准确（与下方 identity 跳过分支等价判定）
      const replaced = new Set<string>([fullHash])
      let total = opts.targetCountsInTotal ? 1 : 0
      for (const rec of rest) {
        if (rec.parents.some((p) => replaced.has(p))) {
          replaced.add(rec.hash)
          total++
        }
      }
      let done = 0
      const progress = () => opts.onProgress?.(done, total)

      // 1. 目标处理（策略注入：改消息重建 / 跳过映射到父）
      await opts.onTarget({ target, rebuild, map })
      if (opts.targetCountsInTotal) {
        done++
        progress()
      }
      // 2. 按拓扑序重建依赖目标的后代；父指针未变化的（如并入侧链）保持原 hash
      for (const rec of rest) {
        const newParents = rec.parents.map((p) => map.get(p) ?? p)
        if (newParents.join(" ") === rec.parents.join(" ")) {
          map.set(rec.hash, rec.hash)
          continue
        }
        await rebuild(rec, rec.message)
        done++
        progress()
      }
      // 3. CAS 更新引用：当前值与开始时不一致（期间有其他改动）则失败，避免覆盖
      const newTip = map.get(headHash)
      if (!newTip) throw new Error("重写失败：无法定位新提交链顶端")
      if (branch === "HEAD") {
        await this.executor.execGit(projectPath, ["update-ref", "--no-deref", "HEAD", newTip, headHash])
      } else {
        await this.executor.execGit(projectPath, ["update-ref", `refs/heads/${branch}`, newTip, headHash])
      }
      return newTip
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* 忽略清理失败 */ }
    }
  }
}
