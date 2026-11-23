// 一键提交的生成方式选择：按暂存区规模决定用简单生成（单行）还是深度生成（标题 + 要点）。
//
// 深度生成会读完整 diff 并输出多行要点，耗时与 token 消耗都更高；
// 小改动（单文件小修改）用简单生成即可，避免每次提交都付深度生成的成本。
// 阈值是可调经验值：文件数体现「改动维度」，增删行体现「单文件工作量」。
import type { NumstatEntry } from "./gitOutput"

/** 达到该文件数改用深度生成 */
export const DEEP_COMMIT_FILE_THRESHOLD = 5
/** 增删行合计达到该值改用深度生成（二进制文件按 0 行计） */
export const DEEP_COMMIT_LINE_THRESHOLD = 200

export interface CommitSizeSummary {
  /** 变更文件数（含二进制） */
  fileCount: number
  /** 增删行合计（二进制不计行数） */
  changedLines: number
}

/** 汇总 numstat 变更集规模；overview 为空（无变更或 numstat 失败）时返回 0 */
export function summarizeCommitSize(overview: Record<string, NumstatEntry>): CommitSizeSummary {
  const entries = Object.values(overview)
  return {
    fileCount: entries.length,
    changedLines: entries.reduce((sum, e) => sum + (e.binary ? 0 : e.add + e.del), 0),
  }
}

/** 文件数或增删行任一达到阈值即用深度生成 */
export function shouldUseDeepCommitMessage(size: CommitSizeSummary): boolean {
  return size.fileCount >= DEEP_COMMIT_FILE_THRESHOLD || size.changedLines >= DEEP_COMMIT_LINE_THRESHOLD
}
