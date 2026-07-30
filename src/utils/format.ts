/**
 * 通用格式化工具函数
 */

/**
 * 格式化文件大小为可读字符串
 * @param bytes 文件大小（字节）
 * @returns 格式化后的字符串，如 "1.23 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

/**
 * 格式化时间戳为可读的本地时间字符串
 * @param time ISO 字符串、时间戳或 Date 对象
 * @returns 格式化后的字符串，如 "2026-07-06 16:19:23"
 */
export function formatTime(time: string | number | Date): string {
  const d = new Date(time)
  if (isNaN(d.getTime())) { return String(time) }
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 相对时间的单位阈值表（秒），从大到小匹配第一个满足的单位 */
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]

/**
 * 格式化时间为相对时间字符串，跟随系统语言（Intl.RelativeTimeFormat）
 * @param time ISO 字符串、时间戳或 Date 对象
 * @returns 如 "1分钟前" / "5 minutes ago"；不足 1 分钟显示秒级；无效时间返回空串
 */
export function formatRelativeTime(time: string | number | Date): string {
  const d = new Date(time)
  if (isNaN(d.getTime())) { return "" }
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000) // 过去为负值
  const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: "auto" })
  const abs = Math.abs(diffSec)
  for (const [unit, sec] of RELATIVE_TIME_UNITS) {
    if (abs >= sec) { return rtf.format(Math.round(diffSec / sec), unit) }
  }
  return rtf.format(diffSec, "second")
}
