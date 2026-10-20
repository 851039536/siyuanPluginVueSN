/**
 * 速记 — 面板布局应用层
 * 把 Manager 的权威状态（位置/尺寸/最小化）落到 Modal 遮罩与容器 DOM 上；
 * 几何钳制复用 pureUtils，状态仍由 Manager 持有（返回钳制后的 custom 坐标供其回写）
 */
import type { PanelSize } from "./pureUtils"
import type { QuickNotePlacement } from "./types"
import { injectStyle, removeStyle } from "@/utils/domUtils"
import { resolvePanelPoint, resolvePanelSize } from "./pureUtils"
import { POSITION_ALIGN_MAP } from "./types"

/** 视口边缘留白（px）：预设贴边、拖拽与缩放钳制共用 */
export const EDGE_PADDING = 8
/** 面板高度默认比例（未手动缩放时按视口高度的 70% 计算） */
const PANEL_DEFAULT_HEIGHT_RATIO = 0.7
/** 首帧容器高度（applyPanelLayout 会按持久化尺寸与视口重新计算） */
export const PANEL_DEFAULT_HEIGHT_CSS = `${PANEL_DEFAULT_HEIGHT_RATIO * 100}vh`
/** 面板最小宽高（px）：低于此值 Tab 与表单无法正常排版 */
export const PANEL_MIN_WIDTH = 360
export const PANEL_MIN_HEIGHT = 320
/** 遮罩展开态背景（与 vueAppHelper 创建时的遮罩背景保持一致） */
const MASK_BACKGROUND = "rgba(0, 0, 0, 0.5)"
/** 遮罩 DOM ID（与 createModalVueApp 传入的 maskId 一致） */
export const MASK_ID = "quick-note-mask"
/** 最小化态容器边长（px）：与 .mini-bar 的 30px 按钮居中配合 */
const MINIMIZED_PANEL_SIZE = 32
/** 最小化/展开的尺寸过渡时长（ms）：0.12s，与全库过渡节奏一致 */
export const PANEL_TOGGLE_TRANSITION_MS = 120
/** 切换动画的遮罩状态类（仅切换瞬间存在，避免窗口 resize / 拖拽缩放反复动画） */
const TOGGLE_ANIMATING_CLASS = "quick-note-mask--animating"
/** 尺寸过渡注入样式的 style 标签 ID（injectStyle/removeStyle 配对） */
const LAYOUT_STYLE_ID = "quick-note-layout-style"
/** 最小化态遮罩状态类（半透明样式作用域） */
const MINIMIZED_MASK_CLASS = "quick-note-mask--minimized"
/** 最小化态半透明注入样式的 style 标签 ID */
const MINIMIZED_STYLE_ID = "quick-note-minimized-style"
/** 最小化态静止透明度（悬停恢复 1，降低小图标对界面的视觉干扰） */
const MINIMIZED_OPACITY = 0.4
/** 最小化图标按钮根节点类名（测量其尺寸前确认 Vue 已完成渲染） */
const MINI_BAR_CLASS = "mini-bar"

/** 应用布局所需的权威状态（由 Manager 传入，本层不持有） */
export interface PanelLayoutState {
  position: QuickNotePlacement
  minimized: boolean
  customX: number
  customY: number
  panelWidth: number
  panelHeight: number
}

/** 布局应用结果：custom 坐标可能被视口钳制，Manager 需回写 */
export interface PanelLayoutResult {
  customX: number
  customY: number
}

/** 获取速记遮罩 DOM */
export function getQuickNoteMask(): HTMLElement | null {
  return document.getElementById(MASK_ID)
}

/** 移除布局相关注入样式（Manager destroy 调用） */
export function disposePanelLayout(): void {
  removeStyle(LAYOUT_STYLE_ID)
  removeStyle(MINIMIZED_STYLE_ID)
}

/**
 * 开启一次最小化/展开的宽高过渡
 * 仅在切换瞬间加状态类：窗口 resize、拖拽缩放、打开面板都不能触发尺寸动画
 */
export function beginPanelToggleAnimation(): void {
  const mask = getQuickNoteMask()
  if (!mask) return
  injectStyle(LAYOUT_STYLE_ID, `
    #${MASK_ID}.${TOGGLE_ANIMATING_CLASS} > div {
      transition: width ${PANEL_TOGGLE_TRANSITION_MS}ms ease, height ${PANEL_TOGGLE_TRANSITION_MS}ms ease;
    }
    @media (prefers-reduced-motion: reduce) {
      #${MASK_ID}.${TOGGLE_ANIMATING_CLASS} > div {
        transition: none;
      }
    }
  `)
  mask.classList.add(TOGGLE_ANIMATING_CLASS)
  // 强制一次布局读取，确保过渡属性先于随后的宽高变化生效
  mask.getBoundingClientRect()
}

/** 结束尺寸过渡（移除状态类；注入样式保留复用，destroy 时统一移除） */
export function endPanelToggleAnimation(): void {
  getQuickNoteMask()?.classList.remove(TOGGLE_ANIMATING_CLASS)
}

/** 视口尺寸（读写分离，便于两处钳制共用同一来源） */
function getViewport(): PanelSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/** 本次渲染实际尺寸：未手动缩放时高度按视口比例派生 */
function getAppliedPanelSize(state: PanelLayoutState): PanelSize {
  const desiredHeight = state.panelHeight > 0
    ? state.panelHeight
    : Math.round(window.innerHeight * PANEL_DEFAULT_HEIGHT_RATIO)
  return resolvePanelSize(
    {
      width: state.panelWidth,
      height: desiredHeight,
    },
    getViewport(),
    {
      width: PANEL_MIN_WIDTH,
      height: PANEL_MIN_HEIGHT,
    },
    EDGE_PADDING,
  )
}

/** 最小化图标按钮实际尺寸；Vue 尚未把内容切到图标时返回 null（不能拿展开尺寸钳制图标坐标） */
function getMinimizedSize(container: HTMLElement): PanelSize | null {
  if (!container.querySelector(`.${MINI_BAR_CLASS}`)) return null
  const rect = container.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    width: rect.width,
    height: rect.height,
  }
}

/**
 * 位置应用：
 * 预设档清除绝对定位内联样式，改写遮罩 flex 对齐实现贴边/居中；
 * custom 绝对定位到钳制后的坐标（绝对定位脱离 flex 流，对齐属性无影响）
 */
function applyPlacement(
  mask: HTMLElement,
  container: HTMLElement,
  state: PanelLayoutState,
): PanelLayoutResult {
  if (state.position === "custom") {
    // 最小化过渡中图标按钮可能尚未渲染，此时以 0 尺寸仅约束左上角，避免把展开尺寸当成图标尺寸
    const size = state.minimized
      ? getMinimizedSize(container) ?? {
        width: 0,
        height: 0,
      }
      : getAppliedPanelSize(state)
    const point = resolvePanelPoint(
      {
        x: state.customX,
        y: state.customY,
      },
      size,
      getViewport(),
      EDGE_PADDING,
    )
    container.style.position = "absolute"
    container.style.left = `${point.x}px`
    container.style.top = `${point.y}px`
    mask.style.padding = "0"
    return {
      customX: point.x,
      customY: point.y,
    }
  }
  // 退出自定义定位：清除拖拽产生的绝对定位，回归遮罩 flex 对齐
  container.style.position = "relative"
  container.style.left = ""
  container.style.top = ""
  const align = POSITION_ALIGN_MAP[state.position]
  mask.style.alignItems = align.alignItems
  mask.style.justifyContent = align.justifyContent
  // 贴边档位留出与屏幕边缘的间距，居中无需
  mask.style.padding = state.position === "center" ? "0" : `${EDGE_PADDING}px`
  return {
    customX: state.customX,
    customY: state.customY,
  }
}

/** 展开态：还原遮罩交互并按持久化尺寸（视口钳制后）写容器宽高 */
function applyExpandedChrome(mask: HTMLElement, container: HTMLElement, state: PanelLayoutState): void {
  mask.style.background = MASK_BACKGROUND
  mask.style.pointerEvents = "auto"
  container.style.pointerEvents = ""
  mask.classList.remove(MINIMIZED_MASK_CLASS)
  const size = getAppliedPanelSize(state)
  container.style.width = `${size.width}px`
  container.style.height = `${size.height}px`
}

/** 最小化态：容器收缩为固定小方块（纯图标按钮），遮罩透明且点击穿透，仅图标可交互 */
function applyMinimizedChrome(mask: HTMLElement, container: HTMLElement): void {
  container.style.width = `${MINIMIZED_PANEL_SIZE}px`
  container.style.height = `${MINIMIZED_PANEL_SIZE}px`
  mask.style.background = "transparent"
  mask.style.pointerEvents = "none"
  container.style.pointerEvents = "auto"
  mask.classList.add(MINIMIZED_MASK_CLASS)
  // 静止半透明、悬停恢复：容器整体降低存在感（边框/底色/图标一起淡出）
  // 刻意不写 transition：避免覆盖切换瞬间的宽高过渡，悬停为即时恢复
  injectStyle(MINIMIZED_STYLE_ID, `
    #${MASK_ID}.${MINIMIZED_MASK_CLASS} > div {
      opacity: ${MINIMIZED_OPACITY};
    }
    #${MASK_ID}.${MINIMIZED_MASK_CLASS} > div:hover {
      opacity: 1;
    }
    /* 悬停淡入；切换动画期间让位给宽高过渡（:not 选择器不匹配） */
    #${MASK_ID}.${MINIMIZED_MASK_CLASS}:not(.${TOGGLE_ANIMATING_CLASS}) > div {
      transition: opacity 0.12s ease;
    }
  `)
}

/** 把状态完整落到遮罩/容器样式，返回钳制后的 custom 坐标 */
export function applyPanelLayout(
  mask: HTMLElement,
  container: HTMLElement,
  state: PanelLayoutState,
): PanelLayoutResult {
  if (state.minimized) {
    applyMinimizedChrome(mask, container)
  } else {
    applyExpandedChrome(mask, container, state)
  }
  return applyPlacement(mask, container, state)
}
