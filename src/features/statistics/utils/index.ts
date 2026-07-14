/**
 * 格式化时间戳为 HH:MM 字符串
 */
export function formatTime(ts: string | undefined): string {
  if (!ts || ts.length < 12) return ""
  return `${ts.substring(8, 10)}:${ts.substring(10, 12)}`
}

/**
 * 格式化数字，添加千分位分隔符
 */
export function formatNumber(num: number): string {
  return (num || 0).toLocaleString("zh-CN")
}

/**
 * 格式化短数字 (K, M)
 */
export function formatShortNumber(num: number): string {
  if (!num) return "0"
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return String(num)
}

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num)
}

/**
 * 计算进度条百分比宽度（最小 1%）
 */
export function barPct(val: number, max: number): string {
  return `${Math.max((val / max) * 100, 1)}%`
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
}

/**
 * 判断日期字符串（格式 YYYY-MM-DD）是否为今天
 */
export function isToday(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`
  return dateStr === todayStr
}

/**
 * 校验日期字符串是否为合法 yyyyMMdd 格式，防止 SQL 注入
 */
export function isValidDateStr(dateStr: string): boolean {
  return /^\d{8}$/.test(dateStr)
}
