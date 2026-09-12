// MegaMenu 类型与常量：分组项模型 + 方位 / 尺寸字面量类型 + 默认中文文案
// （MegaMenu.vue 的私有模块，禁止 feature 直接导入）
import type { IconKey } from "../kit/icons"
import type { OverlaySize } from "../overlay/types"

/**
 * 单条菜单项。
 * 本项目自有的精简投影（与 `SpeedDialAction` 同范式），**不照搬官方 `MenuItem`**：
 * 官方那套含 `url` / `routerLink` / `target` / `visible` / `separator` 等字段，
 * 而本项目（思源插件，无 vue-router）并不需要，强塞会变成无法兑现的假契约。
 */
export interface MegaMenuItem {
  /** 唯一键（v-for key，也用于受控展开态的标识） */
  key: string
  /** 文案（必填：既作显示文本又作无障碍名称） */
  label: string
  /** 项图标（须为已注册的 IconKey） */
  icon?: IconKey
  /** 单项禁用（不可点击、不触发 command） */
  disabled?: boolean
  /**
   * 子项。
   * ⚠️ 只支持**一层**：根项 -> 面板内的分组列 -> 叶子项。
   * 更深的嵌套在 MegaMenu 的「面板并排」范式下没有意义（那属于普通 Menu / 级联菜单）。
   */
  items?: MegaMenuItem[]
  /**
   * 是否为「分组标题」：渲染为不可点击的列标题（如「文档」「资源」）。
   * 开启后该项自身的 `command` / `icon` 不生效。
   */
  header?: boolean
  /** 点击回调（叶子项） */
  command?: (item: MegaMenuItem, event: MouseEvent | KeyboardEvent) => void
  /** 叶子项的补充说明（面板内显示在标签下方的小字） */
  description?: string
}

/** 根菜单的排列方向：`horizontal`（默认，面板在下方展开）/ `vertical`（面板在侧方展开） */
export type MegaMenuOrientation = "horizontal" | "vertical"

/** 尺寸档位（与全库控件阶梯一致；定义在 `overlay/types.ts`） */
export type MegaMenuSize = OverlaySize

/** 响应式断点（px）：视口宽度小于该值时折叠为单按钮 + 弹层，对齐官方 `breakpoint` 默认 960 */
export const DEFAULT_BREAKPOINT = 960

/** 面板最大高度（超出时面板内部滚动），对齐官方 `scrollHeight` 默认 20rem */
export const DEFAULT_SCROLL_HEIGHT = "20rem"

/** 面板内分组列的最小宽度（px）：多列并排时每列的下限，窄容器下自动换列 */
export const COLUMN_MIN_WIDTH = 160

/** 默认中文文案（可被调用方覆盖为 i18n 文案 ⇒ 零 i18n 分片改动） */
export const DEFAULT_MOBILE_BUTTON_LABEL = "菜单"
