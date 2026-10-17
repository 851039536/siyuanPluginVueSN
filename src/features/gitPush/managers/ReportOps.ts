// gitPush 报告数据操作：numstat 提交日志 + 首提交日期 + 已跟踪文件 + 文件历史补丁（代码统计报告 / 行数统计共用）
import type { GitExecutor } from "./GitExecutor"
import type { IndexedFileLines } from "../types/indexCache"
import { parseNumstatBlock, parseNumstatBlocks, type NumstatCommit } from "../reportMetrics"
import { classifyFetchFailure, fetchFailureReason, ProjectFetchError } from "../utils/errors"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** diff 补丁截断上限（约 5KB 文本，防止巨型文件撑爆弹窗） */
const DIFF_MAX_CHARS = 5000

/** 单文件可读上限（2MB：压缩包/锁文件/二进制不读全文，与 reportMetrics.countFileLines 同口径） */
const FILE_LINES_MAX_BYTES = 2 * 1024 * 1024

/** 增量扫描单次回传提交上限（首次导入超大仓库时防止把 10MB maxBuffer 撑爆） */
const INCREMENTAL_MAX_COMMITS = 20000

/** 增量扫描结果 */
export interface IncrementalScan {
  /** 扫描到的提交（按时间升序；knownHashes 非空时仅含未索引的新提交） */
  commits: NumstatCommit[]
  /** 是否已扫到历史根（false = 达到 INCREMENTAL_MAX_COMMITS 上限，本次未覆盖全历史） */
  complete: boolean
}

/** HEAD 快照（仓库身份与末条提交判据，供本地索引短路比较） */
export interface HeadSnapshot {
  /** HEAD 完整 oid（rev-parse HEAD；空仓库/无提交为空串） */
  head: string
  /** git dir 绝对路径（与 head 一起构成仓库身份，避免不同仓库同 oid 误判命中） */
  gitDir: string
  /** 末条提交的作者（无提交为空串） */
  lastAuthor: string
  /** 末条提交的 ISO 时间（无提交为空串） */
  lastDate: string
}

/**
 * 仓库生命周期快照（行数统计专用，比 HeadSnapshot 少一次 git 调用）。
 *
 * 与 HeadSnapshot 的差异：**不含 gitDir**。gitDir 需要额外一次
 * `rev-parse --absolute-git-dir`，而就本视图的失效判据而言，
 * `project.id + HEAD oid` 已足够识别；省掉这一次进程启动对几十个项目的
 * 分析耗时是决定性收益（见 getRepoLifecycle 的说明）。
 */
export interface RepoLifecycle {
  /** HEAD 完整 oid（空字符串 = 空仓库） */
  head: string
  /** HEAD 提交的 ISO 时间（"最后修改"口径；无提交为空串） */
  lastDate: string
  /** 根提交的 ISO 时间（"新建日期"口径；无提交为空串） */
  rootDate: string
}

export class ReportOps {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
  }

  /**
   * 增量抓取提交（本地索引的抓取入口）。
   *
   * 与 getCommitStatsLog 的区别：**不带 --since**，改为「扫到已索引提交即停」。
   * 原因：--since 会把边界内已索引的提交重复输出（增量去重依赖 hash 集合，重复无害但浪费），
   * 且历史重写（amend/rebase）后的旧提交保持原始日期、可能落在 --since 之外而被漏掉。
   * 全量取回后在内存索引上按时间范围过滤，语义与 git log --since 等价，且范围切换零 git 调用。
   *
   * @param knownHashes 已索引提交的短 hash 查询表；null = 未命中索引（本次输出全部扫描结果）
   * @returns 提交列表 + 是否扫到历史根
   */
  async fetchIncremental(
    projectPath: string,
    knownHashes: { has(hash: string): boolean } | null,
  ): Promise<IncrementalScan> {
    const args = [
      "-c", "core.quotepath=false",
      "log", "--numstat", "--no-renames",
      "--pretty=format:%x1e%h%x1f%an%x1f%aI%x1f%s",
      `-${INCREMENTAL_MAX_COMMITS}`,
    ]
    // 大仓库历史可能超过默认 30s，放宽到 60s（与 getNumstatLog/getCommitStatsLog 一致）
    const raw = await this.executor.execGit(projectPath, args, undefined, 60000)
    if (!raw) return { commits: [], complete: true }
    const chunks = raw.split("\x1e")
    // chunks[0] 是首个分隔符之前的空串
    const total = chunks.length - 1
    const commits: NumstatCommit[] = []
    for (let i = 1; i < chunks.length; i++) {
      const parsed = parseNumstatBlock(chunks[i])
      if (!parsed) continue
      // 命中已索引提交即停：其后的提交必然更旧且都已索引。
      // 注意必须先收完该块的文件行再停（文件行在 header 之后，见 parseNumstatBlock 结构说明）
      if (knownHashes && parsed.hash && knownHashes.has(parsed.hash)) break
      commits.push(parsed)
    }
    // 未达上限即说明扫到了历史根（受 -N 截断时 total 恒等于上限，视为不完整）
    const complete = total < INCREMENTAL_MAX_COMMITS
    // git log 输出为「新 → 旧」，索引按时间升序追加
    commits.reverse()
    return { commits, complete }
  }

  /** 抓取 HEAD 快照：HEAD oid + git dir（仓库身份）+ 末条提交作者/时间（索引短路判据）。
   *
   *  性能：原先串行三步（`rev-parse HEAD` 与 `--absolute-git-dir` 并行 → await → `log -n 1`），
   *  串行段使每次索引短路比较都要多等一个 git 进程。改为两步并发：
   *  ① `log -n 1 --pretty=%H%x1f%an%x1f%aI` 一次拿到 oid + 作者 + 时间（取代 rev-parse HEAD 与后续 log）
   *  ② `rev-parse --absolute-git-dir` 与①并发（空仓库时①失败，②仍能给出 gitDir 身份）
   *  空仓库（①失败）时 head/lastAuthor/lastDate 均为空串，行为与原先一致。 */
  async getHeadSnapshot(projectPath: string): Promise<HeadSnapshot> {
    const empty: HeadSnapshot = { head: "", gitDir: "", lastAuthor: "", lastDate: "" }
    const [logRaw, gitDir] = await Promise.all([
      this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "log", "-n", "1", "--pretty=format:%H%x1f%an%x1f%aI",
      ]).catch(() => ""),
      this.executor.execGit(projectPath, ["rev-parse", "--absolute-git-dir"]).catch(() => ""),
    ])
    const parts = logRaw.split("\x1f")
    const head = (parts[0] || "").trim()
    if (!head) return { ...empty, gitDir: gitDir.trim() }
    return {
      head,
      gitDir: gitDir.trim(),
      lastAuthor: (parts[1] || "").trim(),
      lastDate: (parts[2] || "").trim(),
    }
  }

  /**
   * 统计已跟踪文件的存量行数与路径清单（供索引缓存；HEAD 未变时完全复用，不再读盘）。
   * 只列已跟踪文件（自动排除未跟踪与被 .gitignore 忽略的文件，如 node_modules）。
   * 复用 countFileLines 口径：>2MB / 二进制 / 读失败 / 已删除 → null。
   */
  async getTrackedFileLines(projectPath: string, rootHash: string): Promise<IndexedFileLines[]> {
    const files = await this.getTrackedFiles(projectPath)
    const modules = getNodeFsPathOs()
    const { fs, path } = modules || {}
    const rows: IndexedFileLines[] = []
    for (const file of files) {
      rows.push({ r: rootHash, f: file, n: readFileLineCount(fs, path, projectPath, file) })
    }
    return rows
  }

  /**
   * 获取 numstat 提交日志（每条提交：作者 + ISO 日期 + 每文件增删行）。
   * since 为空时统计全部历史；maxCount 传入时仅取最近 N 条提交（与 git log -N 等价）。
   * git 失败/路径无效时抛出错误，
   * 由调用方区分「仓库无提交」（合法空数据）与「命令失败」（无效路径/非仓库）。
   */
  async getNumstatLog(projectPath: string, since?: string, maxCount?: number): Promise<NumstatCommit[]> {
    const args = [
      "-c", "core.quotepath=false",
      "log", "--numstat", "--no-renames",
      "--pretty=format:%x1e%an%x1f%aI",
    ]
    if (maxCount && maxCount > 0) args.push(`-${maxCount}`)
    if (since) args.push(`--since=${since}`)
    // 大仓库历史可能超过默认 30s，放宽到 60s
    const raw = await this.executor.execGit(projectPath, args, undefined, 60000)
    if (!raw) return []
    return parseNumstatBlocks(raw)
  }

  /**
   * 获取带提交摘要的 numstat 日志（行数统计专用，一条命令同时满足提交条目 + 行数排行）。
   * format 在 getNumstatLog 基础上追加 %h（短 hash）与 %s（主题），
   * parseNumstatBlocks 按 header 段数自适应解析，不影响报告视图的旧格式链路。
   * maxCount 仅取最近 N 条提交；git 失败/路径无效时抛出错误。
   */
  async getCommitStatsLog(projectPath: string, maxCount?: number): Promise<NumstatCommit[]> {
    const args = [
      "-c", "core.quotepath=false",
      "log", "--numstat", "--no-renames",
      "--pretty=format:%x1e%h%x1f%an%x1f%aI%x1f%s",
    ]
    if (maxCount && maxCount > 0) args.push(`-${maxCount}`)
    // 与 getNumstatLog 一致的 60s 超时（大仓库历史可能超过默认 30s）
    const raw = await this.executor.execGit(projectPath, args, undefined, 60000)
    if (!raw) return []
    return parseNumstatBlocks(raw)
  }

  /**
   * 获取仓库已跟踪文件列表（git ls-files，-c core.quotepath=false 避免中文/特殊字符路径被引号转义）。
   * 只列已跟踪文件，自动排除未跟踪与被 .gitignore 忽略的文件（如 node_modules）。
   * git 失败/路径无效时抛出错误；空仓库返回空数组。
   */
  async getTrackedFiles(projectPath: string): Promise<string[]> {
    const raw = await this.executor.execGit(projectPath, ["-c", "core.quotepath=false", "ls-files"])
    if (!raw) return []
    return raw.split("\n").filter((line) => line.trim().length > 0)
  }

  /** 获取仓库首个提交日期（ISO，无提交/失败返回空串；"全部历史"范围用它生成时间范围标签） */
  async getFirstCommitDate(projectPath: string): Promise<string> {
    try {
      return await this.executor.execGit(projectPath, ["log", "--reverse", "--format=%aI", "-1"])
    } catch {
      return ""
    }
  }

  /**
   * 获取「自上次索引以来内容有变化的已跟踪文件」路径集合（`git status --porcelain -uno`）。
   *
   * 用途：超大仓库的行数增量扫描。逐文件 `statSync` 的边际成本约 93µs/文件
   * （2 万文件 ≈ 2 秒），而 `git status` 一次扫描只要约 220ms —— 它内部用 index 的
   * stat 缓存做批量比对，比我们逐个 stat 高效得多。
   *
   * **不适用于中小仓库**：git status 的固定成本是一次进程启动（≈200ms），
   * 文件数低于约 2400 时反而比逐文件 statSync 慢。调用方按仓库文件数自适应选择
   * （见 GitPushManager.scanProjectLineStats）。
   *
   * `-uno` 排除未跟踪文件：行数统计只算已跟踪文件，未跟踪的不该影响结果。
   *
   * **必须用 `-z`（NUL 分隔）**：默认的换行分隔输出会对含特殊字符的路径做 C 风格
   * 引号转义（空格两侧加引号、`\\`/`"`/换行转义），且换行会让一条记录拆成多行。
   * 一旦解析结果与 `git ls-files` 的路径**不能逐字符对上**，该文件就会被当作
   * 「未变更」而永久沿用旧的行数缓存 —— 这是静默的数据错误，故 `-z` 不是可选项。
   * `-z` 模式无引号无转义，路径原样输出，故**不做 trim**（路径可以合法地以空格结尾）。
   *
   * 传 `--no-renames` 让重命名退化为「删除旧路径 + 新增新路径」两条普通记录，
   * 从而无需解析 `old -> new` 箭头语法。
   *
   * @returns 变更文件路径集合（相对仓库根，与 ls-files 同口径）；git 失败返回 null
   *   （调用方据此回退逐文件 statSync，不影响正确性）
   */
  async getChangedTrackedFiles(projectPath: string): Promise<Set<string> | null> {
    let raw: string
    try {
      raw = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false",
        "status", "--porcelain=v1", "-z", "-uno", "--no-renames",
      ], undefined, 60000)
    } catch {
      // 非仓库/权限问题：让调用方走保守路径（逐文件 stat），结果仍然正确
      return null
    }
    const out = new Set<string>()
    // -z 模式：每条记录以 NUL 结尾，格式 "XY<space>path"
    for (const entry of raw.split("\0")) {
      if (entry.length < 4) continue
      // 跳过 "XY " 三字符前缀；不 trim —— 保留路径原始形态才能与 ls-files 精确匹配
      const p = entry.slice(3)
      if (p) out.add(p)
    }
    return out
  }

  /**
   * 一次拿齐行数统计所需的「仓库生命周期」快照（HEAD + 末次提交时间 + 根提交时间）。
   *
   * 为什么合并调用：本机实测单次 git 调用约 300–500ms，且**几乎全是 Windows
   * 进程创建开销**，与原命令的数据量无关。原实现每项目跑 3 次
   * （`log -n1` + `rev-parse --absolute-git-dir` + `log --reverse -1`），
   * 几十个项目时仅进程启动费就是几十秒——这是「行数分析特别久」的主因。
   *
   * 现为 **2 次调用**（并发发起）：
   * 1. `log -n 1 --pretty=format:%H%x1f%aI` → HEAD oid + 末次提交时间
   * 2. `rev-list --max-parents=0 --format=%H%x1f%aI HEAD` → 根提交时间
   *
   * 仓库身份不再由 `rev-parse --absolute-git-dir` 提供：改由纯 fs 探测的
   * `resolveRepoIdentity()` 给出（见 lineScan.ts），零 git 调用。
   *
   * **错误语义（关键）**：本方法**只把「空仓库」当作正常空结果**，
   * 其余任何 git 故障（非仓库、超时、index.lock、git 不可用、权限）都**抛出**，
   * 由调用方计入失败项目。
   * 为什么必须区分：早期实现用 `.catch(() => "")` 把两类都压成空快照，
   * 下游据此返回「0 行 0 文件」并计为成功 —— 一次瞬时 git 故障会被
   * 静默展示成「这个项目没有代码」，既不报错也无从排查。
   *
   * 区分方式**零额外调用**：`GitExecutor` 已把 stderr 拼进错误 message，
   * 复用既有的 `classifyFetchFailure` 判定 `noCommits` 即可。
   */
  async getRepoLifecycle(projectPath: string): Promise<RepoLifecycle> {
    // 两次调用并发发起（互不依赖），任一失败都进入下方统一判定
    const [headResult, rootResult] = await Promise.allSettled([
      this.executor.execGit(projectPath, ["log", "-n", "1", "--pretty=format:%H%x1f%aI"]),
      this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false",
        "rev-list", "--max-parents=0", "--format=%H%x1f%aI", "HEAD",
      ]),
    ])

    // HEAD 取不到：要么空仓库（正常），要么真实故障（必须抛出）
    if (headResult.status === "rejected") {
      const reason = headResult.reason
      if (classifyFetchFailure(reason) === "noCommits") {
        // 空仓库：无提交、无文件，属合法的空数据
        return {
          head: "",
          lastDate: "",
          rootDate: "",
        }
      }
      throw reason
    }

    const headParts = headResult.value.trim().split("\x1f")
    const head = (headParts[0] || "").trim()
    // 命令成功却无输出：极端异常，按故障处理而非谎报 0 行
    if (!head) {
      throw new ProjectFetchError("other", `git log 未返回 HEAD（${projectPath}）`)
    }
    const lastDate = (headParts[1] || "").trim()

    // 根提交时间：失败不致命（HEAD 已拿到，行数仍可统计），
    // 但需区分「无提交」与「真实故障」—— 后者记 warn 便于排查
    let rootDate = ""
    if (rootResult.status === "fulfilled") {
      for (const line of rootResult.value.split("\n")) {
        if (!line.includes("\x1f")) continue
        const date = line.split("\x1f")[1]
        if (date) {
          rootDate = date.trim()
          break
        }
      }
    } else if (classifyFetchFailure(rootResult.reason) !== "noCommits") {
      console.warn(
        `[gitPush] 读取根提交时间失败（${projectPath}）:`
        + fetchFailureReason(rootResult.reason),
      )
    }

    return {
      head,
      lastDate,
      rootDate,
    }
  }

  /**
   * 获取文件最近 5 条提交的补丁内容（git log -p，供文件详情弹窗打开时按需懒取）。
   * since 非空时限定在所选统计范围内，保证 diff 与报告时间口径一致；
   * 超长截断防撑爆弹窗；git 失败/路径无效时抛出错误，由调用方兜底隐藏区块。
   */
  async getFileHistoryPatch(projectPath: string, file: string, since?: string): Promise<string> {
    const args = ["-c", "core.quotepath=false", "log", "-p", "--max-count=5"]
    if (since) args.push(`--since=${since}`)
    args.push("--", file)
    const raw = await this.executor.execGit(projectPath, args, undefined, 10000)
    if (!raw) return ""
    return raw.length > DIFF_MAX_CHARS ? raw.slice(0, DIFF_MAX_CHARS) + "\n…(truncated)" : raw
  }
}

/**
 * 读取仓库内文件的行数（按行切分计数）。
 * 与 reportMetrics.countFileLines 保持同口径（>2MB / 非文件 / 读失败 → null），
 * 差异仅在于此处由调用方传入已解析的 fs/path，避免逐文件重复取模块。
 */
function readFileLineCount(
  fs: typeof import("node:fs") | undefined,
  path: typeof import("node:path") | undefined,
  projectPath: string,
  filePath: string,
): number | null {
  if (!fs || !path) return null
  try {
    const abs = path.join(projectPath, filePath)
    const stat = fs.statSync(abs)
    if (!stat.isFile() || stat.size > FILE_LINES_MAX_BYTES) return null
    const content = fs.readFileSync(abs, "utf8") as string
    const lines = content.split("\n")
    return lines.length - (lines[lines.length - 1] === "" ? 1 : 0)
  } catch {
    return null
  }
}
