/**
 * 工具合集 - 拖拽调整面板高度 composable
 * 面板顶部边缘拖拽，松手时一次性持久化
 */
import type { Ref } from "vue"
import { ref } from "vue"
import { PANEL_HEIGHT_MAX, PANEL_HEIGHT_MIN } from "../types"

export interface DragResizeReturn {
  isResizing: Ref<boolean>
  onResizeStart: (e: MouseEvent) => void
}

/**
 * @param panelHeight 面板高度 ref（vh）
 * @param onSave 松手时持久化回调
 * @param min 最小高度 vh
 * @param max 最大高度 vh
 */
export function useDragResize(
  panelHeight: Ref<number>,
  onSave: (value: number) => void,
  min = PANEL_HEIGHT_MIN,
  max = PANEL_HEIGHT_MAX
): DragResizeReturn {
  const isResizing = ref(false)
  let startY = 0
  let startHeight = 0

  const onMouseMove = (e: MouseEvent) => {
    // 向上拖 → deltaY 为负 → 面板变高
    const deltaY = startY - e.clientY
    const deltaVh = (deltaY / window.innerHeight) * 100
    const newHeight = Math.max(min, Math.min(max, startHeight + deltaVh))
    panelHeight.value = Math.round(newHeight)
  }

  const onMouseUp = () => {
    isResizing.value = false
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", onMouseUp)
    onSave(panelHeight.value)
  }

  const onResizeStart = (e: MouseEvent) => {
    e.preventDefault()
    isResizing.value = true
    startY = e.clientY
    startHeight = panelHeight.value
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return { isResizing, onResizeStart }
}
