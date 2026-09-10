// SpeedDial 开合编排：受控 visible + 内部兜底、点击外部关闭、Esc 返还焦点、项间方向键导航
// （SpeedDial.vue 的私有模块，禁止 feature 直接导入）

import type { Ref } from "vue"
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue"

/** 仅需 focus 能力的结构化子集（内部共享 Button 的 expose 契约） */
export interface FocusableHandle {
  focus: () => void
}

interface UseSpeedDialOptions {
  /** 根元素，用于判定「点击组件外部」 */
  rootRef: Ref<HTMLElement | undefined>
  /** 主按钮句柄（Esc 后返还焦点） */
  triggerRef: Ref<FocusableHandle | undefined>
  /** 动作项句柄（按渲染顺序；方向键在其间移动焦点） */
  itemRefs: Ref<Array<FocusableHandle | undefined>>
  /** 受控可见性（父级传入） */
  visible: () => boolean
  /** 可见性变更通知（组件据此 emit update:visible / show / hide） */
  onVisibleChange: (value: boolean) => void
  /** 点击组件外部是否收起 */
  hideOnClickOutside: () => boolean
  /** 是否禁用 */
  disabled: () => boolean
}

export function useSpeedDial(options: UseSpeedDialOptions) {
  const {
    rootRef,
    triggerRef,
    itemRefs,
    visible,
    onVisibleChange,
    hideOnClickOutside,
    disabled,
  } = options

  const menuId = `${useId()}-menu`
  const triggerId = `${useId()}-trigger`

  /** 内部兜底状态：既支持 v-model:visible 受控，也支持不传时组件独立开合 */
  const isOpen = ref(visible())
  /** 当前持有焦点的动作项下标（-1 表示焦点不在动作项内） */
  const activeIndex = ref(-1)

  watch(visible, (value) => {
    isOpen.value = value
  })

  const focusItem = (index: number) => {
    const total = itemRefs.value.length
    if (!total) {
      return
    }
    const next = ((index % total) + total) % total
    activeIndex.value = next
    nextTick(() => itemRefs.value[next]?.focus())
  }

  const setOpen = (value: boolean, restoreFocus = false) => {
    isOpen.value = value
    activeIndex.value = -1
    onVisibleChange(value)

    if (value || !restoreFocus) {
      return
    }
    nextTick(() => triggerRef.value?.focus())
  }

  const open = (focusFirst = false) => {
    if (disabled() || isOpen.value) {
      return
    }
    setOpen(true)
    if (focusFirst) {
      focusItem(0)
    }
  }

  const close = (restoreFocus = false) => {
    if (!isOpen.value) {
      return
    }
    setOpen(false, restoreFocus)
  }

  const toggle = (focusFirst = false) => {
    if (isOpen.value) {
      close(false)
      return
    }
    open(focusFirst)
  }

  /** 动作项获得焦点时记录下标（作为方向键移动的起点） */
  const markActive = (index: number) => {
    activeIndex.value = index
  }

  /**
   * 键盘统一入口（挂在根元素上，冒泡捕获主按钮与动作项的按键）：
   * Esc 关闭并返还焦点；方向键 / Home / End 在动作项间移动焦点。
   * Enter / Space 无需处理 —— 原生 button 会直接派发 click。
   */
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (!isOpen.value) {
        return
      }
      event.stopPropagation()
      close(true)
      return
    }

    if (!isOpen.value) {
      return
    }

    const total = itemRefs.value.length
    if (!total) {
      return
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault()
        focusItem(activeIndex.value < 0 ? 0 : activeIndex.value + 1)
        break
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault()
        focusItem(activeIndex.value < 0 ? total - 1 : activeIndex.value - 1)
        break
      case "Home":
        event.preventDefault()
        focusItem(0)
        break
      case "End":
        event.preventDefault()
        focusItem(total - 1)
        break
      default:
        break
    }
  }

  const handleDocumentClick = (event: MouseEvent) => {
    if (!isOpen.value || !hideOnClickOutside()) {
      return
    }
    const target = event.target as Node | null
    if (!target || rootRef.value?.contains(target)) {
      return
    }
    close(false)
  }

  onMounted(() => {
    document.addEventListener("click", handleDocumentClick)
  })

  onBeforeUnmount(() => {
    document.removeEventListener("click", handleDocumentClick)
  })

  // 禁用时强制收起，避免留下不可操作的动作列表
  watch(disabled, (value) => {
    if (value) {
      close(false)
    }
  })

  return {
    isOpen,
    activeIndex,
    menuId,
    triggerId,
    close,
    toggle,
    markActive,
    handleKeydown,
  }
}
