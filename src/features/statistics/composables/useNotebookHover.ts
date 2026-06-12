import type { InjectionKey, Ref } from "vue"
import { inject, provide, ref } from "vue"

interface NotebookHoverState {
  hoveredNotebook: Ref<string | null>
  onHover: (name: string | null) => void
}

const KEY: InjectionKey<NotebookHoverState> = Symbol("notebook-hover")

/** 清除延迟 (ms) —— 鼠标离开后短暂保留高亮，避免快速划过时闪烁 */
const CLEAR_DELAY = 80

/** 在父组件中调用，创建并注入共享 hover 状态 */
export function provideNotebookHover(): NotebookHoverState {
  const hoveredNotebook = ref<string | null>(null)
  let clearTimer: ReturnType<typeof setTimeout> | null = null

  function onHover(name: string | null) {
    // 取消之前挂起的清除
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }

    if (name === null) {
      // 延迟清除，给下一次 mouseenter 机会取消
      clearTimer = setTimeout(() => {
        hoveredNotebook.value = null
        clearTimer = null
      }, CLEAR_DELAY)
    } else {
      // 进入新项目 —— 立即设置
      hoveredNotebook.value = name
    }
  }

  const state: NotebookHoverState = { hoveredNotebook, onHover }
  provide(KEY, state)
  return state
}

/** 在子组件中调用，获取共享 hover 状态 */
export function useNotebookHover(): NotebookHoverState {
  const fallback: NotebookHoverState = {
    hoveredNotebook: ref<string | null>(null),
    onHover: () => {},
  }
  return inject(KEY, fallback)
}
