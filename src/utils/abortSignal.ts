// 统一超时取消信号：组合外部 AbortSignal 与超时，区分用户取消与服务超时

/** 超时信号控制器（signal 传给请求，timedOut 区分取消原因） */
export interface TimeoutSignal {
  signal: AbortSignal
  /** 是否由超时触发（用户主动取消时为 false） */
  timedOut: () => boolean
  /** 重置计时（流式响应每收到数据时调用） */
  reset: () => void
  /** 清理计时器与外部监听 */
  cleanup: () => void
}

/**
 * 组合外部 AbortSignal 与超时控制
 * - 外部主动取消：只中止，不标记 timedOut
 * - 超时触发：中止并标记 timedOut，调用方据此抛出明确的超时错误
 */
export function createTimeoutSignal(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): TimeoutSignal {
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const armTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
  }

  const handleExternalAbort = (): void => controller.abort()

  if (externalSignal?.aborted) {
    controller.abort()
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", handleExternalAbort, { once: true })
  }
  armTimer()

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    reset: armTimer,
    cleanup: () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      externalSignal?.removeEventListener("abort", handleExternalAbort)
    },
  }
}

/** 是否为用户主动取消（超时以 TimeoutError 表示，不在此列） */
export function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError"
}

/** 构造超时错误，避免与主动取消的 AbortError 混同 */
export function createTimeoutError(message: string): DOMException {
  return new DOMException(message, "TimeoutError")
}
