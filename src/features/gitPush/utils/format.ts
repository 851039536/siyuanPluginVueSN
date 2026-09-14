// gitPush 展示格式化（纯函数）：相对/绝对时间、年份选项、分析状态文案、活动分级、操作日志标签
import type { GitOpLogEntry } from "../types"

/** LOG 默认显示条数（与 BranchCommitList.countOptions 首项保持一致） */
export const DEFAULT_LOG_LIMIT = 200

/** 把 ISO 时间转为相对时间文案（i18n 驱动，含 {0} 数字占位），无法解析返回空 */
export function relativeTime(iso: string | undefined, i18n: Record<string, any>): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (isNaN(t)) return ""
  const diff = Date.now() - t
  const min = 60 * 1000; const hour = 60 * min; const day = 24 * hour
  if (diff < min) return i18n.timeJustNow
  if (diff < hour) return i18n.timeMinutesAgo.replace("{0}", String(Math.floor(diff / min)))
  if (diff < day) return i18n.timeHoursAgo.replace("{0}", String(Math.floor(diff / hour)))
  if (diff < 30 * day) return i18n.timeDaysAgo.replace("{0}", String(Math.floor(diff / day)))
  if (diff < 365 * day) return i18n.timeMonthsAgo.replace("{0}", String(Math.floor(diff / (30 * day))))
  return i18n.timeYearsAgo.replace("{0}", String(Math.floor(diff / (365 * day))))
}

/** 将 ISO 绝对时间格式化为 "YYYY-MM-DD HH:mm"（空值返回空串，无效日期返回原字符串；提交列表等处共用） */
export function formatDateTime(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO 时间 → YYYY-MM-DD HH:mm（无法解析时降级返回原值） */
export function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

/** 显示设置年份选项：数据年份 ∪ 今年 ∪ 已保存 range 年份，降序（分析视图 popover 与设置汇总弹窗共用） */
export function buildYearOptions(entries: { date: string }[], range: "lastYear" | number): number[] {
  const years = new Set<number>([new Date().getFullYear()])
  if (typeof range === "number") years.add(range)
  for (const e of entries) {
    const d = new Date(e.date)
    if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
  }
  return [...years].sort((a, b) => b - a)
}

/**
 * 分析状态文案统一："分析中… / 上次分析 xx / 未分析"（提交分析与提交规则检查工具条共用，
 * notRunKey 区分 analysisNotRun / ruleCheckNotRun，消除跨工具条重复三元表达式）。
 */
export function analysisStatusText(opts: {
  analyzing: boolean
  analyzed: boolean
  analyzedAt: string
  i18n: Record<string, any>
  notRunKey: string
  /** 相对时间不可用时（analyzedAt 缺失/无法解析）的兜底文案键，如 timeJustNow；不传则保留空串（既有行为） */
  fallbackKey?: string
}): string {
  const { analyzing, analyzed, analyzedAt, i18n, notRunKey, fallbackKey } = opts
  if (analyzing) return i18n.auditing
  if (analyzed) {
    const relative = relativeTime(analyzedAt, i18n) || (fallbackKey ? i18n[fallbackKey] : "")
    return i18n.analysisLastRun.replace("{0}", relative)
  }
  return i18n[notRunKey]
}

/** 按活动时间分级（用于卡片颜色提示） */
export function activityLevel(iso?: string): "fresh" | "recent" | "stale" | "dead" {
  if (!iso) return "dead"
  const t = Date.parse(iso)
  if (isNaN(t)) return "dead"
  const day = 24 * 60 * 60 * 1000
  const diff = Date.now() - t
  if (diff < 7 * day) return "fresh"
  if (diff < 30 * day) return "recent"
  if (diff < 90 * day) return "stale"
  return "dead"
}

/** 判断操作日志条目是否包含平台明细（push/pull 且有 platforms 数据） */
export function hasLogPlatforms(entry: GitOpLogEntry): boolean {
  return (entry.action === "push" || entry.action === "pull") && !!entry.platforms?.length
}

/** 操作类型 → 中文标签（i18n 驱动，无匹配时降级返回原始 action） */
export function logActionLabel(action: string, i18n: Record<string, any>): string {
  const map: Record<string, string> = {
    push: i18n.opPush,
    pull: i18n.opPull,
    commit: i18n.opCommit,
  }
  return map[action] ?? action
}
