// gitPush 运行时辅助（纯函数）：Record 缓存裁剪、连续并发池、并发操作标志计数

/** 限制 Record 缓存条目数，超过上限时删除最早的条目 */
export function pruneRecordCache(record: Record<string, any>, max = 30) {
  const keys = Object.keys(record)
  if (keys.length <= max) return
  for (const k of keys.slice(0, keys.length - max)) {
    delete record[k]
  }
}

/** 连续并发池：恒定 N 个任务在飞（无批次屏障），单个长任务不再阻塞其他槽位；
 *  替代旧 batchProcess 的"整批等待"语义——长短仓混杂时屏障会让先完成的槽位空转 */
export async function poolProcess<T>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<void>) {
  let next = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      await fn(items[i], i)
    }
  })
  await Promise.all(workers)
}

/** 进入操作：标志计数 +1 */
export function acquireFlag(record: Record<string, number>, id: string): void {
  record[id] = (record[id] || 0) + 1
}

/** 离开操作：标志计数 -1，归零后移除键 */
export function releaseFlag(record: Record<string, number>, id: string): void {
  const next = (record[id] || 0) - 1
  if (next <= 0) {
    delete record[id]
  } else {
    record[id] = next
  }
}
