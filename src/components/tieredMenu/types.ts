// TieredMenu 类型与常量：递归菜单项 + 上下文契约
// （TieredMenu.vue 的私有模块，禁止 feature 直接导入）
import type { IconKey } from "../kit/icons"

/**
 * 单条菜单项（**递归结构**：`items` 可无限层嵌套）。
 *
 * 与 `MegaMenuItem` 的关系：两者是**各自独立**的模型，不互相依赖。
 * - `MegaMenuItem` 的 `items` 只支持一层 —— 因为「多列并排面板」范式下更深嵌套无意义，
 *   它另有 `header`（分组列标题）/ `description` 等字段。
 * - `TieredMenuItem` 的核心恰恰是**逐级下钻的级联子菜单**，故 `items` 递归任意层，
 *   并补上级联菜单特有的 `separator`（分隔线）。
 * 强行合并成一个模型会让两边都背上对方用不到的字段（Rule of Three：此处只是第二个菜单，
 * 尚不足以判定「同一个模型」，保持各自内聚）。
 */
export interface TieredMenuItem {
  /** 唯一键（v-for key + 活动路径标识；同一层级内需唯一） */
  key: string
  /** 文案 */
  label?: string
  /** 项图标（须为已注册的 IconKey） */
  icon?: IconKey
  /** 单项禁用（不可点击、不展开、方向键跳过） */
  disabled?: boolean
  /** 子项（递归任意层；有子项时该项成为可下钻的父项） */
  items?: TieredMenuItem[]
  /**
   * 是否为分隔线：渲染为一条横线而非可交互项。
   * 分隔线不参与键盘漫游（方向键跳过），也不需要 `label`。
   */
  separator?: boolean
  /**
   * 危险项（如「删除」）：文字与图标取语义错误色，作为不可撤销操作的视觉提示。
   * 不影响交互与键盘漫游，仅改配色。
   */
  danger?: boolean
  /** 点击回调（叶子项） */
  command?: (item: TieredMenuItem, event: MouseEvent | KeyboardEvent) => void
}

/** 尺寸档位（与全库控件阶梯一致） */
export type TieredMenuSize = "xsmall" | "small" | "medium" | "large"

/**
 * 子菜单展开方向（相对父项）：
 * - `right`（默认）：子菜单出现在父项右侧（左对齐菜单向右展开）
 * - `left`：子菜单出现在父项左侧（菜单靠近视口右缘时用）
 * 由组件按可用空间**自动翻转**（`auto` 行为内置，不作为 prop 暴露）。
 */
export type TieredSubmenuSide = "left" | "right"

/** 活动路径上的一环：从根层到当前展开层，记录各层选中的下标 */
export type ActivePath = number[]

/** 供子菜单递归渲染的上下文（模板内逐层传递，不依赖 provide/inject —— 递归组件天然逐层持有） */
export interface TieredMenuNodeContext {
  /** 当前节点深度（根层为 0） */
  level: number
  /** 从根到本节点的下标路径（用于与 activePath 比对判定展开） */
  path: number[]
}

/** 默认中文文案（可被调用方覆盖为 i18n ⇒ 零 i18n 分片改动） */
export const DEFAULT_POPUP_MENU_LABEL = "菜单"

/** popup 模式下菜单距视口边缘的最小留白（px） */
export const POPUP_VIEWPORT_PADDING = 8

/** 子菜单与父项的间距（px）：留给箭头视觉指向，也避免鼠标穿越空隙时丢失 hover */
export const SUBMENU_GAP = 2
