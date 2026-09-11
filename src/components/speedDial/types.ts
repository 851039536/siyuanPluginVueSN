// SpeedDial 类型与常量：方向/轨迹/定位/尺寸字面量类型 + 8 向角度与档位按钮边长单一数据源
// （SpeedDial.vue 的私有模块，禁止 feature 直接导入）

import type { IconKey } from "../kit/icons"

/** 展开方向（8 向） */
export type SpeedDialDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right"

/** 展开轨迹：直线 / 整圆 / 半圆 / 四分之一圆 */
export type SpeedDialType = "linear" | "circle" | "semi-circle" | "quarter-circle"

/** 角落定位档位 */
export type SpeedDialPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left"

/** 尺寸档位（与全库按钮阶梯一致） */
export type SpeedDialSize = "xsmall" | "small" | "medium" | "large"

/** 气泡方向后缀（思源内置 b3-tooltips 的八向类名） */
export type SpeedDialTooltipSide = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

/** 动作按钮配色（与 Button.vue 的 severity 取值保持一致，改动需同步两处） */
export type SpeedDialActionSeverity =
  | "primary"
  | "secondary"
  | "success"
  | "info"
  | "warning"
  | "danger"

/** 单个动作项（label 必填：既作气泡文案又作无障碍名称） */
export interface SpeedDialAction {
  /** 唯一键（v-for key） */
  key: string
  /** 气泡文案 + 无障碍名称 */
  label: string
  /** 动作图标（须为已注册的 IconKey） */
  icon?: IconKey
  /** 动作按钮配色（透传给共享 Button 的 severity） */
  severity?: SpeedDialActionSeverity
  /** 单项禁用 */
  disabled?: boolean
  /** 点击回调 */
  onClick?: (action: SpeedDialAction, event: MouseEvent) => void
}

/**
 * 方向 → 屏幕角度（度）：0° 指向右，顺时针递增，屏幕 y 轴向下为正。
 * 例：up = 270° ⇒ sin 为负 ⇒ y 为负（向上）。
 */
export const DIRECTION_ANGLE: Record<SpeedDialDirection, number> = {
  right: 0,
  "down-right": 45,
  down: 90,
  "down-left": 135,
  left: 180,
  "up-left": 225,
  up: 270,
  "up-right": 315,
}

/** 方向 → 气泡反向侧（动作在 up 侧展开时气泡落在动作的左右侧） */
export const DIRECTION_TOOLTIP_SIDE: Record<SpeedDialDirection, SpeedDialTooltipSide> = {
  up: "w",
  down: "w",
  left: "n",
  right: "n",
  "up-left": "sw",
  "up-right": "se",
  "down-left": "nw",
  "down-right": "ne",
}

/**
 * 尺寸档位 → 按钮边长（px）。
 * 必须与 Button.scss 的 `--icon-only` 档位尺寸表（22/28/36/44）保持一致，改动需同步两处。
 */
export const SIZE_BUTTON_EDGE: Record<SpeedDialSize, number> = {
  xsmall: 22,
  small: 28,
  medium: 36,
  large: 44,
}

/** linear 轨迹相邻动作的间隙（px，= $spacing-2） */
export const LINEAR_ITEM_GAP = 8

/** 曲线轨迹默认半径（px）；无对应 Token，故以 TS 常量表达 */
export const DEFAULT_RADIUS = 96
