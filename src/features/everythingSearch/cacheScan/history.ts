/**
 * 缓存清理历史存储（统一单库 plugin.db 的 `es_clean_history` 表）
 * 记录每次清理的条数/体积/方式，供「缓存清理」面板展示累计统计与最近记录。
 *
 * 表命名约定见 @/utils/sqliteDb 的 featureTables()；运行时只建表，不做数据迁移。
 * 历史是辅助信息：存储不可用时记录失败仅打日志，不影响清理本身。
 */
import type { Plugin } from "siyuan"
import type {
  CleanHistoryRecord,
  CleanHistoryStats,
} from "../types"
import { featureTables, openWithRetry, type PluginDatabase } from "@/utils/sqliteDb"

/** 日志前缀（与功能模块一致，便于过滤检索） */
const LOG_TAG = "[everythingSearch]"

/** 表命名空间前缀：统一单库下按功能隔离表名（everythingSearch → es） */
const TABLE = featureTables("es", ["clean_history"] as const)

/** 最近记录保留条数（每次清理一行，体积极小，上限只为防无限增长） */
const MAX_HISTORY_ROWS = 500

/** 数据库行形状（列名与 CleanHistoryRecord 字段一一对应） */
interface HistoryRow {
  cleaned_at: number
  mode: string
  entries: number
  failed: number
  freed: number
}

export class CacheCleanHistoryStorage {
  /** SQLite 句柄；null = 尚未就绪或不可用 */
  private db: PluginDatabase | null = null
  /** 初始化 Promise（并发调用只初始化一次） */
  private initPromise: Promise<PluginDatabase | null> | null = null
  /** 已关闭标记：防止 close() 后仍被初始化回调重新赋值而泄漏连接 */
  private closed = false

  constructor(plugin: Plugin) {
    this.initPromise = this._init(plugin)
  }

  /** 打开（含启动早期重试）→ 建表。通用重试逻辑在 openWithRetry */
  private async _init(plugin: Plugin): Promise<PluginDatabase | null> {
    const db = await openWithRetry(plugin, (d) => this._prepare(d), { logTag: LOG_TAG })
    if (this.closed) {
      db?.close()
      return null
    }
    this.db = db
    return db
  }

  /** 建表（幂等，只保证表存在，不含数据迁移） */
  private _prepare(db: PluginDatabase): void {
    db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE.clean_history} (
      cleaned_at INTEGER NOT NULL,
      mode       TEXT NOT NULL,
      entries    INTEGER NOT NULL DEFAULT 0,
      failed     INTEGER NOT NULL DEFAULT 0,
      freed      INTEGER NOT NULL DEFAULT 0
    )`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${TABLE.clean_history}_time ON ${TABLE.clean_history}(cleaned_at)`)
  }

  /** 等待初始化完成，返回可用句柄（不可用时为 null） */
  private async _ready(): Promise<PluginDatabase | null> {
    if (this.db) return this.db
    return await this.initPromise
  }

  /** 关闭连接（幂等）。关闭后本实例不再可用 */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.db?.close()
    this.db = null
    this.initPromise = Promise.resolve(null)
  }

  /** 取可用句柄；未就绪或已关闭时抛错（调用方按辅助信息降级处理） */
  private async _require(): Promise<PluginDatabase> {
    if (this.closed) throw new Error(`${LOG_TAG} 历史存储已关闭`)
    const db = await this._ready()
    if (!db) throw new Error(`${LOG_TAG} 数据库不可用（node:sqlite 缺失或工作区路径未就绪）`)
    return db
  }

  /**
   * 记录一次清理结果，并把历史裁剪到上限内（同事务，防无限增长）。
   * @returns 是否写入成功
   */
  async record(data: Omit<CleanHistoryRecord, "cleanedAt">): Promise<boolean> {
    try {
      const db = await this._require()
      db.withTransaction(() => {
        db.run(
          `INSERT INTO ${TABLE.clean_history} (cleaned_at, mode, entries, failed, freed)
           VALUES (?, ?, ?, ?, ?)`,
          Date.now(),
          data.mode,
          data.entries,
          data.failed,
          data.freed,
        )
        db.run(
          `DELETE FROM ${TABLE.clean_history}
            WHERE rowid NOT IN (
              SELECT rowid FROM ${TABLE.clean_history} ORDER BY cleaned_at DESC LIMIT ?
            )`,
          MAX_HISTORY_ROWS,
        )
      })
      return true
    } catch (error) {
      console.error(`${LOG_TAG} 写入清理历史失败:`, error)
      return false
    }
  }

  /** 累计统计（SQL 聚合，O(1) 行数无关） */
  async getStats(): Promise<CleanHistoryStats | null> {
    try {
      const db = await this._require()
      const row = db.get<{ c: number, e: number, f: number, s: number }>(
        `SELECT COUNT(*) AS c,
                COALESCE(SUM(entries), 0) AS e,
                COALESCE(SUM(failed), 0) AS f,
                COALESCE(SUM(freed), 0) AS s
           FROM ${TABLE.clean_history}`,
      )
      if (!row) return { count: 0, entries: 0, failed: 0, freed: 0 }
      return {
        count: Number(row.c),
        entries: Number(row.e),
        failed: Number(row.f),
        freed: Number(row.s),
      }
    } catch (error) {
      console.error(`${LOG_TAG} 读取清理统计失败:`, error)
      return null
    }
  }

  /** 最近记录（时间降序） */
  async getRecent(limit = 20): Promise<CleanHistoryRecord[]> {
    try {
      const db = await this._require()
      const rows = db.all<HistoryRow>(
        `SELECT cleaned_at, mode, entries, failed, freed
           FROM ${TABLE.clean_history}
          ORDER BY cleaned_at DESC
          LIMIT ?`,
        limit,
      )
      return rows.map(row => ({
        cleanedAt: Number(row.cleaned_at),
        mode: row.mode === "permanent" ? "permanent" : "recycle",
        entries: Number(row.entries),
        failed: Number(row.failed),
        freed: Number(row.freed),
      }))
    } catch (error) {
      console.error(`${LOG_TAG} 读取清理历史失败:`, error)
      return []
    }
  }
}

/** 模块级单例：面板与浮动窗口多次挂载共用同一实例，避免重复打开数据库 */
let sharedHistory: CacheCleanHistoryStorage | null = null

/** 获取（必要时创建）共享历史存储实例 */
export function getCacheCleanHistory(plugin: Plugin): CacheCleanHistoryStorage {
  if (!sharedHistory) {
    sharedHistory = new CacheCleanHistoryStorage(plugin)
  }
  return sharedHistory
}

/** 关闭并释放共享历史存储（插件卸载时调用） */
export function closeCacheCleanHistory(): void {
  sharedHistory?.close()
  sharedHistory = null
}
