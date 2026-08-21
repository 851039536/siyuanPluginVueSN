/**
 * Skills 查看器 — 纯工具函数（不依赖 Vue 响应式）
 */

/** 格式化文件大小（B/KB/MB/GB） */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / k ** i
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
