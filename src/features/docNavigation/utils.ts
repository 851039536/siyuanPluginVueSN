// 文档导航工具函数：思源时间解析/格式化、发布平台识别
import { PLATFORM_MATCHERS } from "./types"
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

/** 提取已发布平台显示名列表：扫描 custom-<平台>-yaml 属性（值非空），按 PLATFORM_MATCHERS 匹配并返回显示名（空数组表示未发布） */
export function getPublishedPlatformNames(attrs: Record<string, string> | null | undefined): string[] {
  if (!attrs) return []
  const found = new Set<string>()
  for (const key of Object.keys(attrs)) {
    const lower = key.toLowerCase()
    if (!lower.startsWith("custom-") || !lower.endsWith("-yaml")) continue
    if (!attrs[key]?.trim()) continue
    const name = PLATFORM_MATCHERS.find((p) => p.matchers.some((m) => lower.includes(m.toLowerCase())))?.name
    if (name) found.add(name)
  }
  // 按 PLATFORM_MATCHERS 定义顺序输出，保证多平台显示顺序稳定
  return PLATFORM_MATCHERS.map((p) => p.name).filter((name) => found.has(name))
}
