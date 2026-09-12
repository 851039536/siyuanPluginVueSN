// TieredMenu 活动路径、键盘漫游与 popup 开合编排
// （组合式函数，非纯函数 —— 会挂监听与定时器）
//
// 抽出的理由：级联菜单的「当前展开路径」是一棵动态树，配合方向键漫游与 popup 外部点击关闭，
// 三者状态交织；集中在此可让组件只负责递归渲染。
// （沿用 megaMenu/useMegaMenu、speedDial/useSpeedDial 的「私有逻辑外置」先例）
import type { Ref } from "vue"
import {
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue"
import type { TieredMenuItem } from "./types"

export interface UseTieredMenuOptions {
  /** 根菜单项 */
  model: () => TieredMenuItem[]
  /** 是否禁用整个菜单 */
  disabled: () => boolean
  /** 是否 popup 模式（决定是否挂外部点击监听） */
  popup: () => boolean
  /** popup 开合变更通知 */
  onPopupChange?: (visible: boolean) => void
}

/** 悬停关闭子菜单的延迟（ms）：给鼠标从父项斜向移到子菜单的途中留出容错 */
const CLOSE_DELAY = 120

export function useTieredMenu(options: UseTieredMenuOptions) {
  /**
   * 当前活动路径（从根层到最深已展开层，元素为各层下标）。
   * 空数组 = 只有根层可见、无子菜单展开。
   * 用「路径」而非单一 key：级联菜单的展开状态天然是一条链。
   */
  const activePath = ref<number[]>([])
  /** 根元素（键盘查找 + 外部点击判定） */
  const rootRef: Ref<HTMLElement | null> = ref(null)
  /** popup 模式的显示态（非受控自持） */
  const popupVisible = ref(false)
  /** popup 菜单的视口坐标（由组件测量后写回） */
  const popupPosition = ref({ top: 0, left: 0 })
  /** 记录最后一次触发 popup 的事件（用于取坐标 + 焦点归还） */
  let lastTrigger: { top: number; left: number } | null = null

  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const cancelClose = () => {
    if (closeTimer !== null) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  const isSubmenu = (item: TieredMenuItem) => !!item.items && item.items.length > 0

  /** 按路径取节点（越界返回 null） */
  const nodeAt = (path: number[]): TieredMenuItem | null => {
    let level: TieredMenuItem[] | undefined = options.model()
    let node: TieredMenuItem | null = null
    for (const index of path) {
      if (!level) return null
      node = level[index] ?? null
      if (!node) return null
      level = node.items
    }
    return node
  }

  /** 展开某个子菜单路径（会截断该层之后的更深路径 —— 切换父项时旧子链自然失效） */
  const openSubmenu = (path: number[]) => {
    cancelClose()
    activePath.value = path
  }

  /** 收起全部子菜单 */
  const closeAll = () => {
    cancelClose()
    activePath.value = []
  }

  /** 收起某一层及其更深层（保留该层之前） */
  const closeFrom = (level: number) => {
    cancelClose()
    activePath.value = activePath.value.slice(0, level)
  }

  /**
   * 悬停进入某项：可下钻则展开其子菜单；
   * 悬停到叶子项 / 分隔线 / 禁用项则**收起同级与更深的子菜单**（符合级联菜单直觉）。
   * ⚠️ 只改展开路径、不抢焦点（同 MegaMenu 约定：鼠标划过抢焦点会打断键盘用户）。
   */
  const handleItemEnter = (item: TieredMenuItem, level: number, index: number) => {
    if (item.separator || item.disabled) {
      closeFrom(level)
      return
    }
    if (isSubmenu(item)) {
      openSubmenu([...activePath.value.slice(0, level), index])
      return
    }
    // 叶子项：收起本层往后的子菜单，但保留本层（本层菜单仍显示）
    closeFrom(level)
  }

  /** 延迟收起（鼠标离开子菜单时调用，进入新项时会被取消） */
  const scheduleClose = (level: number) => {
    cancelClose()
    closeTimer = setTimeout(() => {
      closeTimer = null
      closeFrom(level)
    }, CLOSE_DELAY)
  }

  /** 点击项：叶子执行 command 并收起全部；父项点击切换其子菜单 */
  const handleItemClick = (item: TieredMenuItem, level: number, index: number, event: MouseEvent) => {
    if (options.disabled() || item.disabled || item.separator) return
    if (isSubmenu(item)) {
      const path = [...activePath.value.slice(0, level), index]
      const alreadyOpen = activePath.value.length > level
        && activePath.value[level] === index
      if (alreadyOpen) closeFrom(level)
      else openSubmenu(path)
      return
    }
    item.command?.(item, event)
    closeAll()
    hidePopup()
  }

  // ==================== popup 模式 ====================

  /** 记录触发点（鼠标坐标或元素矩形中心） */
  const captureTriggerPoint = (event: Event) => {
    const mouse = event as MouseEvent
    if (typeof mouse.clientX === "number" && typeof mouse.clientY === "number" && (mouse.clientX || mouse.clientY)) {
      lastTrigger = { top: mouse.clientY, left: mouse.clientX }
      return lastTrigger
    }
    // 键盘 / 程序化触发：退化为触发元素左下角
    const target = (event.currentTarget ?? event.target) as HTMLElement | null
    const rect = target?.getBoundingClientRect()
    lastTrigger = rect
      ? { top: rect.bottom, left: rect.left }
      : { top: 0, left: 0 }
    return lastTrigger
  }

  const showPopup = (event: Event) => {
    if (options.disabled()) return
    captureTriggerPoint(event)
    popupVisible.value = true
    activePath.value = []
    options.onPopupChange?.(true)
  }

  const hidePopup = () => {
    if (!popupVisible.value) return
    popupVisible.value = false
    activePath.value = []
    cancelClose()
    options.onPopupChange?.(false)
  }

  const togglePopup = (event: Event) => {
    if (popupVisible.value) hidePopup()
    else showPopup(event)
  }

  /** popup 模式下把测量结果写回（组件在渲染后调用） */
  const setPopupPosition = (position: { top: number; left: number }) => {
    popupPosition.value = position
  }

  /** 取触发点（组件定位时读取） */
  const getTriggerPoint = () => lastTrigger ?? { top: 0, left: 0 }

  // ==================== 键盘漫游 ====================

  /** 取某层的可聚焦项下标（排除分隔线与禁用项） */
  const focusableIndexes = (level: number, path: number[] = []): number[] => {
    const parent = path.length ? nodeAt(path) : null
    const items = path.length ? (parent?.items ?? []) : options.model()
    void level
    return items
      .map((item, index) => (item.separator || item.disabled ? -1 : index))
      .filter((index) => index >= 0)
  }

  /**
   * 键盘统一入口（挂在根元素上，冒泡捕获所有层级）。
   * 语义遵循菜单惯例：
   * - ↓/↑：同层内移动（跳过分隔线与禁用项）
   * - →：进入子菜单首项（或末层时不动作）
   * - ←：退回父层
   * - Home/End：跳同层首末
   * - Esc：先收子菜单，无子菜单时收整个 popup
   * Enter/Space 交由原生 button 直接派发 click
   */
  const handleKeydown = (event: KeyboardEvent) => {
    if (options.disabled()) return
    const target = event.target as HTMLElement | null
    const levelAttr = target?.getAttribute?.("data-tm-level")
    if (levelAttr === null || levelAttr === undefined) return
    const level = Number(levelAttr)
    const indexAttr = target?.getAttribute?.("data-tm-index")
    const index = indexAttr === null || indexAttr === undefined ? -1 : Number(indexAttr)

    /** 本层路径 = activePath 的前 level 段（用于定位当前层的 items） */
    const layerPath = activePath.value.slice(0, level)
    const indexes = focusableIndexes(level, layerPath)
    if (!indexes.length) return
    const currentPos = indexes.indexOf(index)

    const focusAt = (level2: number, index2: number) => {
      const el = rootRef.value?.querySelector<HTMLElement>(
        `[data-tm-level="${level2}"][data-tm-index="${index2}"]`,
      )
      el?.focus()
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault()
        const next = indexes[(currentPos + 1) % indexes.length]
        focusAt(level, next)
        return
      }
      case "ArrowUp": {
        event.preventDefault()
        const prev = indexes[(currentPos - 1 + indexes.length) % indexes.length]
        focusAt(level, prev)
        return
      }
      case "Home": {
        event.preventDefault()
        focusAt(level, indexes[0])
        return
      }
      case "End": {
        event.preventDefault()
        focusAt(level, indexes[indexes.length - 1])
        return
      }
      case "ArrowRight": {
        // 进入子菜单首项
        const item = (layerPath.length ? nodeAt(layerPath)?.items : options.model())?.[index]
        if (!item || !isSubmenu(item)) return
        event.preventDefault()
        openSubmenu([...layerPath, index])
        const childIndexes = focusableIndexes(level + 1, [...layerPath, index])
        if (childIndexes.length) {
          requestAnimationFrame(() => focusAt(level + 1, childIndexes[0]))
        }
        return
      }
      case "ArrowLeft": {
        // 退回父层：焦点给展开当前层的那个父项
        if (level === 0) return
        event.preventDefault()
        const parentIndex = layerPath[level - 1]
        closeFrom(level - 1)
        focusAt(level - 1, parentIndex)
        return
      }
      case "Escape": {
        event.preventDefault()
        event.stopPropagation()
        if (activePath.value.length > 0) {
          closeAll()
          return
        }
        hidePopup()
        return
      }
      default:
        return
    }
  }

  /** popup 模式点击外部关闭 */
  const handleDocumentPointerDown = (event: PointerEvent) => {
    if (!options.popup() || !popupVisible.value) return
    const target = event.target as Node | null
    if (target && rootRef.value?.contains(target)) return
    hidePopup()
  }

  onMounted(() => {
    document.addEventListener("pointerdown", handleDocumentPointerDown, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", handleDocumentPointerDown, true)
    cancelClose()
  })

  return {
    activePath,
    popupVisible,
    popupPosition,
    rootRef,
    isSubmenu,
    openSubmenu,
    closeAll,
    closeFrom,
    handleItemEnter,
    scheduleClose,
    // 供模板在指针移入子菜单面板时取消挂起的关闭定时器（否则面板会闪退）
    cancelClose,
    handleItemClick,
    showPopup,
    hidePopup,
    togglePopup,
    setPopupPosition,
    getTriggerPoint,
    handleKeydown,
  }
}
