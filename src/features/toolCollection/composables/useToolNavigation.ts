/**
 * 工具合集 - 工具导航与键盘交互 composable
 * 封装循环切换、键盘监听（Escape/ArrowLeft/ArrowRight/ArrowUp/ArrowDown）
 */
import type { Ref } from "vue"
import type { ToolMeta } from "../types"
import {
  computed,
  onBeforeUnmount,
  ref,
} from "vue"

export interface ToolNavigationReturn {
  currentTool: Ref<string>
  currentIndex: Ref<number>
  prevTool: () => void
  nextTool: () => void
  handleKeydown: (e: KeyboardEvent) => void
}

export function useToolNavigation(
  tools: Ref<ToolMeta[]>,
  visible: Ref<boolean>,
  close: () => void
): ToolNavigationReturn {
  const currentTool = ref(tools.value[0]?.id ?? "")

  const currentIndex = computed(() =>
    tools.value.findIndex((t) => t.id === currentTool.value)
  )

  const prevTool = () => {
    const idx = currentIndex.value
    const list = tools.value
    const prev = idx <= 0 ? list.length - 1 : idx - 1
    currentTool.value = list[prev].id
  }

  const nextTool = () => {
    const idx = currentIndex.value
    const list = tools.value
    const next = idx >= list.length - 1 ? 0 : idx + 1
    currentTool.value = list[next].id
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (!visible.value) return
    const target = e.target as HTMLElement
    const tagName = target.tagName
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable) return

    if (e.key === "Escape") {
      e.preventDefault()
      close()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      // ← / ↑ 均为上一个工具（纵向列表布局下 ↑↓ 为自然导航方向）
      e.preventDefault()
      prevTool()
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      // → / ↓ 均为下一个工具
      e.preventDefault()
      nextTool()
    } else if (e.key === "Home") {
      e.preventDefault()
      currentTool.value = tools.value[0].id
    } else if (e.key === "End") {
      e.preventDefault()
      currentTool.value = tools.value[tools.value.length - 1].id
    } else if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
      // Ctrl+1~9 直接跳转第 N 个工具
      e.preventDefault()
      const idx = Number(e.key) - 1
      if (idx < tools.value.length) currentTool.value = tools.value[idx].id
    }
  }

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeydown)
  })

  return {
    currentTool,
    currentIndex,
    prevTool,
    nextTool,
    handleKeydown,
  }
}
