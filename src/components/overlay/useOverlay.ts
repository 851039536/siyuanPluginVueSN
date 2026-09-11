// 弹层共享外壳：遮罩点关判定 + Esc 监听 + 焦点接管与归还
// （Dialog / ConfirmDialog 共用的组件库私有能力，禁止 feature 直接导入）
// 只抽「行为」，不抽遮罩 DOM 结构：两个组件内部结构差异大（ConfirmBody / header+content+footer）
import type {
  Ref,
} from "vue"
import {
  nextTick,
  onBeforeUnmount,
  watch,
} from "vue"

export interface OverlayOptions {
  /** 是否显示（受控值 getter） */
  visible: () => boolean
  /** 是否允许点击遮罩关闭（调用方可再叠加自身条件，如「模态才允许」） */
  dismissableMask: () => boolean
  /** 是否允许按 Esc 关闭 */
  closeOnEscape: () => boolean
  /** 关闭请求：组件内统一收敛为 `emit("update:visible", false)` */
  onDismiss: () => void
  /** 弹层容器（`tabindex="-1"` 的卡片），用于初始焦点兜底 */
  containerRef: Ref<HTMLElement | null>
  /** 初始焦点查找：默认聚焦容器；Dialog 传「容器内 [autofocus]（footer → header → content）→ 容器」 */
  initialFocus?: () => HTMLElement | null
}

export interface OverlayShell {
  /** 遮罩 mousedown：记录按下目标 */
  handleMaskMouseDown: (event: MouseEvent) => void
  /** 遮罩 mouseup：与按下目标一致且允许点关时才关闭 */
  handleMaskMouseUp: (event: MouseEvent) => void
  /** Esc 处理：已挂在 window 上，导出以便调用方在特定元素上另绑（如容器 keydown） */
  handleKeydown: (event: KeyboardEvent) => void
}

/**
 * 弹层外壳行为：打开时接管焦点、关闭时归还焦点，并处理 Esc 与遮罩点关。
 * 不做 FocusTrap / 滚动锁定 / 层级管理（属各组件的有意裁剪）。
 */
export function useOverlay(options: OverlayOptions): OverlayShell {
  /** 打开前的焦点元素，关闭时归还，避免键盘用户丢失位置 */
  let previousActive: HTMLElement | null = null
  /**
   * 遮罩按下的目标：抬起时需与按下目标一致才算「点了遮罩」。
   * 官方语义 —— 在弹层内按下、拖到遮罩上抬起不会误关。
   */
  let maskMouseDownTarget: EventTarget | null = null

  const handleMaskMouseDown = (event: MouseEvent): void => {
    maskMouseDownTarget = event.target
  }

  const handleMaskMouseUp = (event: MouseEvent): void => {
    const pressedTarget = maskMouseDownTarget
    maskMouseDownTarget = null
    if (!options.dismissableMask() || !pressedTarget || pressedTarget !== event.target) return
    options.onDismiss()
  }

  /**
   * 仅监听 Esc：Enter 交由聚焦元素的原生键盘行为触发，
   * 避免 window 监听与按钮 click 重复派发确认
   */
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return
    if (!options.closeOnEscape()) return
    event.preventDefault()
    options.onDismiss()
  }

  const bindListener = (): void => {
    window.addEventListener("keydown", handleKeydown)
  }

  const unbindListener = (): void => {
    window.removeEventListener("keydown", handleKeydown)
  }

  watch(
    options.visible,
    async (visible) => {
      if (visible) {
        previousActive = document.activeElement as HTMLElement | null
        bindListener()
        await nextTick()
        // 焦点交给容器或容器内标记了 autofocus 的元素，而不是无条件聚焦首个按钮
        const target = options.initialFocus?.() ?? options.containerRef.value
        target?.focus()
      } else {
        unbindListener()
        previousActive?.focus()
        previousActive = null
      }
    },
    { immediate: true },
  )

  // 卸载兜底：组件在打开状态下被销毁时不残留全局监听
  onBeforeUnmount(unbindListener)

  return {
    handleMaskMouseDown,
    handleMaskMouseUp,
    handleKeydown,
  }
}
