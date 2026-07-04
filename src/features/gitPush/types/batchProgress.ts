// 批量操作日志条目与进度状态类型定义

export interface LogEntry {
  projectName: string
  status: "ok" | "fail"
  elapsedSeconds: number
  error?: string
}

export interface LoadProgress {
  visible: boolean
  current: number
  total: number
  label: string
  projectName?: string
  elapsedSeconds: number
}
