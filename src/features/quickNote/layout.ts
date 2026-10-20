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
/** 最小化态动态样式的 style 标签 ID（injectStyle/removeStyle 配对） */
const MINIMIZED_STYLE_ID = "quick-note-minimized-style"
/** 最小化态遮罩状态类（Manager 与注入样式共用） */
const MINIMIZED_MASK_CLASS = "quick-note-mask--minimized"
/** 最小化小条根节点类名（测量小条尺寸前确认 Vue 已完成渲染） */
const MINI_BAR_CLASS = "mini-bar"
/** 最小化态半透明度（悬停恢复不透明，降低小条对背后界面的视觉干扰） */
const MINIMIZED_OPACITY = 0.5

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

/** 移除最小化态注入样式（Manager destroy 调用） */
export function disposePanelLayout(): void {
  removeStyle(MINIMIZED_STYLE_ID)
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

/** 小条实际尺寸；Vue 尚未把内容切到小条时返回 null（不能拿展开面板尺寸钳制小条坐标） */
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
    // 最小化过渡中小条可能尚未渲染，此时以 0 尺寸仅约束左上角，避免把展开尺寸当成小条尺寸
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

/** 最小化态：容器收缩为 auto，遮罩透明且点击穿透，仅小条可交互 */
function applyMinimizedChrome(mask: HTMLElement, container: HTMLElement): void {
  container.style.width = "auto"
  container.style.height = "auto"
  mask.style.background = "transparent"
  mask.style.pointerEvents = "none"
  container.style.pointerEvents = "auto"
  mask.classList.add(MINIMIZED_MASK_CLASS)
  // 小条外壳（容器 div）半透明，悬停恢复：:hover 无法用内联样式表达，经 injectStyle + 遮罩状态 class 实现
  injectStyle(MINIMIZED_STYLE_ID, `
    #${MASK_ID}.${MINIMIZED_MASK_CLASS} > div {
      opacity: ${MINIMIZED_OPACITY};
      transition: opacity 0.12s;
    }
    #${MASK_ID}.${MINIMIZED_MASK_CLASS} > div:hover {
      opacity: 1;
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
