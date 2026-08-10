/**
 * 速记功能 — 领域类型与共享常量
 * 定义弹窗位置相关类型、四大数据模块（待办/灵感/项目）的领域类型、优先级/状态元数据，
 * 以及位置 → 遮罩 flex 对齐 / 最小化方向映射表
 */
import type { IconKey } from "@/config/icons"

// ==================== 弹窗位置相关（Manager 依赖） ====================

/** 弹窗显示位置（五档预设） */
export type QuickNotePosition = "center" | "top" | "bottom" | "left" | "right"

/** 实际定位模式：五档预设或拖拽产生的自定义坐标 */
export type QuickNotePlacement = QuickNotePosition | "custom"

/** 速记功能设置（对象存储，便于未来扩展字段时浅合并兜底） */
export interface QuickNoteSettings {
  position: QuickNotePlacement
  /** 自定义定位的容器左上角视口坐标（px，position === "custom" 时生效） */
  customX: number
  customY: number
  /** 最小化状态（持久化，重启/自动打开时恢复小条形态） */
  minimized: boolean
}

/** 位置选项列表（Select 选项与 Manager 校验共用的单一数据源） */
export const QUICK_NOTE_POSITIONS: QuickNotePosition[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
]

/**
 * 位置 → 遮罩层 flex 对齐样式映射
 * Manager 据此改写 Modal 遮罩的 align-items / justify-content 实现贴边
 */
export const POSITION_ALIGN_MAP: Record<
  QuickNotePosition,
  { alignItems: string, justifyContent: string }
> = {
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  bottom: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  left: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  right: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
}

/** 最小化条的收缩轴向：horizontal = 收成横条（上/下/居中），vertical = 收成竖条（左/右） */
export type QuickNoteMinimizeAxis = "horizontal" | "vertical"

/**
 * 位置 → 最小化方向元数据映射
 * axis 决定最小化条的收缩轴向；collapseIcon/expandIcon 指示收起/展开的方向箭头
 */
export const POSITION_MINIMIZE_META: Record<
  QuickNotePlacement,
  { axis: QuickNoteMinimizeAxis, collapseIcon: IconKey, expandIcon: IconKey }
> = {
  // 居中无贴靠边缘，按横条收起（视觉上向上折叠为标题条）
  center: {
    axis: "horizontal",
    collapseIcon: "chevronUp",
    expandIcon: "chevronDown",
  },
  // 自定义坐标无贴靠边缘，同 center 按横条原地收起
  custom: {
    axis: "horizontal",
    collapseIcon: "chevronUp",
    expandIcon: "chevronDown",
  },
  top: {
    axis: "horizontal",
    collapseIcon: "chevronUp",
    expandIcon: "chevronDown",
  },
  bottom: {
    axis: "horizontal",
    collapseIcon: "chevronDown",
    expandIcon: "chevronUp",
  },
  left: {
    axis: "vertical",
    collapseIcon: "chevronLeft",
    expandIcon: "chevronRight",
  },
  right: {
    axis: "vertical",
    collapseIcon: "chevronRight",
    expandIcon: "chevronLeft",
  },
}

// ==================== 数据模块类型（待办 / 灵感 / 项目） ====================

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
