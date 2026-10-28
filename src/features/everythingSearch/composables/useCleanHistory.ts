/**
 * 缓存清理历史 composable：累计统计与最近记录的加载/刷新/追加记录
 * 存储不可用时全部降级为空值（历史是辅助信息，不影响清理功能）
 */
import type {
  CacheCleanMode,
  CacheCleanResult,
  CleanHistoryRecord,
  CleanHistoryStats,
} from "../types"
import type { CacheCleanHistoryStorage } from "../cacheScan/history"
import { onUnmounted, ref } from "vue"

/** 面板展示的最近记录条数 */
const RECENT_LIMIT = 20

/** useCleanHistory 依赖：共享历史存储实例（null = 未接线，全部降级） */
export interface UseCleanHistoryDeps {
  storage: CacheCleanHistoryStorage | null
}

export function useCleanHistory(deps: UseCleanHistoryDeps) {
  const { storage } = deps
  const stats = ref<CleanHistoryStats | null>(null)
  const records = ref<CleanHistoryRecord[]>([])
  let disposed = false

  /** 重新加载统计与最近记录（失败静默降级为空，错误已由存储层打日志） */
  const refresh = async () => {
    if (!storage) return
    const [nextStats, nextRecords] = await Promise.all([
      storage.getStats(),
      storage.getRecent(RECENT_LIMIT),
    ])
    if (disposed) return
    stats.value = nextStats
    records.value = nextRecords
  }

  /**
   * 清理完成后追加记录并刷新统计（由 tasks.ts 的 onCleaned 回调触发）。
   * 失败只打日志（存储层已记录），不阻塞清理结果的 UI 反馈。
   */
  const recordClean = (result: CacheCleanResult, mode: CacheCleanMode): void => {
    if (!storage) return
    void storage.record({
      mode,
      entries: result.deleted,
      failed: result.failed,
      freed: result.freed,
    }).then((ok) => {
      if (ok) void refresh()
    })
  }

  void refresh()

  onUnmounted(() => {
    disposed = true
  })

  return {
    stats,
    records,
    refresh,
    recordClean,
  }
}
