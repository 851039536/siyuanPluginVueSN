/**
 * 速记 — 指针会话底座（拖拽移动 / 缩放共用）
 * 统一处理 pointerId 过滤、window 级监听、pointercancel / 窗口失焦 / buttons===0 兜底与幂等清理；
 * 调用方只需实现位移阈值判断与坐标（尺寸）计算，状态落盘由 onEnd 回调负责
 */

export interface PointerSessionHandlers {
  /** 会话内指针移动（已过滤非本指针、非主按键） */
  onMove: (event: PointerEvent) => void
  /** 会话结束（抬起 / 取消 / 失焦），每次会话只触发一次 */
  onEnd: () => void
  /** 监听移除后的附加清理（如恢复 cursor），只触发一次 */
  onCleanup?: () => void
}

export interface PointerSession {
  /**
   * 主动结束会话并移除监听（destroy / 新会话抢占时调用）
   * 不触发 onEnd —— 主动打断不应继续落盘或派发状态
   */
  cleanup: () => void
}

/**
 * 开启一次指针会话（以 pointerdown 事件为起点）
 * 监听挂在 window 上而非把手上：指针移出把手（甚至移出面板）后仍能继续拖拽
 */
export function beginPointerSession(
  event: PointerEvent,
  handlers: PointerSessionHandlers,
): PointerSession {
  const pointerId = event.pointerId
  let finished = false
  // 先占位再由下方赋值：onMove 需要在 cleanup/finish 定义前引用结束入口（只会在事件触发时执行）
  let finish = (): void => {}

  const onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== pointerId) return
    // 在窗口外松手可能收不到 pointerup；重新进入窗口时 buttons 已归零，借此兜底结束会话
    if (ev.buttons === 0) {
      finish()
      return
    }
    handlers.onMove(ev)
  }

  const onUp = (ev: PointerEvent): void => {
    if (ev.pointerId === pointerId) finish()
  }

  const onCancel = (ev: PointerEvent): void => {
    if (ev.pointerId === pointerId) finish()
  }

  const onBlur = (): void => {
    // 窗口失焦（Alt+Tab / 打开系统对话框）后不再有 pointerup，直接结束并保留当前位置
    finish()
  }

  const cleanup = (): void => {
    if (finished) return
    finished = true
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
    window.removeEventListener("blur", onBlur)
    handlers.onCleanup?.()
  }

  finish = (): void => {
    if (finished) return
    cleanup()
    handlers.onEnd()
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onCancel)
  window.addEventListener("blur", onBlur)

  return { cleanup }
}
