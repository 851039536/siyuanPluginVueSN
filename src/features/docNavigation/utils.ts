// 文档导航工具函数：思源时间格式解析、相对时间/短日期格式化
/** 思源时间戳格式（YYYYMMDDHHMMSS）正则 */
const SIYUAN_TIME_REGEX = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/

/**
 * 解析思源时间字符串为 Date
 * 兼容两种格式：YYYYMMDDHHMMSS（14 位）与标准 ISO 日期
 */
export function parseSiYuanDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  const m = SIYUAN_TIME_REGEX.exec(trimmed)
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    )
  }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 短日期格式 MM-DD，如 08-08 */
export function formatShortDate(dateStr: string): string {
  const date = parseSiYuanDate(dateStr)
  if (!date) return ""
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${month}-${day}`
}

/**
 * 相对时间：7 天内显示"X 天前"，超过 7 天回退为短日期"MM-DD"
 */
export function formatRelativeTime(dateStr: string, now: Date = new Date()): string {
  const date = parseSiYuanDate(dateStr)
  if (!date) return ""
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays <= 0) return "今天"
  if (diffDays === 1) return "1 天前"
  if (diffDays < 7) return `${diffDays} 天前`
  return formatShortDate(dateStr)
}

/** 完整时间戳（含年，如 2026-08-08 14:30），用于 tooltip */
export function formatFullTime(dateStr: string): string {
  const date = parseSiYuanDate(dateStr)
  if (!date) return ""
  const pad = (n: number): string => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
