/**
 * 文档分析功能 - 格式化工具
 */

/** 格式化字节数为可读字符串（紧凑格式，区别于全局 formatFileSize：KB 保留 1 位小数、上限 MB，适合列表行内展示） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 格式化字数为可读字符串，文案模板由 i18n 提供（避免硬编码中文单位）
 * @param count 字数
 * @param tplNormal 小于 1 万字的模板，占位符 {count}=原始字数（如 "{count} 字"）
 * @param tplLarge 大于等于 1 万字的模板，占位符 {countTenK}=万单位 / {countK}=千单位（如 "{countTenK} 万字" / "{countK}k words"）
 */
export function formatWordCount(count: number, tplNormal: string, tplLarge: string): string {
  if (count < 10000) return tplNormal.replace("{count}", String(count))
  return tplLarge
    .replace("{countTenK}", (count / 10000).toFixed(1))
    .replace("{countK}", (count / 1000).toFixed(1))
}
