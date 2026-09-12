// Tooltip 的锚点绑定与触发编排（组合式函数，非纯函数 —— 会挂事件监听与定时器）
//
// 抽出的理由：锚点监听、延迟定时器、有界轮询三件事都带生命周期，混在组件的 setup 里
// 会让「何时绑定 / 何时清理」散落各处；集中在此后组件只负责模板与定位测量。
// （对齐 speedDial/useSpeedDial 的「私有逻辑外置、组件只做编排」先例）
import type { Ref } from "vue"
import {
  onBeforeUnmount,
  onMounted,
} from "vue"

/** 锚点查找：组件把 `target` prop 的两种形态（元素 / 取值函数）归一到这里 */
export type AnchorResolver = () => HTMLElement | null

export interface TooltipTriggerOptions {
  /** 锚点查找函数 */
  resolveAnchor: AnchorResolver
  /** 是否显示（受控与自持统一后的最终值） */
  isOpen: Ref<boolean>
  /** 显示延迟（毫秒，0 为同步） */
  showDelay: () => number
  /** 隐藏延迟（毫秒，0 为同步） */
  hideDelay: () => number
  /** 触发方式 */
  trigger: () => "hover" | "focus" | "both"
  /** 是否禁用 */
  disabled: () => boolean
  /** 提交显示（组件内负责受控判断与事件派发） */
  onShow: () => void
  /** 提交隐藏 */
  onHide: () => void
}

/** 锚点晚于组件挂载出现时的补挂轮询：每 200ms 一次、上限 15 次（对齐仓库既有 DOM 就绪轮询约定） */
const ANCHOR_RETRY_INTERVAL = 200
const ANCHOR_RETRY_LIMIT = 15

export interface TooltipTriggerHandle {
  /** 立即清理定时器与监听（组件在打开状态下被卸载时由内部兜底调用） */
  dispose: () => void
}

/**
 * 把 hover / focus 触发器的监听挂到锚点上，并按 `showDelay` / `hideDelay` 控制派发时机。
 *
 * 三个易错点在此集中处理：
 * 1. **子元素间移动不算进出**：进出判定看 `relatedTarget` 是否仍在锚点内，
 *    否则悬停在锚点内的图标上会反复触发显示 / 隐藏而闪烁。
 * 2. **延迟期间的取消**：请求隐藏会清掉未触发的显示定时器，反之亦然，
 *    避免「刚移出却又弹出」。
 * 3. **锚点是外部元素**：必须在组件卸载时解绑，且锚点若晚于挂载出现要用有界轮询补挂。
 */
export function useTooltipTrigger(options: TooltipTriggerOptions): TooltipTriggerHandle {
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setInterval> | null = null
  let retryCount = 0
  /** 当前已绑定监听的锚点（换锚点时先解绑旧的） */
  let boundAnchor: HTMLElement | null = null

  const clearDelayTimers = () => {
    if (showTimer !== null) {
      clearTimeout(showTimer)
      showTimer = null
    }
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  const commitShow = () => {
    if (options.isOpen.value) return
    options.onShow()
  }

  const commitHide = () => {
    if (!options.isOpen.value) return
    options.onHide()
  }

  const requestShow = () => {
    if (options.disabled()) return
    // 迟到语义：显示请求取消尚未触发的隐藏（鼠标快速划出再划入）
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    if (options.isOpen.value || showTimer !== null) return
    const delay = options.showDelay()
    if (delay > 0) {
      showTimer = setTimeout(() => {
        showTimer = null
        commitShow()
      }, delay)
      return
    }
    commitShow()
  }

  const requestHide = () => {
    if (showTimer !== null) {
      clearTimeout(showTimer)
      showTimer = null
    }
    if (hideTimer !== null) return
    const delay = options.hideDelay()
    if (delay > 0) {
      hideTimer = setTimeout(() => {
        hideTimer = null
        commitHide()
      }, delay)
      return
    }
    commitHide()
  }

  const handlePointerEnter = (event: PointerEvent) => {
    if (options.trigger() === "focus") return
    const anchor = options.resolveAnchor()
    const from = event.relatedTarget as Node | null
    if (anchor && from && anchor.contains(from)) return
    requestShow()
  }

  const handlePointerLeave = (event: PointerEvent) => {
    if (options.trigger() === "focus") return
    const anchor = options.resolveAnchor()
    const to = event.relatedTarget as Node | null
    if (anchor && to && anchor.contains(to)) return
    requestHide()
  }

  /** focus 触发：键盘用户的信息可达路径，默认与 hover 并列开启 */
  const handleFocusIn = () => {
    if (options.trigger() === "hover") return
    requestShow()
  }

  const handleFocusOut = (event: FocusEvent) => {
    if (options.trigger() === "hover") return
    const anchor = options.resolveAnchor()
    const to = event.relatedTarget as Node | null
    if (anchor && to && anchor.contains(to)) return
    requestHide()
  }

  const unbindAnchor = () => {
    const anchor = boundAnchor
    if (!anchor) return
    anchor.removeEventListener("pointerenter", handlePointerEnter)
    anchor.removeEventListener("pointerleave", handlePointerLeave)
    anchor.removeEventListener("focusin", handleFocusIn)
    anchor.removeEventListener("focusout", handleFocusOut)
    boundAnchor = null
  }

  const bindAnchor = () => {
    const anchor = options.resolveAnchor()
    if (anchor === boundAnchor) return
    unbindAnchor()
    if (!anchor) return
    anchor.addEventListener("pointerenter", handlePointerEnter)
    anchor.addEventListener("pointerleave", handlePointerLeave)
    anchor.addEventListener("focusin", handleFocusIn)
    anchor.addEventListener("focusout", handleFocusOut)
    boundAnchor = anchor
  }

  const stopAnchorRetry = () => {
    if (retryTimer !== null) {
      clearInterval(retryTimer)
      retryTimer = null
    }
    retryCount = 0
  }

  const startAnchorRetry = () => {
    if (options.resolveAnchor()) {
      bindAnchor()
      return
    }
    if (retryTimer !== null) return
    retryTimer = setInterval(() => {
      retryCount += 1
      if (options.resolveAnchor() || retryCount >= ANCHOR_RETRY_LIMIT) {
        stopAnchorRetry()
        bindAnchor()
      }
    }, ANCHOR_RETRY_INTERVAL)
  }

  const dispose = () => {
    clearDelayTimers()
    unbindAnchor()
    stopAnchorRetry()
  }

  onMounted(startAnchorRetry)
  onBeforeUnmount(dispose)

  return { dispose }
}
