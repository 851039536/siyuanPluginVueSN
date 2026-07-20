/**
 * 文档分析功能 - 格式化工具
 */

/** 格式化字节数为可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 格式化字数为可读字符串 */
export function formatWordCount(count: number): string {
  if (count === 0) return "0 字"
  if (count < 10000) return `${count} 字`
  return `${(count / 10000).toFixed(1)} 万字`
}
