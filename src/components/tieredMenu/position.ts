// TieredMenu popup 模式的坐标定位与子菜单方向解析（纯函数，零 Vue 依赖）
// 沿用 confirm/position.ts、splitter/sizes.ts 的「计算外置、组件只做编排」先例
import {
  POPUP_VIEWPORT_PADDING,
  SUBMENU_GAP,
} from "./types"

/** 矩形（视口坐标） */
export interface MenuRect {
  top: number
  left: number
  width: number
  height: number
}

/** 视口尺寸 */
export interface Viewport {
  width: number
  height: number
}

export interface MenuPositionInput {
  /** 触发点（鼠标坐标或触发元素矩形） */
  anchor: MenuRect
  /** 菜单自身尺寸（先渲染测量再定位） */
  menu: { width: number; height: number }
  /** 视口尺寸 */
  viewport: Viewport
}

/** 菜单视口坐标（配合 `position: fixed`） */
export interface MenuPosition {
  top: number
  left: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/**
 * popup 模式的菜单定位：
 * 默认把菜单左上角放在触发点，然后做**视口双向钳制** ——
 * 靠近右/下边缘时整体内收，而不是溢出视口。
 * （不做「上翻 / 左翻」：菜单与触发点的关联是「从这里弹出」，
 *   翻转会让菜单跳到鼠标的另一侧，反而失去指向感。）
 */
export function resolveMenuPosition(input: MenuPositionInput): MenuPosition {
  const { anchor, menu, viewport } = input
  const maxLeft = viewport.width - menu.width - POPUP_VIEWPORT_PADDING
  const maxTop = viewport.height - menu.height - POPUP_VIEWPORT_PADDING

  return {
    top: Math.round(clamp(anchor.top, POPUP_VIEWPORT_PADDING, maxTop)),
    left: Math.round(clamp(anchor.left, POPUP_VIEWPORT_PADDING, maxLeft)),
  }
}

/**
 * 子菜单展开方向：优先向右，剩余空间不足且左侧更宽时翻转到左侧。
 * 公式来源：父项右缘到视口右缘的可用空间 vs 父项左缘到视口左缘的可用空间。
 *
 * @param parentRect 父项的视口矩形
 * @param submenuWidth 子菜单宽度
 * @param viewport 视口尺寸
 */
export function resolveSubmenuSide(
  parentRect: MenuRect,
  submenuWidth: number,
  viewport: Viewport,
): "left" | "right" {
  const spaceRight = viewport.width - (parentRect.left + parentRect.width) - POPUP_VIEWPORT_PADDING
  if (spaceRight >= submenuWidth) return "right"

  const spaceLeft = parentRect.left - POPUP_VIEWPORT_PADDING
  return spaceLeft > spaceRight ? "left" : "right"
}

/** 子菜单相对父项的偏移（配合 `position: absolute` 挂在父项上） */
export const submenuOffsetStyle = (side: "left" | "right") => (
  side === "right"
    ? { left: `calc(100% + ${SUBMENU_GAP}px)`, right: "auto" }
    : { right: `calc(100% + ${SUBMENU_GAP}px)`, left: "auto" }
)
