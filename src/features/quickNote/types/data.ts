/**
 * 速记功能 — 数据模型类型与元数据映射表
 * 定义三大数据模块（待办/灵感/项目）的领域类型、统一存储对象、优先级/状态元数据
 */

/** 待办优先级（紧急/高/中/低） */
export type TodoPriority = "urgent" | "high" | "medium" | "low"

/** 项目状态：进行中 / 已完成 / 卡住 */
export type ProjectStatus = "active" | "completed" | "blocked"

/** 待办条目 */
export interface TodoItem {
  /** 唯一 ID（时间戳 + 随机串） */
  id: string
  /** 待办内容 */
  content: string
  /** 优先级 */
  priority: TodoPriority
  /** 截止日期（YYYY-MM-DD，可为空） */
  dueDate: string | null
  /** 是否已完成 */
  done: boolean
  /** 完成时间戳（毫秒，复盘统计依赖） */
  doneAt: number | null
  /** 关联项目 ID（一对一，null 表示未关联项目） */
  projectId: string | null
  /** 顺延次数（逾期自动/手动顺延累计） */
  rolloverCount: number
  /** 创建时间戳（毫秒） */
  createdAt: number
  /** 最近更新时间戳（毫秒） */
  updatedAt: number
}

/** 灵感条目 */
export interface InspirationItem {
  /** 唯一 ID */
  id: string
  /** 灵感内容 */
  content: string
  /** 标签列表 */
  tags: string[]
  /** 创建时间戳（毫秒） */
  createdAt: number
  /** 最近更新时间戳（毫秒） */
  updatedAt: number
}

/** 项目条目 */
export interface ProjectItem {
  /** 唯一 ID */
  id: string
  /** 项目名称 */
  name: string
  /** 当前进行到哪一步 */
  currentStep: string
  /** 下一步计划 */
  nextStep: string
  /** 卡点描述（可能为空） */
  blockers: string
  /** 项目状态：进行中/已完成/卡住 */
  status: ProjectStatus
  /** 创建时间戳（毫秒） */
  createdAt: number
  /** 最近更新时间戳（毫秒） */
  updatedAt: number
}

/** 统一存储对象（key: "quick-note-data"），四大模块共享一个 TypedStorage 槽 */
export interface AppData {
  /** 待办列表 */
  todos: TodoItem[]
  /** 灵感列表 */
  inspirations: InspirationItem[]
  /** 项目列表 */
  projects: ProjectItem[]
  /** 上次自动顺延日期（YYYY-MM-DD），用于防止同一天重复顺延 */
  lastRolloverDate: string | null
}

/** 优先级选项列表（表单 Select 与元数据映射共用的单一数据源） */
export const TODO_PRIORITIES: TodoPriority[] = ["urgent", "high", "medium", "low"]

/** 项目状态选项列表（表单 Select 与元数据映射共用的单一数据源） */
export const PROJECT_STATUSES: ProjectStatus[] = ["active", "completed", "blocked"]

/** 优先级元数据（排序权重 + 标签文案 i18n 键 + 语义色 CSS 变量） */
export const PRIORITY_META: Record<
  TodoPriority,
  { rank: number, labelKey: string, color: string }
> = {
  urgent: { rank: 0, labelKey: "priorityUrgent", color: "#ef4444" },
  high: { rank: 1, labelKey: "priorityHigh", color: "#f59e0b" },
  medium: { rank: 2, labelKey: "priorityMedium", color: "#3b82f6" },
  low: { rank: 3, labelKey: "priorityLow", color: "#94a3b8" },
}

/** 项目状态元数据（标签文案 i18n 键 + 语义色 CSS 变量） */
export const STATUS_META: Record<
  ProjectStatus,
  { labelKey: string, color: string }
> = {
  active: { labelKey: "statusActive", color: "#3b82f6" },
  completed: { labelKey: "statusCompleted", color: "#22c55e" },
  blocked: { labelKey: "statusBlocked", color: "#ef4444" },
}
