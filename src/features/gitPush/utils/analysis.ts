// gitPush 提交分析纯函数：类型前缀解析、本地日期聚合、热力等级与格子展示、通用计数排行
import type { CommitAnalysisEntry, CommitAnalysisType } from "../types"
import { ANALYSIS_WEEKDAY_KEYS, COMMIT_ANALYSIS_TYPE_META, HEAT_LEVEL_THRESHOLDS } from "../types"

/**
 * 解析 Conventional Commits 提交信息前缀类型（feat/fix/docs 等），无前缀或未知前缀返回 other。
 * 提交内容分析用；与 storage.ts 的 COMMIT_TYPE_VALUES（提交模板类型）各自独立。
 */
export function parseCommitAnalysisType(message: string): CommitAnalysisType {
  const match = /^([a-z]+)(?:\([^)]*\))?!?:\s/.exec(message || "")
  if (match) {
    const t = match[1] as CommitAnalysisType
    if (t in COMMIT_ANALYSIS_TYPE_META) return t
  }
  return "other"
}

/** ISO 日期 → YYYY-MM-DD（git %aI 为 UTC ISO，切前 10 位即可；无值返回 —；报告视图文件详情/活跃范围共用） */
export function formatIsoDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "—"
}

/** 本地日期格式化：Date → YYYY-MM-DD（日聚合/热力图共用，避免 UTC 解析在西半球时区跨日偏移） */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * 按本地日期（YYYY-MM-DD）聚合提交条目到最近 days 天的每日桶（缺天补 0），
 * 时间分析：返回从最早到今天的正序桶，供条形图直接渲染。
 */
export function buildDailyCommitBuckets(entries: CommitAnalysisEntry[], days = 30): { label: string, count: number }[] {
  const countByDay = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatLocalDate(d)
    countByDay.set(key, (countByDay.get(key) || 0) + 1)
  }
  const buckets: { label: string, count: number }[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const label = formatLocalDate(d)
    buckets.push({ label, count: countByDay.get(label) || 0 })
  }
  return buckets
}

/** 按本地日期（YYYY-MM-DD）聚合提交条目为日计数映射（热力图/日历视图共用，缺天不补 0） */
export function buildDayCountMap(entries: CommitAnalysisEntry[]): Map<string, number> {
  const countByDay = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatLocalDate(d)
    countByDay.set(key, (countByDay.get(key) || 0) + 1)
  }
  return countByDay
}

/** 热力等级：按 HEAT_LEVEL_THRESHOLDS 将日提交数映射为 0~4 级（0 次 → 0，≥12 次 → 4） */
export function heatLevel(count: number): number {
  let level = 0
  for (let i = HEAT_LEVEL_THRESHOLDS.length - 1; i > 0; i--) {
    if (count >= HEAT_LEVEL_THRESHOLDS[i]) { level = i; break }
  }
  return level
}

/** 解析热力图/日历显示范围：最近一年 = 今天−364 天 ~ 今天；年份 N = N-01-01 ~ 今年今天 / N-12-31 */
export function resolveAnalysisRange(range: "lastYear" | number): { start: Date, end: Date } {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  if (range === "lastYear") {
    const start = new Date(end)
    start.setDate(start.getDate() - 364)
    return { start, end }
  }
  const start = new Date(range, 0, 1)
  if (range < end.getFullYear()) end.setMonth(11, 31)
  return { start, end }
}

/** 热力格子背景色：level 0 用主题表面灰；level 1~4 用主色按 20%/40%/60%/85% 透明度（hex+alpha 后缀，深浅主题通用） */
export function heatCellColor(level: number, main: string): string {
  if (level <= 0) return "rgba(var(--b3-theme-on-surface-rgb), 0.05)"
  return `${main}${["33", "66", "99", "D9"][Math.min(level, 4) - 1]}`
}

/**
 * 热力图/日历格子 tooltip："2026-08-01（周六）：3 次提交"。
 * 两个视图共用同一文案口径（i18n 键 analysisHeatTooltip 占位 {0}日期 {1}星期 {2}次数）。
 */
export function heatCellTooltip(i18n: Record<string, any>, date: string, count: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return String(i18n.analysisHeatTooltip || "")
    .replace("{0}", date)
    .replace("{1}", i18n[ANALYSIS_WEEKDAY_KEYS[dow]] || "")
    .replace("{2}", String(count))
}

/** 通用计数排行：按 keyFn 分组计数，降序取前 limit 条（项目/作者/类型排行共用） */
export function rankByCount<T>(items: T[], keyFn: (item: T) => string, limit: number): { key: string, count: number }[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
