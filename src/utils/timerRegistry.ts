/**
 * 统一定时器注册与清理工具
 * 集中托管 setInterval/setTimeout 句柄，随功能实例生命周期统一清理
 */
// 浏览器（Electron 渲染进程）定时器句柄为 number；
// 不可用 ReturnType<typeof setInterval>——@types/node 的全局声明会覆盖为 Timeout 对象
export type TimerHandle = number

/**
 * 定时器宿主：渲染进程直接用 window；纯 Node（Vitest 纯函数单测）退化为 globalThis。
 * 不写死 window.* 是因为本工具也被无 DOM 的单测覆盖（如 sqliteDb 的空闲释放）。
 */
function timerHost(): Pick<Window, "setTimeout" | "clearTimeout" | "setInterval" | "clearInterval"> {
  return typeof window === "undefined" ? (globalThis as unknown as Window) : window
}

export class TimerRegistry {
  private readonly timers = new Set<TimerHandle>()

  /** 注册周期定时器，返回统一句柄（生命周期由本实例托管） */
  setInterval(cb: () => void, ms: number): TimerHandle {
    const handle = timerHost().setInterval(cb, ms)
    this.timers.add(handle)
    return handle
  }

  /** 注册一次性定时器，返回统一句柄（生命周期由本实例托管） */
  setTimeout(cb: () => void, ms: number): TimerHandle {
    // 触发时先摘除句柄：一次性定时器完成后不应继续留在集合里（长会话下 Set 会无界增长）
    const handle = timerHost().setTimeout(() => {
      this.timers.delete(handle)
      cb()
    }, ms)
    this.timers.add(handle)
    return handle
  }

  /** 清理单个句柄（不存在或为 null 时静默忽略，幂等） */
  clear(handle: TimerHandle | null): void {
    if (handle === null) return
    if (!this.timers.delete(handle)) return
    timerHost().clearInterval(handle)
    timerHost().clearTimeout(handle)
  }

  /** 清理全部句柄，供功能实例 destroy/stop 统一调用 */
  clearAll(): void {
    for (const handle of this.timers) {
      timerHost().clearInterval(handle)
      timerHost().clearTimeout(handle)
    }
    this.timers.clear()
  }
}
