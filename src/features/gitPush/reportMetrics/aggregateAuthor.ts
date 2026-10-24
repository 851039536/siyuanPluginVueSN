// gitPush 报告指标引擎 — 作者聚合层：提交块 → 作者统计表（纯函数）
import type { AuthorReportRow } from "../types/report"
import type { NumstatCommit } from "./types"
import { parseIsoMs } from "./parseNumstat"

/** 作者聚合中间态 */
interface AuthorAgg {
  commits: number
  added: number
  deleted: number
  files: Set<string>
  /** 文件 → 修改次数（派生 Top 修改文件） */
  fileMods: Map<string, number>
  firstDate: number
  lastDate: number
  /** 最早提交 ISO（保留原始格式用于展示活跃时间范围） */
  firstIso: string
  /** 最近提交 ISO */
  lastIso: string
}

/** 按活跃天数（首个~末次提交跨度，最小 1） */
function activeDaysBetween(firstMs: number, lastMs: number): number {
  if (firstMs <= 0 || lastMs <= firstMs) return 1
  return Math.max(1, Math.round((lastMs - firstMs) / (24 * 60 * 60 * 1000)))
}

/** 保留两位小数 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 聚合作者统计（提交数/行数/活跃天数/文件数；返回数组按提交数降序） */
export function aggregateAuthorStats(commits: NumstatCommit[]): AuthorReportRow[] {
  const map = new Map<string, AuthorAgg>()
  for (const c of commits) {
    let a = map.get(c.author)
    if (!a) {
      a = {
        commits: 0, added: 0, deleted: 0, files: new Set(), fileMods: new Map(),
        firstDate: 0, lastDate: 0, firstIso: "", lastIso: "",
      }
      map.set(c.author, a)
    }
    a.commits++
    const ms = parseIsoMs(c.date)
    if (ms > 0) {
      if (a.firstDate === 0 || ms < a.firstDate) { a.firstDate = ms; a.firstIso = c.date }
      if (ms > a.lastDate) { a.lastDate = ms; a.lastIso = c.date }
    }
    for (const f of c.files) {
      a.added += f.added
      a.deleted += f.deleted
      a.files.add(f.path)
      a.fileMods.set(f.path, (a.fileMods.get(f.path) ?? 0) + 1)
    }
  }
  const rows: AuthorReportRow[] = []
  for (const [author, a] of map) {
    const net = a.added - a.deleted
    const activeDays = activeDaysBetween(a.firstDate, a.lastDate)
    // 修改最多的文件 Top3（按修改次数降序，供展开详情展示）
    const topFiles = [...a.fileMods.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([path, count]) => ({ path, count }))
    rows.push({
      author,
      commits: a.commits,
      linesAdded: a.added,
      linesDeleted: a.deleted,
      netLines: net,
      avgCommitSize: a.commits > 0 ? Math.round(a.added / a.commits) : 0,
      frequency: round2(a.commits / Math.max(1, activeDays / 7)),
      filesTouched: a.files.size,
      activeDays,
      firstCommitAt: a.firstIso,
      lastCommitAt: a.lastIso,
      // 代码流失率：删除行/新增行（无新增为 0，避免除零）
      churnRate: a.added > 0 ? round2(a.deleted / a.added) : 0,
      topFiles,
    })
  }
  return rows.sort((x, y) => y.commits - x.commits)
}
