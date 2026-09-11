// 确认类组件（ConfirmDialog / ConfirmPopup）共享的类型、常量与插槽契约
// （ConfirmDialog / ConfirmPopup 的私有模块，禁止 feature 直接导入）
import type { IconKey } from "../kit/icons"
import type {
  OverlayPosition,
  OverlaySize,
} from "../overlay/types"

/**
 * 对话框位置（九档，对齐官方 Dialog 取值）：模板类驱动、零 JS 定位。
 * `center` 默认居中；`left` / `right` / `top` / `bottom` 贴对应边；四角为「边 + 端点」组合。
 * 定义已上移到共享弹层模块 `overlay/types.ts`（与 Dialog 共用），此处按既有名称转出，外部用法零变更。
 */
export type ConfirmPosition = OverlayPosition

/**
 * 气泡相对锚点的方位：
 * - `auto`（默认）：优先锚点下方、空间不足自动上翻，水平居中对齐
 * - `top` / `bottom`：上下方位 + 水平居中对齐
 * - `topleft` / `topright` / `bottomleft` / `bottomright`：上下方位 + 左/右边缘对齐
 * - `left` / `right`：左右方位 + 垂直居中对齐
 * 显式指定方位时**只做视口钳制、不做翻转**（避免「指定了却跑到反方向」的意外）。
 */
export type ConfirmPlacement =
  | "auto"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topleft"
  | "topright"
  | "bottomleft"
  | "bottomright"

/** 确认按钮配色：官方走 `acceptProps.severity` 对象袋，本项目扁平化为单值（更自由的诉求走 `container` 插槽） */
export type ConfirmSeverity = "danger" | "primary"

/** 尺寸档位（与全库控件阶梯一致；定义在 `overlay/types.ts`，与 Dialog 共用） */
export type ConfirmSize = OverlaySize

/** 中文默认文案（沿用 Panel / Splitter / Paginator 惯例：可被调用方覆盖为 i18n 文案 ⇒ 零 i18n 分片改动） */
export const DEFAULT_ACCEPT_LABEL = "确定"
export const DEFAULT_REJECT_LABEL = "取消"
/** 关闭按钮文案：定义在共享弹层模块（与 Dialog 同一语义与默认值），此处转出 */
export { DEFAULT_CLOSE_LABEL } from "../overlay/types"

/** `message` 插槽作用域（扁平字段；官方给 ConfirmationOptions 对象，受控驱动下无从提供，属有意差异） */
export interface ConfirmMessageScope {
  /** 消息文本（按 `\n` 分行的原始值） */
  message: string
  /** 标题图标 */
  icon?: IconKey
}

/** `icon` 插槽作用域 */
export interface ConfirmIconScope {
  /** 图标容器类名钩子 */
  class: string
}

/**
 * `container` 插槽作用域：整块替换确认内容所需的全部字段与回调。
 * ⚠️ 不提供官方的 `initDragCallback`（本项目不做 `draggable`，属有意裁剪）。
 */
export interface ConfirmContainerScope {
  /** 标题 */
  header?: string
  /** 消息文本 */
  message: string
  /** 标题图标 */
  icon?: IconKey
  /** 确认按钮文案 */
  acceptLabel: string
  /** 取消按钮文案 */
  rejectLabel: string
  /** 关闭（右上角关闭按钮 / 遮罩 / Esc / 点击外部） */
  closeCallback: () => void
  /** 取消 */
  rejectCallback: () => void
  /** 确认（不自动关闭，由调用方决定关闭时机） */
  acceptCallback: () => void
}
