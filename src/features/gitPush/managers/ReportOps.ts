// gitPush 报告数据操作：numstat 提交日志 + 首提交日期 + 已跟踪文件 + 文件历史补丁（代码统计报告 / 行数统计共用）
import type { GitExecutor } from "./GitExecutor"
import type { IndexedFileLines } from "../types/indexCache"
import { parseNumstatBlock, parseNumstatBlocks, type NumstatCommit } from "../reportMetrics"
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

  /** 抓取 HEAD 快照：HEAD oid + git dir（仓库身份）+ 末条提交作者/时间（索引短路判据） */
  async getHeadSnapshot(projectPath: string): Promise<HeadSnapshot> {
    const empty: HeadSnapshot = { head: "", gitDir: "", lastAuthor: "", lastDate: "" }
    const [head, gitDir] = await Promise.all([
      this.executor.execGit(projectPath, ["rev-parse", "HEAD"]).catch(() => ""),
      this.executor.execGit(projectPath, ["rev-parse", "--absolute-git-dir"]).catch(() => ""),
    ])
    if (!head.trim()) return { ...empty, gitDir: gitDir.trim() }
    // 末条提交判据：与索引末条（hash/author/date）比较，用于「切回已索引分支」的复用捷径
    const raw = await this.executor.execGit(projectPath, [
      "-c", "core.quotepath=false", "log", "-n", "1", "--pretty=format:%h%x1f%an%x1f%aI",
    ]).catch(() => "")
    const parts = raw.split("\x1f")
    return {
      head: head.trim(),
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
