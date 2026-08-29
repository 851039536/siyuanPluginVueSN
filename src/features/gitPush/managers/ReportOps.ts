// gitPush 报告数据操作：numstat 提交日志 + 首提交日期 + 已跟踪文件 + 文件历史补丁（代码统计报告 / 行数统计共用）
import type { GitExecutor } from "./GitExecutor"
import { parseNumstatBlocks, type NumstatCommit } from "../reportMetrics"

/** diff 补丁截断上限（约 5KB 文本，防止巨型文件撑爆弹窗） */
const DIFF_MAX_CHARS = 5000

export class ReportOps {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
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
