/**
 * 缓存清理历史存储（思源 saveData JSON 槽 `everything-search-clean-history`）
 * 记录每次清理的条数/体积/方式，供「缓存清理」面板展示累计统计与最近记录。
 *
 * 不使用 SQLite：`plugin.db` 位于思源同步目录，Windows 下连接持有会让同步引擎的
 * rename 失败。历史是辅助信息，存储失败仅打日志，不影响清理本身。
 */
import type { Plugin } from "siyuan"
import type {
  CleanHistoryRecord,
  CleanHistoryStats,
} from "../types"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 日志前缀（与功能模块一致，便于过滤检索） */
const LOG_TAG = "[everythingSearch]"

/** 存储键（与 src/config/storage/jsonSlots.ts 注册表一致） */
const STORAGE_KEY = "everything-search-clean-history"

/** 最近记录保留条数（每次清理一条，体积极小，上限只为防无限增长） */
const MAX_HISTORY_ROWS = 500

export class CacheCleanHistoryStorage {
  private readonly history: TypedStorage<CleanHistoryRecord[]>
  /** 写队列：避免并发 record 相互覆盖 */
  private writeQueue: Promise<unknown> = Promise.resolve()
  private closed = false

  constructor(plugin: Plugin) {
    this.history = new TypedStorage(
      new PluginStorage(plugin),
      STORAGE_KEY,
      [] as CleanHistoryRecord[],
    )
  }

  /** 串行执行一次写操作（前一次失败不影响后续） */
  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task)
    this.writeQueue = run.catch(() => undefined)
    return run
  }

  /** 读取历史（按时间倒序；不存在的键返回空数组） */
  private async loadAll(): Promise<CleanHistoryRecord[]> {
    const list = await this.history.loadOrDefault()
    return [...list].sort((a, b) => b.cleanedAt - a.cleanedAt)
  }

  /** 关闭（幂等）。JSON 槽无连接可释放，仅阻止后续写入 */
  close(): void {
    this.closed = true
  }

  /**
   * 记录一次清理结果，并把历史裁剪到上限内。
   * @returns 是否写入成功
   */
  async record(data: Omit<CleanHistoryRecord, "cleanedAt">): Promise<boolean> {
    if (this.closed) return false
    try {
      return await this.runExclusive(async () => {
        const list = await this.loadAll()
        list.unshift({ cleanedAt: Date.now(), ...data })
        if (list.length > MAX_HISTORY_ROWS) {
          list.length = MAX_HISTORY_ROWS
        }
        const ok = await this.history.save(list)
        if (!ok) throw new Error("save failed")
        return true
      })
    } catch (error) {
      console.error(`${LOG_TAG} 写入清理历史失败:`, error)
      return false
    }
  }

  /** 累计统计（内存聚合，条数上限 500） */
  async getStats(): Promise<CleanHistoryStats | null> {
    try {
      const list = await this.loadAll()
      return list.reduce<CleanHistoryStats>((total, item) => ({
        count: total.count + 1,
        entries: total.entries + item.entries,
        failed: total.failed + item.failed,
        freed: total.freed + item.freed,
      }), {
        count: 0,
        entries: 0,
        failed: 0,
        freed: 0,
      })
    } catch (error) {
      console.error(`${LOG_TAG} 读取清理统计失败:`, error)
      return null
    }
  }

  /** 最近记录（时间降序） */
  async getRecent(limit = 20): Promise<CleanHistoryRecord[]> {
    try {
      const list = await this.loadAll()
      return list.slice(0, Math.max(0, limit)).map(item => ({
        cleanedAt: Number(item.cleanedAt) || 0,
        mode: item.mode === "permanent" ? "permanent" : "recycle",
        entries: Number(item.entries) || 0,
        failed: Number(item.failed) || 0,
        freed: Number(item.freed) || 0,
      }))
    } catch (error) {
      console.error(`${LOG_TAG} 读取清理历史失败:`, error)
      return []
    }
  }
}

/** 模块级单例：面板与浮动窗口多次挂载共用同一实例 */
let sharedHistory: CacheCleanHistoryStorage | null = null

/** 获取（必要时创建）共享历史存储实例 */
export function getCacheCleanHistory(plugin: Plugin): CacheCleanHistoryStorage {
  if (!sharedHistory) {
    sharedHistory = new CacheCleanHistoryStorage(plugin)
  }
  return sharedHistory
}

/** 释放共享历史存储（插件卸载时调用；JSON 槽无连接需要关闭） */
export function closeCacheCleanHistory(): void {
  sharedHistory?.close()
  sharedHistory = null
}
