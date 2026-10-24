// gitPush 报告指标引擎 — 提交节奏层：星期分布 / 时段分布 / 最长连续提交（纯函数）
import type { CommitRhythmStats, HourBucketStat, WeekdayStat } from "../types/report"
import type { NumstatCommit } from "./types"
import { formatLocalDate } from "../utils/analysis"
import { parseIsoMs } from "./parseNumstat"

/** 小时分桶步长（2 小时一桶，共 12 桶） */
const HOUR_BUCKET_STEP = 2

/** 解析 ISO 时刻为一天中的小时小数（0~24），解析失败返回 -1 */
function hourOfDay(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return -1
  const d = new Date(t)
  return d.getHours() + d.getMinutes() / 60
}

/**
 * 按星期聚合提交分布（单次 O(n) 遍历，输出固定 7 项，下标 0=周日 ~ 6=周六，与 Date.getDay 对齐）。
 * 解析失败的日期条目忽略；无提交的星期 count 保持 0。
 */
function aggregateWeekdayStats(commits: NumstatCommit[]): WeekdayStat[] {
  const counts = new Array<number>(7).fill(0)
  for (const c of commits) {
    const t = parseIsoMs(c.date)
    if (t <= 0) continue
    counts[new Date(t).getDay()]++
  }
  return counts.map((count, dow) => ({ dow, count }))
}

/**
 * 按 2 小时分桶聚合时段分布（单次 O(n) 遍历，输出固定 12 桶，每桶 [start, start+2)）。
 * 解析失败/越界时刻忽略；无提交的时段 count 保持 0。
 */
function aggregateHourlyStats(commits: NumstatCommit[]): HourBucketStat[] {
  const counts = new Array<number>(24 / HOUR_BUCKET_STEP).fill(0)
  for (const c of commits) {
    const h = hourOfDay(c.date)
    if (h < 0 || h >= 24) continue
    counts[Math.floor(h / HOUR_BUCKET_STEP)]++
  }
  return counts.map((count, i) => ({
    start: i * HOUR_BUCKET_STEP,
    end: (i + 1) * HOUR_BUCKET_STEP,
    count,
  }))
}

/**
 * 最长连续提交天数（按本地日历日去重后识别最大连续天数，O(n log n)）。
 * 思路：日期集合排序后相邻两日相差 1 天则 streak 递增，否则重置；无提交返回 0。
 */
function maxCommitStreak(commits: NumstatCommit[]): number {
  const days = new Set<string>()
  for (const c of commits) {
    const t = parseIsoMs(c.date)
    if (t <= 0) continue
    // 本地日历日去重（与 aggregateWeekdayStats/aggregateDailyStats 口径统一；toISOString 取 UTC 日会在非零时区跨日错位）
    days.add(formatLocalDate(new Date(t)))
  }
  if (days.size === 0) return 0
  const sorted = [...days].sort()
  let best = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const gap = (Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / (24 * 60 * 60 * 1000)
    // gap < 2 视为相邻日历日（DST 时区相邻日跨度可能为 23/25h，避免严格 === 1 误断连续）
    if (gap < 2) {
      cur++
      if (cur > best) best = cur
    } else {
      cur = 1
    }
  }
  return best
}

/** 7 项星期空桶（dow 0=周日 ~ 6=周六，count 全 0） */
function emptyWeekdayBuckets(): WeekdayStat[] {
  return Array.from({ length: 7 }, (_, dow) => ({ dow, count: 0 }))
}

/** 12 项时段空桶（每桶 2 小时，count 全 0） */
function emptyHourBuckets(): HourBucketStat[] {
  return Array.from({ length: 24 / HOUR_BUCKET_STEP }, (_, i) => ({
    start: i * HOUR_BUCKET_STEP,
    end: (i + 1) * HOUR_BUCKET_STEP,
    count: 0,
  }))
}

/** 提交节奏空结构（git 失败/零提交时报告填充用） */
export function emptyRhythmStats(): CommitRhythmStats {
  const weekday = emptyWeekdayBuckets()
  const hourly = emptyHourBuckets()
  return { weekday, hourly, topWeekday: weekday[1], peakHours: hourly[0], maxStreak: 0 }
}

/**
 * 组装提交节奏聚合（星期分布 + 时段分布 + 最长连续提交 + 高峰时段 + 最活跃星期）。
 * 全部为 0 时：最活跃星期取周一（dow=1），高峰时段取首桶（0-2），避免 UI 索引越界。
 */
export function buildRhythmStats(commits: NumstatCommit[]): CommitRhythmStats {
  const weekday = aggregateWeekdayStats(commits)
  const hourly = aggregateHourlyStats(commits)
  const topWeekday = weekday.reduce((best, w) => (w.count > best.count ? w : best), weekday[1])
  const peakHours = hourly.reduce((best, h) => (h.count > best.count ? h : best), hourly[0])
  return { weekday, hourly, topWeekday, peakHours, maxStreak: maxCommitStreak(commits) }
}
