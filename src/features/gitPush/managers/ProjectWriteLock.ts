// 项目级写锁：按项目路径键控的 Promise 串行链（写写互斥、读写并行）
// 防止对同一仓库并发写操作（commit/stash/discard 与 push/pull 交叉）触发 git index.lock 竞争
import { normalizePathKey } from "../utils/pushProfile"

/** 按项目路径键控的写锁。同一路径的写操作排队串行执行，不同路径互不影响；前驱失败不阻塞后续任务 */
export class ProjectWriteLock {
  /** 归一化 path 键 → 当前链尾（已吞错包装，保证后续任务不被前驱失败卡死） */
  private chains: Map<string, Promise<unknown>> = new Map()
  /** 销毁标志：destroy 后拒绝新任务（插件卸载兜底） */
  private destroyed = false

  /** 在 projectPath 的写锁内执行 fn，返回 fn 的原始结果/错误（不改变对外错误语义） */
  runExclusive<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
    if (this.destroyed) {
      return Promise.reject(new Error("插件已卸载，操作已取消"))
    }
    // key 必须归一化：Windows 下 `E:\repo` / `e:/repo/` / `E:/repo` 是同一目录。
    // 用原始字符串做 key 会让同一仓库的写操作落进两条互不相干的串行链，互斥形同虚设
    // （大小写来自用户手输或系统返回的两种写法，尾斜杠来自路径拼接）。
    // 归一化结果为空（脏输入）时退回原始串，不把不同的空键混到一起。
    const key = normalizePathKey(projectPath) || projectPath
    const gate = (this.chains.get(key) || Promise.resolve()).catch(() => {})
    const next = gate.then(fn)
    const tail = next.catch(() => {})
    this.chains.set(key, tail)
    // 链尾 settle 后回收条目：长会话里项目会被删除/改名，临时路径也会变，
    // 不回收则 Map 无界增长。守卫 `=== tail` 保证期间挂上新任务时不会误删新链尾。
    void tail.finally(() => {
      if (this.chains.get(key) === tail) this.chains.delete(key)
    })
    return next
  }

  /** 销毁锁：拒绝新任务并清空链（进行中的任务自然结束，由 GitExecutor.destroy 兜底 kill） */
  destroy(): void {
    this.destroyed = true
    this.chains.clear()
  }
}
