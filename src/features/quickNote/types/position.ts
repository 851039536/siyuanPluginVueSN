/**
 * 速记功能 — 弹窗位置相关类型与映射表
 * 定义弹窗显示位置（五档预设 + 自定义）、设置接口，以及位置 → 遮罩 flex 对齐 / 最小化方向映射
 */
import type { IconKey } from "@/config/icons"

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
