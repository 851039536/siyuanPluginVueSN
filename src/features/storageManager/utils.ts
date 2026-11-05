/**
 * 数据管理 - 纯工具函数
 */

/** 增长型槽位的体积告警阈值（150 KB） */
export const GROWTH_WARNING_BYTES = 150 * 1024

/** 字节数格式化 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 时间戳格式化（本地时区，固定 `YYYY-MM-DD HH:mm`） */
export function formatTime(timestamp?: number): string {
  if (!timestamp) return "—"
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 是否命中「增长型且体积超过阈值」告警 */
export function isGrowthWarning(growth: boolean, bytes: number): boolean {
  return growth && bytes > GROWTH_WARNING_BYTES
}

/** 求和 */
export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
