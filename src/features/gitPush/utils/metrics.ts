// gitPush 指标与条形宽度计算（纯函数）：百分比、最大值、净增语义 class、行数排行预计算
import type { ProjectLineRankItem } from "../types"

/** 条形宽度百分比（相对最大值，消除 CommitAnalysisPanel 中 4 个 computed 内的重复计算） */
export function barPct(count: number, max: number): string {
  return `${Math.round((count / max) * 100)}%`
}

/** 计数占比百分比（count/total，total=0 兜底 0%），统计视图远程覆盖率/分类分布共用 */
export function ratioPct(count: number, total: number): string {
  if (total === 0) { return "0%" }
  return `${Math.round((count / total) * 100)}%`
}

/**
 * 为排行条目预计算条形宽度百分比。
 * max 取所有行中的最大值（兼容已排序降序的排行数据以及未排序的时间序列如 dailyCommits）。
 * zeroAsEmpty 为 true 时 count=0 的项返回 "0%"（如 dailyRows 留空柱）。
 */
export function withBarPct<T extends { count: number }>(
  rows: T[],
  opts?: { zeroAsEmpty?: boolean },
): (T & { pct: string })[] {
  const max = maxOf(rows.map((r) => r.count), 1)
  return rows.map((r) => ({
    ...r,
    pct: opts?.zeroAsEmpty && r.count === 0 ? "0%" : barPct(r.count, max),
  }))
}

/** 净增行语义 class：正→`<prefix>--pos` / 负→`<prefix>--neg` / 零→`<prefix>--zero`（zeroSuffix 传空串时零值返回空串，不追加 class） */
export function netClass(net: number, prefix: string, zeroSuffix = "--zero"): string {
  if (net > 0) return `${prefix}--pos`
  if (net < 0) return `${prefix}--neg`
  return zeroSuffix === "" ? "" : `${prefix}${zeroSuffix}`
}

/**
 * 取数组最大值，结果不小于 min。
 * 用 reduce 而非 Math.max(...arr)：扩展运算符在元素极多时会因参数个数超限抛 RangeError
 * （报告的日统计/债务行在大仓库「全部」范围下可达数千条）。
 */
export function maxOf(list: ReadonlyArray<number>, min: number): number {
  return list.reduce((acc, n) => (n > acc ? n : acc), min)
}

/** 行数排行条形/占比预计算（按 pick 指定的行数指标取绝对值，负值安全）：pct=相对最大值的条形宽度，share=占总和的百分比（total=0 兜底防除零）。
 * 项目排行传 totalLines（存量口径，与「按总行数降序」一致）；详情弹窗文件/作者明细传 net（净增口径）。 */
export function withLineBarPct<T>(rows: T[], pick: (r: T) => number): (T & { pct: string, share: string })[] {
  const max = maxOf(rows.map((r) => Math.abs(pick(r))), 1)
  const total = rows.reduce((s, r) => s + Math.abs(pick(r)), 0) || 1
  return rows.map((r) => {
    const v = Math.abs(pick(r))
    return {
      ...r,
      pct: `${Math.round((v / max) * 100)}%`,
      share: `${((v / total) * 100).toFixed(1)}%`,
    }
  })
}

/** 项目行数排行排序比较器（单一来源）：按总行数（存量）降序，同存量再按净增、新增降序。
 * buildLineRankings（全量分析）与 refreshLineStatsProject（单项目刷新 upsert 重排）共用，保证两处口径一致。 */
export function compareProjectLineRank(a: ProjectLineRankItem, b: ProjectLineRankItem): number {
  return (b.totalLines ?? 0) - (a.totalLines ?? 0) || b.net - a.net || b.added - a.added
}
