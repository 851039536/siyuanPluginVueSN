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
  const sizes = ["B", "KB", "MB", "GB"]
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
