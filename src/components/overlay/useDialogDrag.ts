/**
 * Dialog 标题栏拖拽（可选能力，由 Dialog 的 `draggable` prop 开启）。
 *
 * 实现要点：
 * - 位移用 `position: relative` + `left/top`（兼容性最好，且不与 Dialog 进出场的 `transform: scale` 冲突）；
 *   位移为 0 时不输出内联样式，保持元素原生定位。
 * - 指针监听挂在 `window` 上（不依赖 setPointerCapture），拖出弹窗范围仍能持续跟随；
 *   `pointerup` / `pointercancel` / 组件卸载都会解绑，避免监听泄漏。
 * - 拖动范围按视口钳制（保留 8px 边距）；弹窗比视口还大时该轴锁定居中、不可拖。
 * - 标题栏内的按钮 / 输入等交互控件不触发拖拽（`NO_DRAG_SELECTOR`）。
 */
import type { ComputedRef, CSSProperties, Ref } from "vue"
import { computed, onUnmounted, ref } from "vue"

/** 视口边距（px）：保证弹窗不会被拖到完全看不见 */
const DRAG_MARGIN = 8

/** 标题栏内不触发拖拽的元素（关闭按钮、插槽内自建按钮等） */
const NO_DRAG_SELECTOR = "button, a, input, textarea, select, [role='button'], [data-no-drag]"

interface DragOffset {
  x: number
  y: number
}

/** 拖动期间固定不变的边界（按下时按弹窗未平移位置快照） */
interface DragBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** 拖拽位移样式（位移为 0 时返回 undefined，不改变元素原生定位） */
export type DialogDragStyle = CSSProperties

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function useDialogDrag(containerRef: Ref<HTMLElement | null>, enabled: () => boolean): {
  dragging: Ref<boolean>
  dragStyle: ComputedRef<DialogDragStyle | undefined>
  handleDragStart: (event: PointerEvent) => void
  resetDrag: () => void
} {
  const offset = ref<DragOffset>({ x: 0, y: 0 })
  const dragging = ref(false)

  let pointerStart: DragOffset = { x: 0, y: 0 }
  let offsetStart: DragOffset = { x: 0, y: 0 }
  let bounds: DragBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

  const dragStyle = computed<DialogDragStyle | undefined>(() => {
    if (offset.value.x === 0 && offset.value.y === 0) return undefined
    return {
      position: "relative",
      left: `${offset.value.x}px`,
      top: `${offset.value.y}px`,
    }
  })

  function handleDragMove(event: PointerEvent): void {
    if (!dragging.value) return
    offset.value = {
      x: clamp(offsetStart.x + event.clientX - pointerStart.x, bounds.minX, bounds.maxX),
      y: clamp(offsetStart.y + event.clientY - pointerStart.y, bounds.minY, bounds.maxY),
    }
  }

  function handleDragEnd(): void {
    if (!dragging.value) return
    dragging.value = false
    unbindWindowListeners()
  }

  function bindWindowListeners(): void {
    window.addEventListener("pointermove", handleDragMove)
    window.addEventListener("pointerup", handleDragEnd)
    window.addEventListener("pointercancel", handleDragEnd)
  }

  function unbindWindowListeners(): void {
    window.removeEventListener("pointermove", handleDragMove)
    window.removeEventListener("pointerup", handleDragEnd)
    window.removeEventListener("pointercancel", handleDragEnd)
  }

  function handleDragStart(event: PointerEvent): void {
    if (!enabled() || event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (target?.closest(NO_DRAG_SELECTOR)) return
    const el = containerRef.value
    if (!el) return

    const rect = el.getBoundingClientRect()
    // rect 已包含当前位移，先还原到未平移位置再算允许范围
    const baseLeft = rect.left - offset.value.x
    const baseTop = rect.top - offset.value.y
    const minX = DRAG_MARGIN - baseLeft
    const maxX = window.innerWidth - DRAG_MARGIN - rect.width - baseLeft
    const minY = DRAG_MARGIN - baseTop
    const maxY = window.innerHeight - DRAG_MARGIN - rect.height - baseTop
    // 弹窗比视口还大时 max < min：该轴锁定为居中位置（不可拖）
    bounds = {
      minX: minX <= maxX ? minX : (minX + maxX) / 2,
      maxX: minX <= maxX ? maxX : (minX + maxX) / 2,
      minY: minY <= maxY ? minY : (minY + maxY) / 2,
      maxY: minY <= maxY ? maxY : (minY + maxY) / 2,
    }

    pointerStart = { x: event.clientX, y: event.clientY }
    offsetStart = { ...offset.value }
    dragging.value = true
    bindWindowListeners()
    event.preventDefault()
  }

  /** 关闭后重开复位（由 Dialog 在 visible 变 true 时调用） */
  function resetDrag(): void {
    dragging.value = false
    offset.value = { x: 0, y: 0 }
    unbindWindowListeners()
  }

  onUnmounted(() => {
    unbindWindowListeners()
  })

  return {
    dragging,
    dragStyle,
    handleDragStart,
    resetDrag,
  }
}
