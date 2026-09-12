// Tooltip 的定位计算（纯函数，零 Vue 依赖）
//
// 复用策略：主轴/交叉轴坐标计算与视口钳制复用 ConfirmPopup 的 `resolvePopupPosition`
// （`confirm/position.ts`），此处只补两处 tooltip 特有差异，不复制几何代码：
//   1. `auto` 的偏好在**上方**（官方 Tooltip 默认 top），而 ConfirmPopup 偏好在下方；
//      故先自行解析 auto 为 top / bottom，再交给共享函数按显式方位计算（显式方位不翻转）。
//   2. 只支持四向 + auto（无四角档位）。
import type { ConfirmPlacement } from "../confirm/types"
import type { TooltipPlacement } from "./types"
import type { PopupGeometry } from "../confirm/position"
import {
  POPUP_ARROW_SIZE,
  POPUP_GAP,
  POPUP_PADDING,
  resolvePopupPosition,
} from "../confirm/position"

/** 复用 ConfirmPopup 的尺寸契约（矩形 / 入参形状），避免两套几何输入类型 */
export type { PopupGeometry, PopupPositionInput, Rect } from "../confirm/position"
export { POPUP_ARROW_SIZE }

/** 解析后的具体方位（四向，不含 auto） */
export type ResolvedTooltipPlacement = Exclude<TooltipPlacement, "auto">

/** 共享函数认识的方位集合（四向是 ConfirmPlacement 的子集，直接透传即可） */
const isVertical = (placement: ResolvedTooltipPlacement) =>
  placement === "top" || placement === "bottom"

/**
 * `auto`：优先**上方**、空间不足下翻；两侧都不够时取空间更大的一侧。
 * ⚠️ 与 ConfirmPopup 的偏好相反（那里优先下方），因 Tooltip 的官方默认方位是 top。
 */
const resolveAutoPlacement = (
  anchor: { top: number; height: number },
  popupHeight: number,
  viewportHeight: number,
): ResolvedTooltipPlacement => {
  const spaceAbove = anchor.top - POPUP_GAP - POPUP_PADDING
  const spaceBelow = viewportHeight - (anchor.top + anchor.height) - POPUP_GAP - POPUP_PADDING
  if (spaceAbove >= popupHeight) return "top"
  if (spaceBelow >= popupHeight) return "bottom"
  return spaceAbove >= spaceBelow ? "top" : "bottom"
}

export interface TooltipPositionInput {
  /** 锚点矩形（视口坐标） */
  anchor: {
    top: number
    left: number
    width: number
    height: number
  }
  /** 气泡自身尺寸（先渲染测量再定位） */
  popup: { width: number; height: number }
  /** 视口尺寸 */
  viewport: { width: number; height: number }
  /** 期望方位 */
  placement: TooltipPlacement
}

/**
 * 计算气泡的视口坐标与最终方位。
 * `auto` 先按 tooltip 偏好（上方优先）解析为 top / bottom，随后复用共享函数完成
 * 主轴定位、交叉轴居中对齐、视口钳制与指向三角偏移。
 */
export function resolveTooltipPosition(input: TooltipPositionInput): PopupGeometry {
  const { anchor, popup, viewport } = input

  const placement: ConfirmPlacement = input.placement === "auto"
    ? resolveAutoPlacement(anchor, popup.height, viewport.height)
    : input.placement

  return resolvePopupPosition({
    anchor,
    popup,
    viewport,
    placement,
  })
}

/** 气泡是否位于锚点纵向一侧（供样式判断指向三角方向，避免读 geometry 反推） */
export const isVerticalPlacement = (placement: ResolvedTooltipPlacement) => isVertical(placement)
