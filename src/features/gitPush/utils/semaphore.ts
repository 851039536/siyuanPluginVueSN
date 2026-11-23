// 轻量并发信号量（纯逻辑）：用于把 N 个按需 diff 请求压到固定并发，
// 避免变更集失败后逐文件回退时一次性 spawn 大量 git 进程挤占其他操作。

export interface Semaphore {
  /** 取得一个槽位，返回幂等的释放函数（务必在 finally 中调用） */
  acquire: () => Promise<() => void>
}

/**
 * @param limit 同时持有的最大槽位数（<1 时按 1 处理）
 */
export function createSemaphore(limit: number): Semaphore {
  const max = Math.max(1, Math.floor(limit))
  let active = 0
  const waiters: Array<() => void> = []

  const release = (): void => {
    const next = waiters.shift()
    // 有等待者时槽位直接转交（active 不变）；否则归还
    if (next) next()
    else active--
  }

  return {
    acquire(): Promise<() => void> {
      if (active < max) {
        active++
        return Promise.resolve(release)
      }
      return new Promise<() => void>((resolve) => {
        waiters.push(() => resolve(release))
      })
    },
  }
}
