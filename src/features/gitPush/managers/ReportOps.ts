// gitPush 报告数据操作：git log --numstat 一次取回提交 + 每文件增删行（供代码统计报告聚合）
import type { GitExecutor } from "./GitExecutor"
import { parseNumstatBlocks, type NumstatCommit } from "../reportMetrics"

export class ReportOps {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
  }

  /**
   * 获取 numstat 提交日志（每条提交：作者 + ISO 日期 + 每文件增删行）。
   * since 为空时统计全部历史。git 失败/路径无效时抛出错误，
   * 由调用方区分「仓库无提交」（合法空数据）与「命令失败」（无效路径/非仓库）。
   */
  async getNumstatLog(projectPath: string, since?: string): Promise<NumstatCommit[]> {
    const args = [
      "-c", "core.quotepath=false",
      "log", "--numstat", "--no-renames",
      "--pretty=format:%x1e%an%x1f%aI",
    ]
    if (since) args.push(`--since=${since}`)
    // 大仓库历史可能超过默认 30s，放宽到 60s
    const raw = await this.executor.execGit(projectPath, args, undefined, 60000)
    if (!raw) return []
    return parseNumstatBlocks(raw)
  }

  /** 获取仓库首个提交日期（ISO，无提交/失败返回空串；"全部历史"范围用它生成时间范围标签） */
  async getFirstCommitDate(projectPath: string): Promise<string> {
    try {
      return await this.executor.execGit(projectPath, ["log", "--reverse", "--format=%aI", "-1"])
    } catch {
      return ""
    }
  }
}
