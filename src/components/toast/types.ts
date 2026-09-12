// Toast 类型与常量：severity / position 字面量类型 + 行程档位 + 方位与图标映射
// （Toast.vue 的私有模块，禁止 feature 直接导入）
import type { IconKey } from "../kit/icons"
import type { OverlaySize } from "../overlay/types"

/**
 * 语义类型：取值逐字对齐 PrimeVue Toast 的 `ToastMessageOptions.severity`
 * （`warn` / `error` / `contrast` 为官方写法）。
 * ⚠️ 与库内 `Button.severity`（warning / danger）**有意不统一**，勿按库内命名「修正」——
 *    同 `Message.severity`，两者保持同一套取值。
 */
export type ToastSeverity = "secondary" | "success" | "info" | "warn" | "error" | "contrast"

/** 未显式指定 severity 时的默认值（官方 `ToastMessageOptions.severity` 默认 info） */
export const DEFAULT_SEVERITY: ToastSeverity = "info"

/**
 * 浮层停靠方位（八档，逐字对齐官方 Toast `position`）：
 * 四角 + 上下边中点（无左右边中点，与官方一致）。
 */
export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center"

/** 停靠方位默认值（官方 `position` 默认 `top-right`） */
export const DEFAULT_POSITION: ToastPosition = "top-right"

/** 尺寸档位（与全库控件阶梯一致；定义在 `overlay/types.ts`） */
export type ToastSize = OverlaySize

/**
 * 单条消息（对齐官方 `ToastMessageOptions`，去掉本项目不做的两项）：
 * - 不做 `styleClass` / `contentStyleClass`：本项目组件一律用库内类名契约，
 *   自定义外观走 `container` / `message` 插槽（同 Panel 拒绝 `toggleButtonProps` 的判据）。
 * - 保留 `group`：与组件的 `group` prop 共同实现「按组过滤 + 按组清除」。
 * - `id` 由组件在入列时补齐（用于 `v-for` 的 key 与 `remove()` 精确定位）。
 */
export interface ToastMessageOptions {
  /** 语义类型；不传时按 `info` 渲染 */
  severity?: ToastSeverity
  /** 标题（醒目的一行） */
  summary?: string
  /** 详情（标题下方的次要说明；缺省时不渲染该行） */
  detail?: string
  /** 是否显示关闭按钮（默认 `true`，即 `closable !== false` 才渲染 —— 与官方判据一致） */
  closable?: boolean
  /** 自动关闭延时（毫秒）：仅有限正数生效；鼠标悬停期间暂停计时、移出后继续剩余时长 */
  life?: number
  /** 所属分组：仅当与该组件 `group` 相等时才会被渲染 */
  group?: string
  /** 组件内部补齐的消息 id（调用方通常不传） */
  id?: number
}

/** 已入列的消息（`id` 必填的内部形态） */
export interface ToastMessage extends ToastMessageOptions {
  id: number
}

/** 各 severity 的默认图标：官方 `iconComponent` 的 IconKey 投影（`secondary` / `contrast` 官方无默认图标） */
export const SEVERITY_ICON: Partial<Record<ToastSeverity, IconKey>> = {
  info: "info",
  success: "checkCircle",
  warn: "warning",
  error: "error",
}

/**
 * 各 severity 默认图标边长（档位字号 10/12/14/16 逐档 +2px，同 `Message` 的 TIER_ICON_SIZE 口径）。
 * 图标是文字性的行内标识，应与消息文字同阶，否则默认档位会「大图标配小字」。
 */
export const TIER_ICON_SIZE: Record<ToastSize, number> = {
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
}
