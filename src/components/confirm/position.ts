// ConfirmPopup 的定位计算（纯函数，零 Vue 依赖，便于单独推理与复用）
// 沿用 splitter/sizes.ts 的「计算外置、组件只做编排」先例
import type { ConfirmPlacement } from "./types"

/** 气泡与锚点之间的间距（px） */
export const POPUP_GAP = 8
/** 气泡距视口边缘的最小留白（px） */
export const POPUP_PADDING = 8
/** 指向三角的边长（px）：三角被钳制在气泡圆角以内 */
export const POPUP_ARROW_SIZE = 8

/** 矩形（视口坐标） */
export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface PopupPositionInput {
  /** 锚点矩形 */
  anchor: Rect
  /** 气泡自身尺寸（先渲染测量再定位） */
  popup: { width: number; height: number }
  /** 视口尺寸 */
  viewport: { width: number; height: number }
  /** 期望方位 */
  placement: ConfirmPlacement
}

export interface PopupGeometry {
  /** 气泡视口坐标（配合 `position: fixed`） */
  top: number
  left: number
  /** 最终采用的方位（`auto` 会被解析为具体的上下方位） */
  placement: Exclude<ConfirmPlacement, "auto">
  /** 指向三角相对气泡的偏移：横向方位时是 `left`，纵向方位时是 `top` */
  arrowOffset: number
  /** 三角是否按垂直方向定位（`left` / `right` 方位为 true） */
  arrowVertical: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** `auto`：优先下方、空间不足上翻（两侧都不够时取空间更大的一侧） */
const resolveAutoPlacement = (
  input: PopupPositionInput,
): Exclude<ConfirmPlacement, "auto"> => {
  const { anchor, popup, viewport } = input
  const spaceBelow = viewport.height - (anchor.top + anchor.height) - POPUP_GAP - POPUP_PADDING
  const spaceAbove = anchor.top - POPUP_GAP - POPUP_PADDING
  if (spaceBelow >= popup.height) return "bottom"
  if (spaceAbove >= popup.height) return "top"
  return spaceBelow >= spaceAbove ? "bottom" : "top"
}

/** 是否属于「上下方位」（顶部行 / 底部行） */
const isVerticalPlacement = (placement: Exclude<ConfirmPlacement, "auto">) =>
  placement.startsWith("top") || placement.startsWith("bottom")

/**
 * 计算气泡的视口坐标与最终方位。
 * 四步：① 解析 `auto`；② 按方位算主轴坐标；③ 算交叉轴对齐；④ 统一做视口钳制。
 */
export function resolvePopupPosition(input: PopupPositionInput): PopupGeometry {
  const { anchor, popup, viewport } = input
  const placement = input.placement === "auto" ? resolveAutoPlacement(input) : input.placement

  const anchorCenterX = anchor.left + anchor.width / 2
  const anchorCenterY = anchor.top + anchor.height / 2
  const anchorRight = anchor.left + anchor.width
  const anchorBottom = anchor.top + anchor.height

  let top: number
  let left: number

  if (isVerticalPlacement(placement)) {
    top = placement.startsWith("bottom")
      ? anchorBottom + POPUP_GAP
      : anchor.top - POPUP_GAP - popup.height

    // 交叉轴：居中对齐（top / bottom）或端点对齐（四角）
    if (placement.endsWith("left")) {
      left = anchor.left
    } else if (placement.endsWith("right")) {
      left = anchorRight - popup.width
    } else {
      left = anchorCenterX - popup.width / 2
    }
  } else {
    top = anchorCenterY - popup.height / 2
    left = placement === "left"
      ? anchor.left - POPUP_GAP - popup.width
      : anchorRight + POPUP_GAP
  }

  // 视口钳制：显式方位只钳制不翻转（`auto` 已在 ① 完成翻转判断）
  const maxLeft = viewport.width - popup.width - POPUP_PADDING
  const maxTop = viewport.height - popup.height - POPUP_PADDING
  left = clamp(left, POPUP_PADDING, maxLeft)
  top = clamp(top, POPUP_PADDING, maxTop)

  const arrowVertical = !isVerticalPlacement(placement)
  const arrowEdge = POPUP_ARROW_SIZE * 2
  const arrowOffset = arrowVertical
    ? clamp(anchorCenterY - top, arrowEdge, popup.height - arrowEdge)
    : clamp(anchorCenterX - left, arrowEdge, popup.width - arrowEdge)

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
    arrowOffset: Math.round(arrowOffset),
    arrowVertical,
  }
}
