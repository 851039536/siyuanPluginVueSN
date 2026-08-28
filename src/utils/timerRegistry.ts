/**
 * 统一定时器注册与清理工具
 * 集中托管 setInterval/setTimeout 句柄，随功能实例生命周期统一清理
 */
// 浏览器（Electron 渲染进程）定时器句柄为 number；
// 不可用 ReturnType<typeof setInterval>——@types/node 的全局声明会覆盖为 Timeout 对象
export type TimerHandle = number

export class TimerRegistry {
  private readonly timers = new Set<TimerHandle>()

  /** 注册周期定时器，返回统一句柄（生命周期由本实例托管） */
  setInterval(cb: () => void, ms: number): TimerHandle {
    const handle = window.setInterval(cb, ms)
    this.timers.add(handle)
    return handle
  }

  /** 注册一次性定时器，返回统一句柄（生命周期由本实例托管） */
  setTimeout(cb: () => void, ms: number): TimerHandle {
    const handle = window.setTimeout(cb, ms)
    this.timers.add(handle)
    return handle
  }

  /** 清理单个句柄（不存在或为 null 时静默忽略，幂等） */
  clear(handle: TimerHandle | null): void {
    if (handle === null) return
    if (!this.timers.delete(handle)) return
    window.clearInterval(handle)
    window.clearTimeout(handle)
  }

  /** 清理全部句柄，供功能实例 destroy/stop 统一调用 */
  clearAll(): void {
    for (const handle of this.timers) {
      window.clearInterval(handle)
      window.clearTimeout(handle)
    }
    this.timers.clear()
  }
}
