/**
 * 网站导航 — 共享常量（独立模块，避免与 Manager/Vue 组件产生运行时循环依赖）
 */

/** 默认分类 ID（面板/弹窗/存储共用） */
export const DEFAULT_CATEGORY_ID = "default"
/** “全部”分类筛选 ID（面板/筛选栏共用） */
export const ALL_CATEGORY_ID = "all"
/** 默认分类颜色（FilterBar/WebsiteCard/Storage 共用） */
export const DEFAULT_CATEGORY_COLOR = "#b0aea5"
/** 分类管理弹窗预设色（CategoryManager/Storage 共用） */
export const PRESET_CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#b0aea5",
] as const
