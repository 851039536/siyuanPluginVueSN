// Sidebar 开合编排（组合式函数，非纯函数 —— 会挂监听与定时器）
//
// 抽出的理由：受控/自持双模式、悬停展开意图延迟、叠层外部点击关闭三件事都带生命周期，
// 混在组件 setup 里会让「何时开 / 何时关」散落多处。
// （沿用 speedDial/useSpeedDial、megaMenu/useMegaMenu 的「私有逻辑外置」先例）
import type { Ref } from "vue"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"

export interface UseSidebarOptions {
  /** 受控开合（不传 undefined 表示非受控自持） */
  open: () => boolean | undefined
  /** 当前折叠行为 */
  collapsible: () => "offcanvas" | "icon" | "none"
  /** 是否浮层模式 */
  overlay: () => boolean
  /** 是否悬停展开 */
  openOnHover: () => boolean
  /** 悬停展开延迟（ms） */
  hoverOpenDelay: () => number
  /** 悬停收起延迟（ms） */
  hoverCloseDelay: () => number
  /** 点击叠层外部是否收起（仅 overlay 模式有意义） */
  dismissable: () => boolean
  /** 根元素（叠层外部点击判定 + 面板悬停判定） */
  rootRef: Ref<HTMLElement | null>
  /** 开合变更通知（组件据此 emit `update:open`） */
  onOpenChange: (value: boolean) => void
}

export function useSidebar(options: UseSidebarOptions) {
  /**
   * 内部自持状态（非受控模式使用）。
   * `collapsible: "none"` 时恒为真 —— 不可折叠的侧边栏没有「关闭」语义，
   * 若仍允许关闭会得到一个「关不掉又不可折叠」的死状态。
   */
  const innerOpen = ref(options.collapsible() !== "none")

  /** 最终展开态：受控优先，否则取内部状态（collapsible === "none" 强制展开） */
  const open = computed(() => {
    if (options.collapsible() === "none") return true
    const controlled = options.open()
    return controlled === undefined ? innerOpen.value : controlled
  })

  const isControlled = computed(() => options.open() !== undefined)

  /** 悬停开合的定时器（展开延迟 / 收起延迟各一） */
  let openTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (openTimer !== null) {
      clearTimeout(openTimer)
      openTimer = null
    }
    if (closeTimer !== null) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  const commit = (value: boolean) => {
    if (open.value === value) return
    if (!isControlled.value) innerOpen.value = value
    options.onOpenChange(value)
  }

  /** 立即展开 */
  const show = () => {
    clearTimers()
    commit(true)
  }

  /** 立即收起（`collapsible: "none"` 下为无操作） */
  const hide = () => {
    clearTimers()
    if (options.collapsible() === "none") return
    commit(false)
  }

  const toggle = () => {
    if (open.value) hide()
    else show()
  }

  /**
   * 悬停进入面板：延迟展开。
   * ⚠️ 只改开合态、**不抢焦点** —— 鼠标划过时移动焦点会打断键盘用户（同 MegaMenu 的约定）。
   */
  const handlePointerEnter = () => {
    if (!options.openOnHover()) return
    clearTimers()
    const delay = options.hoverOpenDelay()
    if (delay > 0) {
      openTimer = setTimeout(() => {
        openTimer = null
        commit(true)
      }, delay)
      return
    }
    commit(true)
  }

  /** 悬停离开面板：延迟收起（给鼠标重新移入留容错，避免边缘抖动导致闪合） */
  const handlePointerLeave = () => {
    if (!options.openOnHover()) return
    clearTimers()
    const delay = options.hoverCloseDelay()
    if (delay > 0) {
      closeTimer = setTimeout(() => {
        closeTimer = null
        if (options.collapsible() === "none") return
        commit(false)
      }, delay)
      return
    }
    if (options.collapsible() !== "none") commit(false)
  }

  // 受控值变化时清掉待执行的定时器，避免「父级已改状态、定时器又改回去」
  watch(() => options.open(), clearTimers)

  /**
   * 叠层模式的遮罩点击：**点击遮罩**（而非「组件外任意位置」）才收起。
   * 与 Dialog 的 `dismissableMask` 同一语义，但此处遮罩是组件自渲染的独立元素。
   */
  const handleMaskClick = () => {
    if (!options.dismissable()) return
    hide()
  }

  onMounted(() => {
    // 初始态与 collapsible 对齐由 computed 保证，无需额外处理
  })

  onBeforeUnmount(clearTimers)

  return {
    open,
    isControlled,
    show,
    hide,
    toggle,
    handlePointerEnter,
    handlePointerLeave,
    handleMaskClick,
  }
}
