/**
 * RSS 日期工具 — 相对时间格式化（列表与详情共用）
 */
/**
 * 将日期字符串格式化为相对时间
 */
export function formatRelativeDate(dateStr: string | undefined, i18n: Record<string, string>): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    const now = new Date()
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    if (diffMins < 1) return i18n.justNow
    if (diffMins < 60) return `${diffMins}${i18n.minutesAgo}`
    if (diffHours < 24) return `${diffHours}${i18n.hoursAgo}`
    if (diffDays < 7) return `${diffDays}${i18n.daysAgo}`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}
