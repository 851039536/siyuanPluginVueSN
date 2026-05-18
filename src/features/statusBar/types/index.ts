/**
 * 状态栏类型定义和常量
 */

// ============================================================
// 类型定义
// ============================================================

export type ResourceLevel = "normal" | "medium" | "high"

export interface StatusBarState {
  cpuPercent: number
  memPercent: number
  uptimeSeconds: number
  showMonitor: boolean
  totalNotes: number
  totalWords: number
  todayCreated: number
  todayModified: number
  yesterdayCreated: number
  yesterdayModified: number
}

// ============================================================
// 常量
// ============================================================

export const THRESHOLDS = {
  CPU: { HIGH: 80, MEDIUM: 60 },
  MEM: { HIGH: 85, MEDIUM: 70 },
} as const

export const MONITOR_INTERVAL_MS = 3000
export const STATISTICS_INTERVAL_MS = 60000
export const INITIAL_DELAY_MS = 2000
export const DEFAULT_TOTAL_MEMORY_GB = 8
