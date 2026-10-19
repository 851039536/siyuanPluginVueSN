/**
 * S3 文件管理器持久化存储槽
 *
 * 配置 / 视图偏好走 PluginStorage + TypedStorage（小对象，同步可读）；
 * 操作日志按 AGENTS.md § SQLite 存储规范迁入全插件唯一的 plugin.db
 * （记录集合按条增删，整份 JSON 重写属写放大）。
 * 另有指向 s3Backup 配置键的只读槽（供"一键导入"，永不回写）。
 *
 * SQLite 不可用（旧版思源 / 无 node:sqlite）时日志仓库为禁用态：
 * 接口保持可调用（append 为空操作、load 返回空列表），内存态日志不受影响。
 */
import type { Plugin } from "siyuan"
import type { S3Config } from "@/utils/s3/types"
import { DEFAULT_S3_CONFIG } from "@/utils/s3/types"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { openWithRetry, featureTables, type PluginDatabase } from "@/utils/sqliteDb"
import type { FileOpLog, FmPrefs } from "./index"
import { DEFAULT_FM_PREFS } from "./index"

// ========== 存储键常量 ==========

const STORAGE_KEYS = {
  CONFIG: "s3-file-manager-config",
  PREFS: "s3-file-manager-prefs",
} as const

/** s3Backup 的 S3 配置存储键（跨模块只读共享，禁止写入） */
const S3_BACKUP_CONFIG_KEY = "s3-backup-config"

/** 数据库日志标签 */
const LOG_TAG = "[s3FileManager]"

/** 表命名空间（全插件单库下按功能隔离） */
const TABLE = featureTables("s3fm", ["logs"] as const)

/** 日志保留上限（与旧 JSON 方案同一数据源） */
const MAX_DB_LOG_ROWS = 200

// ========== SQLite 日志仓库 ==========

/** 数据库行 → FileOpLog */
function rowToLog(row: {
  id: string
  time: number
  type: string
  action: string
  file_name: string
  item_count: number | null
  file_size: number | null
  success: number
  message: string | null
  hostname: string | null
  detail_json: string | null
}): FileOpLog {
  return {
    id: row.id,
    time: new Date(row.time).toISOString(),
    type: row.type as FileOpLog["type"],
    action: row.action,
    fileName: row.file_name,
    itemCount: row.item_count ?? undefined,
    fileSize: row.file_size ?? undefined,
    success: row.success === 1,
    message: row.message ?? undefined,
    hostname: row.hostname ?? undefined,
    detail: row.detail_json ? (JSON.parse(row.detail_json) as FileOpLog["detail"]) : undefined,
  }
}

/**
 * 操作日志 SQLite 仓库。
 * 与 TypedStorage 槽位并列：构造即触发异步建表（openWithRetry 含启动早期退避），
 * 句柄就绪前 append / load 的调用安全无副作用（禁用态语义）。
 */
class S3FmLogStore {
  private db: PluginDatabase | null = null
  private initPromise: Promise<void> | null = null
  private closed = false

  constructor(plugin: Plugin) {
    this.initPromise = this._init(plugin)
  }

  private async _init(plugin: Plugin): Promise<void> {
    const db = await openWithRetry(plugin, (d) => this._prepare(d), { logTag: LOG_TAG })
    // 初始化窗口期内插件可能已卸载：立即关掉句柄防泄漏（单例管理方已清空）
    if (this.closed) {
      db?.close()
      return
    }
    this.db = db
  }

  /** 建表（幂等，只 CREATE IF NOT EXISTS，不含数据迁移——旧 JSON 日志按规范弃置） */
  private _prepare(db: PluginDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE.logs} (
        id          TEXT PRIMARY KEY,
        time        INTEGER NOT NULL,
        type        TEXT NOT NULL,
        action      TEXT NOT NULL,
        file_name   TEXT NOT NULL,
        item_count  INTEGER,
        file_size   INTEGER,
        success     INTEGER NOT NULL,
        message     TEXT,
        hostname    TEXT,
        detail_json TEXT
      )
    `)
  }

  /** 追加一条日志并裁剪到上限；库不可用时静默跳过（内存态日志仍可用） */
  append(log: FileOpLog): void {
    const db = this.db
    if (!db) { return }
    db.run(
      `INSERT OR REPLACE INTO ${TABLE.logs}
        (id, time, type, action, file_name, item_count, file_size, success, message, hostname, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      log.id,
      Date.parse(log.time),
      log.type,
      log.action,
      log.fileName,
      log.itemCount ?? null,
      log.fileSize ?? null,
      log.success ? 1 : 0,
      log.message ?? null,
      log.hostname ?? null,
      log.detail ? JSON.stringify(log.detail) : null,
    )
    // 超出上限裁剪最旧记录（rowid 为插入序，与 addLog 的 unshift 语义一致）
    db.run(
      `DELETE FROM ${TABLE.logs} WHERE rowid NOT IN (
         SELECT rowid FROM ${TABLE.logs} ORDER BY rowid DESC LIMIT ?
       )`,
      MAX_DB_LOG_ROWS,
    )
  }

  /** 加载全部日志（最新在前，按插入序倒序）；库不可用返回空列表 */
  load(): FileOpLog[] {
    const db = this.db
    if (!db) { return [] }
    const rows = db.all<Parameters<typeof rowToLog>[0]>(
      `SELECT id, time, type, action, file_name, item_count, file_size, success, message, hostname, detail_json
       FROM ${TABLE.logs} ORDER BY rowid DESC`,
    )
    return rows.map(rowToLog)
  }

  /** 清空全部日志 */
  clear(): void {
    this.db?.run(`DELETE FROM ${TABLE.logs}`)
  }

  /** 关闭句柄（幂等）；关闭后到达的初始化结果也会被立即关闭 */
  close(): void {
    this.closed = true
    this.db?.close()
    this.db = null
  }

  /** 供 destroy 流程等待初始化收尾（避免关闭早于建表导致句柄泄漏） */
  get ready(): Promise<void> | null {
    return this.initPromise
  }
}

// ========== 存储类 ==========

export class S3FileManagerStorage {
  /** 自有 S3 连接配置（accessKey/secretKey 加密存储，读写时经 settingsCrypto 处理） */
  readonly config: TypedStorage<S3Config>
  /** 操作日志（SQLite 仓库；不可用时为禁用态） */
  readonly logs: S3FmLogStore
  /** 视图偏好（视图模式/排序） */
  readonly prefs: TypedStorage<FmPrefs>
  /** s3Backup 配置的只读槽（一键导入用，永不调用 save） */
  readonly backupConfigReadonly: TypedStorage<S3Config>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.config = new TypedStorage(storage, STORAGE_KEYS.CONFIG, { ...DEFAULT_S3_CONFIG })
    this.logs = new S3FmLogStore(plugin)
    this.prefs = new TypedStorage(storage, STORAGE_KEYS.PREFS, { ...DEFAULT_FM_PREFS })
    this.backupConfigReadonly = new TypedStorage(storage, S3_BACKUP_CONFIG_KEY)
  }
}
