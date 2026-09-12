// MegaMenu 开合与键盘编排（组合式函数，非纯函数 —— 会挂事件监听）
//
// 抽出的理由：悬停意图判定、键盘漫游、点击外部关闭三件事都带生命周期，
// 混在组件 setup 里会让「何时开 / 何时关 / 焦点在哪」散落多处。
// （对齐 speedDial/useSpeedDial 的「私有逻辑外置、组件只做编排」先例）
import type { Ref } from "vue"
import {
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
} from "vue"
import type { MegaMenuItem } from "./types"

export interface UseMegaMenuOptions {
  /** 根菜单项（用于判定哪些项可展开） */
  model: () => MegaMenuItem[]
  /** 是否禁用 */
  disabled: () => boolean
  /** 是否响应悬停展开（官方默认开启） */
  openOnHover: () => boolean
  /** 展开态变更通知（组件据此 emit） */
  onOpenChange?: (key: string | null) => void
}

/** 悬停关闭的延迟（ms）：给鼠标从根项移到面板的途中留出容错，避免面板闪退 */
const CLOSE_DELAY = 120

export function useMegaMenu(options: UseMegaMenuOptions) {
  const menuId = `${useId()}-megamenu`
  const buttonId = `${useId()}-megamenubutton`

  /** 当前展开的根项 key（null = 全部收起）。**非受控自持**，与 Panel.collapsed 同一范式 */
  const activeKey = ref<string | null>(null)
  /**
   * 当前持有焦点的项路径：`根下标` 或 `根下标-列下标-叶子下标`。
   * 用字符串而非数字数组，便于模板直接比对高亮。
   */
  const focusedPath = ref<string | null>(null)

  /** 延迟关闭的定时器（悬停离开根项时启动，进入面板或重新悬停时取消） */
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const cancelClose = () => {
    if (closeTimer !== null) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  const isExpandable = (item: MegaMenuItem) => !!item.items && item.items.length > 0

  const setActive = (key: string | null) => {
    if (activeKey.value === key) return
    activeKey.value = key
    options.onOpenChange?.(key)
  }

  /** 立即展开某项（禁用项 / 不可展开项不处理） */
  const open = (key: string) => {
    if (options.disabled()) return
    const item = options.model().find((entry) => entry.key === key)
    if (!item || item.disabled || !isExpandable(item)) return
    cancelClose()
    setActive(key)
  }

  /** 立即收起（不延迟） */
  const close = () => {
    cancelClose()
    setActive(null)
    focusedPath.value = null
  }

  /**
   * 悬停进入根项：取消待执行的关闭并展开。
   * ⚠️ 只改 activeKey，**不抢键盘焦点** —— 鼠标划过时移动焦点会打断键盘用户。
   */
  const handleItemEnter = (item: MegaMenuItem) => {
    if (!options.openOnHover()) return
    if (item.disabled || !isExpandable(item)) {
      // 悬停到普通叶子项 / 禁用项时收起已展开的面板（符合导航菜单直觉）
      scheduleClose()
      return
    }
    open(item.key)
  }

  /** 悬停离开根项：延迟关闭，给移向面板的鼠标留出时间 */
  const scheduleClose = () => {
    cancelClose()
    closeTimer = setTimeout(() => {
      closeTimer = null
      close()
    }, CLOSE_DELAY)
  }

  /** 进入面板：取消关闭（面板是同一交互上下文的一部分） */
  const handlePanelEnter = () => {
    cancelClose()
  }

  /** 离开面板：延迟关闭（若鼠标回到根项，会在 handleItemEnter 里被取消） */
  const handlePanelLeave = () => {
    scheduleClose()
  }

  /** 点击根项：切换展开态（点击是悬停之外的第二条路径，也服务触屏） */
  const handleItemClick = (item: MegaMenuItem, event: MouseEvent) => {
    if (options.disabled() || item.disabled) return
    if (isExpandable(item)) {
      cancelClose()
      setActive(activeKey.value === item.key ? null : item.key)
      return
    }
    item.command?.(item, event)
    close()
  }

  /** 叶子项点击：执行回调并收起整个菜单 */
  const handleLeafClick = (item: MegaMenuItem, event: MouseEvent) => {
    if (item.disabled) return
    item.command?.(item, event)
    close()
  }

  /** 根项获得焦点即记录路径（作为方向键移动起点） */
  const markRootFocus = (index: number) => {
    focusedPath.value = String(index)
  }

  const markLeafFocus = (rootIndex: number, columnIndex: number, leafIndex: number) => {
    focusedPath.value = `${rootIndex}-${columnIndex}-${leafIndex}`
  }

  /** 根元素（点击外部判定 + 面板内焦点查询的查询根） */
  const rootRef: Ref<HTMLElement | null> = ref(null)
  const itemRefs: Ref<(HTMLElement | null)[]> = ref([])

  /**
   * 面板内可聚焦叶子（跨列拍平，保证方向键能跨列移动）。
   * 只取未禁用项；分组标题不可聚焦。
   */
  const flatFocusableLeaves = (rootIndex: number): HTMLElement[] => {
    const root = rootRef.value
    if (!root) return []
    const panel = root.querySelector<HTMLElement>(`[data-mm-panel="${rootIndex}"]`)
    if (!panel) return []
    return Array.from(panel.querySelectorAll<HTMLElement>("[data-mm-leaf]:not([data-mm-disabled])"))
  }

  const focusRoot = (index: number) => {
    const total = options.model().length
    if (!total) return
    const next = ((index % total) + total) % total
    itemRefs.value[next]?.focus()
  }

  /** 从根项进入其面板的第一项（无面板时不动） */
  const focusFirstLeaf = (rootIndex: number) => {
    const leaves = flatFocusableLeaves(rootIndex)
    leaves[0]?.focus()
  }

  /**
   * 键盘统一入口（挂在根元素上，冒泡捕获根项与面板内叶子）。
   * 语义：桌面导航菜单惯例 —— ←→/↑↓ 移动、Home/End 跳首末、Esc 关闭并返还焦点、
   * Enter/Space 由原生 button 直接派发 click（无需处理）。
   */
  const handleKeydown = (event: KeyboardEvent) => {
    if (options.disabled()) return

    const target = event.target as HTMLElement | null
    const rootIndexAttr = target?.getAttribute?.("data-mm-root")
    const leafAttr = target?.getAttribute?.("data-mm-leaf")

    if (event.key === "Escape") {
      if (activeKey.value === null) return
      event.stopPropagation()
      const restore = activeKey.value
      close()
      // 焦点回到触发它的根项
      const index = options.model().findIndex((entry) => entry.key === restore)
      if (index >= 0) itemRefs.value[index]?.focus()
      return
    }

    if (event.key === "Tab") {
      // Tab 交还给浏览器默认行为，但顺手收面板，避免焦点走后留下孤立浮层
      close()
      return
    }

    // ===== 焦点在面板内：↑↓ 跨列漫游（←→ 也接受，便于从左列直接跳右列）=====
    if (leafAttr !== null && leafAttr !== undefined) {
      const rootIndex = Number(target?.getAttribute("data-mm-root-of") ?? -1)
      if (rootIndex < 0) return
      const leaves = flatFocusableLeaves(rootIndex)
      const current = leaves.indexOf(target as HTMLElement)
      if (current < 0) return

      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault()
          leaves[Math.min(current + 1, leaves.length - 1)]?.focus()
          return
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault()
          if (current === 0) {
            // 从面板首项 ↑ 回到根项，符合「面板属于根项」的层级直觉
            itemRefs.value[rootIndex]?.focus()
            return
          }
          leaves[current - 1]?.focus()
          return
        case "Home":
          event.preventDefault()
          leaves[0]?.focus()
          return
        case "End":
          event.preventDefault()
          leaves[leaves.length - 1]?.focus()
          return
        default:
          return
      }
    }

    // ===== 焦点在根项：←→ 在根项间移动，↓↓ / Enter 进入面板 =====
    if (rootIndexAttr === null || rootIndexAttr === undefined) return
    const rootIndex = Number(rootIndexAttr)
    if (Number.isNaN(rootIndex)) return

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault()
        focusRoot(rootIndex + 1)
        return
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault()
        focusRoot(rootIndex - 1)
        return
      case "Home":
        event.preventDefault()
        focusRoot(0)
        return
      case "End":
        event.preventDefault()
        focusRoot(options.model().length - 1)
        return
      default:
        return
    }
  }

  /** 点击组件外部：完全关闭 */
  const handleDocumentClick = (event: MouseEvent) => {
    if (activeKey.value === null) return
    const target = event.target as Node | null
    if (target && rootRef.value?.contains(target)) return
    close()
  }

  onMounted(() => {
    document.addEventListener("click", handleDocumentClick)
  })

  onBeforeUnmount(() => {
    document.removeEventListener("click", handleDocumentClick)
    cancelClose()
  })

  return {
    activeKey,
    focusedPath,
    menuId,
    buttonId,
    rootRef,
    itemRefs,
    isExpandable,
    open,
    close,
    handleItemEnter,
    handleItemClick,
    handlePanelEnter,
    handlePanelLeave,
    handleLeafClick,
    markRootFocus,
    markLeafFocus,
    focusFirstLeaf,
    handleKeydown,
  }
}
