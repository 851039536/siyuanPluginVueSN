export type ResourceLevel = 'normal' | 'medium' | 'high'

export interface Thresholds {
  CPU: { HIGH: number; MEDIUM: number }
  MEM: { HIGH: number; MEDIUM: number }
}

export const THRESHOLDS: Thresholds = {
  CPU: { HIGH: 80, MEDIUM: 60 },
  MEM: { HIGH: 85, MEDIUM: 70 }
}

export const MONITOR_INTERVAL_MS = 3000
export const INITIAL_DELAY_MS = 2000
export const DEFAULT_TOTAL_MEMORY_GB = 8

export interface SystemMonitorState {
  cpuPercent: number
  memPercent: number
  uptimeSeconds: number
  showMonitor: boolean
}
