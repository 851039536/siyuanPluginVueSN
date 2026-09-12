// Tooltip 类型与常量：方位 / 尺寸字面量类型 + 延迟默认值
// （Tooltip.vue 的私有模块，禁止 feature 直接导入）
import type { OverlaySize } from "../overlay/types"

/**
 * 气泡相对锚点的方位（四向 + `auto`，比 ConfirmPopup 少四角档位）：
 * - `top`（默认）：锚点上方、水平居中
 * - `bottom` / `left` / `right`：其余三向、交叉轴居中
 * - `auto`：优先上方、空间不足自动下翻，两侧都不够时取空间更大的一侧
 * 与本库 `ConfirmPopup` 一致：**显式方位只做视口钳制、不翻转**（避免「指定了却跑到反方向」的意外）。
 */
export type TooltipPlacement = "top" | "bottom" | "left" | "right" | "auto"

/** 尺寸档位（与全库控件阶梯一致；定义在 `overlay/types.ts`） */
export type TooltipSize = OverlaySize

/**
 * 触发方式：`hover`（指针悬停）/ `focus`（键盘或脚本聚焦）/ `both`（默认，两者任一即显示）。
 * 对齐官方 Tooltip 的 `focus` modifier 默认开启 —— 键盘用户必须能触发气泡，否则信息对键盘不可达。
 */
export type TooltipTrigger = "hover" | "focus" | "both"

/** 显示 / 隐藏延迟默认值（px 无关，单位毫秒；对齐官方 `showDelay` / `hideDelay` 默认 0） */
export const DEFAULT_SHOW_DELAY = 0
export const DEFAULT_HIDE_DELAY = 0
