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
