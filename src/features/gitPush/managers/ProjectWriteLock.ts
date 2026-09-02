// 项目级写锁：按项目路径键控的 Promise 串行链（写写互斥、读写并行）
// 防止对同一仓库并发写操作（commit/stash/discard 与 push/pull 交叉）触发 git index.lock 竞争

/** 按项目路径键控的写锁。同一路径的写操作排队串行执行，不同路径互不影响；前驱失败不阻塞后续任务 */
export class ProjectWriteLock {
  /** path → 当前链尾（已吞错包装，保证后续任务不被前驱失败卡死） */
  private chains: Map<string, Promise<unknown>> = new Map()
  /** 销毁标志：destroy 后拒绝新任务（插件卸载兜底） */
  private destroyed = false

  /** 在 projectPath 的写锁内执行 fn，返回 fn 的原始结果/错误（不改变对外错误语义） */
  runExclusive<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
    if (this.destroyed) {
      return Promise.reject(new Error("插件已卸载，操作已取消"))
    }
    const gate = (this.chains.get(projectPath) || Promise.resolve()).catch(() => {})
    const next = gate.then(fn)
    this.chains.set(projectPath, next.catch(() => {}))
    return next
  }

  /** 销毁锁：拒绝新任务并清空链（进行中的任务自然结束，由 GitExecutor.destroy 兜底 kill） */
  destroy(): void {
    this.destroyed = true
    this.chains.clear()
  }
}
