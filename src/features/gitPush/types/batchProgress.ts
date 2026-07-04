// 批量操作日志条目与进度状态类型定义

/** 单个步骤的耗时记录 */
export interface LogStep {
  name: string
  ms: number
}

export interface LogEntry {
  projectName: string
  status: "pending" | "ok" | "fail"
  elapsedSeconds: number
  error?: string
  /** 分步骤耗时明细（按完成顺序追加，支持并行场景） */
  steps?: LogStep[]
}

export interface LoadProgress {
  visible: boolean
  current: number
  total: number
  label: string
  projectName?: string
  elapsedSeconds: number
  /** 是否已完成（停止计时，等待用户手动关闭） */
  done?: boolean
}
