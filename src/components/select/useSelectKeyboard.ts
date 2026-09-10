/**
 * Select 私有键盘控制器 —— 收起态/展开态的方向键、Enter/Space、Esc、Tab 语义
 * 与视图解耦：只通过回调驱动开合、选中与激活项，便于单独推演键盘行为。
 * 本目录为组件私有实现，禁止 feature 直接导入（公开入口仍是 @/components/Select.vue）。
 */
import type {
  AnchorFallback,
  FlatOptionItem,
} from "./navigation"
import type { SelectOption } from "./types"

interface UseSelectKeyboardOptions {
  /** 面板是否展开 */
  isOpen: () => boolean
  /** 是否禁用 */
  disabled: () => boolean
  /** 平铺选项（渲染顺序 = 导航顺序） */
  flatItems: () => FlatOptionItem[]
  /** 当前激活下标 */
  activeIndex: () => number
  /** 设置激活下标（实现方负责滚动入视野） */
  setActiveIndex: (index: number) => void
  /** 打开面板（无已选项时按 fallback 落到首/末项） */
  open: (fallback: AnchorFallback) => void
  /** 关闭面板（restoreFocus 为真时把焦点收回触发器） */
  close: (options?: { restoreFocus?: boolean }) => void
  /** 切换开合 */
  toggle: () => void
  /** 选中某选项（restoreFocus 为真时把焦点收回触发器） */
  select: (option: SelectOption, options?: { restoreFocus?: boolean }) => void
}

export function useSelectKeyboard(options: UseSelectKeyboardOptions) {
  /** 当前激活项对应的选项对象 */
  const resolveActiveOption = (): SelectOption | undefined => {
    const index = options.activeIndex()
    return index > -1 ? options.flatItems()[index]?.option : undefined
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (options.disabled()) {
      return
    }

    switch (event.key) {
      case "Enter":
      case " ": {
        event.preventDefault()
        const option = resolveActiveOption()
        if (options.isOpen() && option) {
          // 禁用项不响应确认，保持面板打开
          if (!option.disabled) {
            options.select(option, { restoreFocus: true })
          }
        } else {
          options.toggle()
        }
        break
      }
      case "Escape":
        event.preventDefault()
        options.close({ restoreFocus: true })
        break
      case "ArrowDown":
        event.preventDefault()
        if (options.isOpen()) {
          options.setActiveIndex(
            Math.min(options.activeIndex() + 1, options.flatItems().length - 1),
          )
        } else {
          options.open("first")
        }
        break
      case "ArrowUp":
        event.preventDefault()
        if (options.isOpen()) {
          options.setActiveIndex(Math.max(options.activeIndex() - 1, 0))
        } else {
          // 收起态 ↑ 打开并落到末项（对齐 PrimeVue）
          options.open("last")
        }
        break
      case "Tab":
        options.close()
        break
    }
  }

  /**
   * 筛选框按键委托：只接管方向键 / Enter / Esc / Tab。
   * 必须放行 Space 与其它可打印字符，否则筛选框无法输入空格。
   */
  const handleFilterKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case "Escape":
        handleKeydown(event)
        break
      case "Tab":
        options.close()
        break
    }
  }

  return {
    handleKeydown,
    handleFilterKeydown,
  }
}
