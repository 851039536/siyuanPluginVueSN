/**
 * 插件数据库会话（PluginDatabase）与思源同步守卫
 *
 * 从 `sqliteDb.ts` 拆出（原文件超过仓库 500 行硬阈值），只负责**会话与句柄生命周期**：
 * - 空闲即释放句柄（`IDLE_RELEASE_MS`），下次访问惰性重开；
 * - 思源同步开始/结束时释放所有句柄（`installSqliteSyncGuard`）；
 * - 事务与在线快照期间挂起释放；
 * - 产出单文件一致性快照（`snapshotTo`）。
 *
 * 路径解析、打开重试与建表约定仍在 `sqliteDb.ts`；对外入口也仍是 `@/utils/sqliteDb`
 * （本文件能力经其 re-export），消费方导入路径不变。
 * Windows 同步背景见 `sqliteDb.ts` 文件头「Windows 同步注意事项」。
 */
import type { Plugin } from "siyuan"
import { TimerRegistry, type TimerHandle } from "./timerRegistry"

/** node:sqlite 模块类型（结构化声明，避免依赖 @types/node 的版本差异） */
interface SqliteStatement {
  all: (...params: unknown[]) => unknown[]
  get: (...params: unknown[]) => unknown
  run: (...params: unknown[]) => { changes: number | bigint, lastInsertRowid: number | bigint }
}

/** 最小 DatabaseSync 接口（仅声明本项目用到的方法） */
export interface SqliteDatabaseSync {
  close: () => void
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
}

interface SqliteModule {
  DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabaseSync
  /** ⚠️ node:sqlite 的在线备份是**异步**的：必须 await，否则读到的是 0 字节文件 */
  backup: (sourceDb: SqliteDatabaseSync, destPath: string) => Promise<void>
}

/**
 * 延迟加载 node:sqlite；不可用时返回 null（纯浏览器 / 旧版思源）。
 * 与 getNodeModules() 同款容错范式。
 */
export function getSqlite(): SqliteModule | null {
  try {
    return require("node:sqlite") as SqliteModule
  } catch {
    return null
  }
}

/** SQLite 是否可用（调用方据此决定是否走降级路径） */
export function isSqliteAvailable(): boolean {
  return getSqlite() !== null
}

/**
 * 空闲多久后释放库文件句柄。
 * 取值只需覆盖「同一批 UI 操作」：太短会让一次面板刷新反复开关库，太长则把句柄
 * 留到同步窗口里（见 sqliteDb.ts 文件头「Windows 同步注意事项」）。
 */
const IDLE_RELEASE_MS = 2000

/**
 * 打开连接并应用统一 PRAGMA（首次打开与空闲重开共用，避免两套配置漂移）。
 *
 * ⚠️ PRAGMA 失败时必须关掉刚打开的连接：`DatabaseSync` 已经持有文件句柄，
 * 不关会留下 Windows 文件锁，而且该句柄不在 `liveDatabases` 里，同步守卫也释放不掉。
 */
export function createHandle(sqlite: SqliteModule, dbPath: string): SqliteDatabaseSync {
  const db = new sqlite.DatabaseSync(dbPath)
  try {
    // WAL：读写并发更好，且崩溃不损坏主库。注意其副作用见 sqliteDb.ts 文件头「WAL 注意事项」
    db.exec("PRAGMA journal_mode=WAL")
    db.exec("PRAGMA foreign_keys=ON")
    return db
  } catch (error) {
    try {
      db.close()
    } catch {
      // 关闭失败不掩盖原始异常
    }
    throw error
  }
}

/**
 * 存活中的库实例。同步守卫据此统一释放句柄；
 * 由构造登记、永久 close() 注销（空闲释放只关闭文件，不注销）。
 */
const liveDatabases = new Set<PluginDatabase>()

/**
 * 注册思源同步守卫：同步开始/结束时立即释放所有 `plugin.db` 文件句柄。
 *
 * 为什么必须在同步**开始**就放：思源同步引擎用「同目录临时文件 + rename」覆盖目标
 * 文件，而 Windows 上 SQLite 打开的文件被占用时 rename 会失败（见 sqliteDb.ts 文件头）。
 * 句柄释放后走空闲重开逻辑，同步结束后的首次访问会自动重连到新文件。
 *
 * 由插件 `onload` 调用一次，返回的 `destroy` 供 `onunload` 注销监听。
 */
export function installSqliteSyncGuard(plugin: Plugin): { destroy: () => void } {
  const releaseAll = () => {
    for (const db of liveDatabases) db.releaseForSync()
  }
  // 开始：先放句柄，同步才能 rename 覆盖 plugin.db；
  // 结束（成功/失败）：若同步期间句柄被重开（用户正好访问了面板），
  // 此时它指向的可能是已被替换的旧文件，必须释放，下次访问重连到新库，
  // 顺带把同步期间新产生的 `-wal` / `-shm` 归并清理掉。
  const events = ["sync-start", "sync-end", "sync-fail"] as const
  for (const type of events) plugin.eventBus.on(type, releaseAll)
  return {
    destroy: () => {
      for (const type of events) plugin.eventBus.off(type, releaseAll)
    },
  }
}

/**
 * 插件数据库句柄：薄封装 DatabaseSync，附加迁移与快照能力。
 * 所有 SQL 均通过 prepared statement 传参，禁止字符串拼接（防注入）。
 *
 * 句柄**不是常驻的**：空闲 `IDLE_RELEASE_MS` 后自动 close，下次访问按库路径重开
 * （并重放 PRAGMA）。这样插件开着也不会把工作区里的 `plugin.db` 一直锁住，
 * 思源同步才能正常覆盖它（见 sqliteDb.ts 文件头「Windows 同步注意事项」）。
 *
 * 已知限制：同步进行中若用户打开依赖本库的面板，`acquire()` 会重新打开句柄，
 * 该轮同步仍可能失败（下一轮自动恢复）——这是同步 API 无法阻塞等待同步结束的取舍。
 */
export class PluginDatabase {
  private readonly sqlite: SqliteModule
  /** 当前句柄；空闲释放后为 null，下次访问惰性重开 */
  private handle: SqliteDatabaseSync | null
  private readonly dbPath: string
  /** 永久关闭标记（插件卸载），与「空闲释放」区分：后者仍可重开 */
  private closed = false
  /** >0 表示事务 / 快照进行中，此时禁止空闲释放 */
  private busy = 0
  /** 空闲释放定时器（统一走 TimerRegistry，句柄随实例生命周期清理） */
  private readonly timers = new TimerRegistry()
  private idleTimer: TimerHandle | null = null

  constructor(sqlite: SqliteModule, db: SqliteDatabaseSync, dbPath: string) {
    this.sqlite = sqlite
    this.handle = db
    this.dbPath = dbPath
    liveDatabases.add(this)
    this.scheduleIdleRelease()
  }

  /** 库文件绝对路径 */
  getPath(): string {
    return this.dbPath
  }

  /**
   * 取可用句柄（必要时空闲重开）。重开失败会抛出，由调用方按「数据库不可用」兜底。
   */
  private acquire(): SqliteDatabaseSync {
    if (this.closed) throw new Error("[sqlite] 数据库已关闭")
    if (!this.handle) {
      // 只可能由空闲释放导致：实例尚未永久关闭，按同一套 PRAGMA 重开
      this.handle = createHandle(this.sqlite, this.dbPath)
    }
    this.scheduleIdleRelease()
    return this.handle
  }

  /** 重新安排空闲释放（每次访问都续期；事务 / 快照期间不安排） */
  private scheduleIdleRelease(): void {
    if (this.closed || this.busy > 0) return
    this.cancelIdleRelease()
    this.idleTimer = this.timers.setTimeout(() => {
      this.idleTimer = null
      this.releaseHandle()
    }, IDLE_RELEASE_MS)
  }

  private cancelIdleRelease(): void {
    if (this.idleTimer === null) return
    this.timers.clear(this.idleTimer)
    this.idleTimer = null
  }

  /**
   * 释放文件句柄但保留实例（可重开）。
   * 关闭最后一个连接时 SQLite 会把 WAL 归并回主库并删除 `-wal` / `-shm`。
   */
  private releaseHandle(): void {
    this.cancelIdleRelease()
    const db = this.handle
    if (!db) return
    this.handle = null
    try {
      db.close()
    } catch (error) {
      console.error("[sqlite] 释放数据库句柄失败:", error)
    }
  }

  /** 同步开始时立即释放句柄（事务 / 快照进行中则跳过，等空闲释放兜底） */
  releaseForSync(): void {
    if (this.closed || this.busy > 0) return
    this.releaseHandle()
  }

  /** 执行不返回结果的 SQL（建表 / PRAGMA 等） */
  exec(sql: string): void {
    this.acquire().exec(sql)
  }

  /** 查询多行 */
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.acquire().prepare(sql).all(...params) as T[]
  }

  /** 查询单行（无结果返回 undefined） */
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    return this.acquire().prepare(sql).get(...params) as T | undefined
  }

  /** 执行写入，返回受影响行数 */
  run(sql: string, ...params: unknown[]): number {
    const result = this.acquire().prepare(sql).run(...params)
    return Number(result.changes)
  }

  /**
   * 在事务中执行（异常自动回滚）。
   * SQLite 的事务在单连接上是串行的，回调内不要再嵌套 withTransaction。
   */
  withTransaction<T>(fn: () => T): T {
    const db = this.acquire()
    // 事务期间挂起空闲释放：中途 close 会让后续语句落到已关闭的连接上
    this.cancelIdleRelease()
    this.busy++
    try {
      db.exec("BEGIN")
      const result = fn()
      db.exec("COMMIT")
      return result
    } catch (error) {
      try {
        db.exec("ROLLBACK")
      } catch {
        // 回滚失败不掩盖原始异常
      }
      throw error
    } finally {
      this.busy--
      this.scheduleIdleRelease()
    }
  }

  /**
   * 读取 user_version（结构版本号，用于迁移判定）
   */
  getUserVersion(): number {
    const row = this.acquire().prepare("PRAGMA user_version").get() as { user_version?: number } | undefined
    return Number(row?.user_version ?? 0)
  }

  /**
   * 设置 user_version（结构迁移完成后调用）
   */
  setUserVersion(version: number): void {
    // PRAGMA 不支持参数绑定，此处版本号来自代码常量而非外部输入
    this.acquire().exec(`PRAGMA user_version=${Math.max(0, Math.floor(version))}`)
  }

  /**
   * 产出**单文件一致性快照**（SQLite 官方在线备份 API）。
   *
   * 为什么必须用它而不是复制 `.db`：WAL 模式下已提交数据可能仍在 `-wal` 中，
   * 直接复制 `.db` 会得到空库（实测 `no such table`）。本方法在库处于打开状态、
   * 甚至并发写入时也能产出完整可用的单文件快照。
   *
   * ⚠️ `node:sqlite` 的 `backup()` 返回 Promise：**必须 await 后再 close/读文件**。
   * 调用后立即读取会拿到 0 字节（实测 Node 24.15），备份 zip 里的库因此为空。
   *
   * @param destPath 目标文件路径（同目录下的临时名即可，调用方可再改名/打包）
   */
  async snapshotTo(destPath: string): Promise<void> {
    const db = this.acquire()
    // backup 是异步的：期间同样不能空闲释放，否则读的是已关闭的连接
    this.cancelIdleRelease()
    this.busy++
    try {
      await this.sqlite.backup(db, destPath)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`[sqlite] 生成快照失败 [${destPath}]: ${reason}`)
    } finally {
      this.busy--
      this.scheduleIdleRelease()
    }
  }

  /**
   * 把 WAL 内容并回主库并截断 `-wal`（仅在确定无并发写时使用）。
   * 适用于「确实需要直接复制 .db」的场景；一般备份请优先用 snapshotTo()。
   */
  checkpoint(): void {
    this.acquire().exec("PRAGMA wal_checkpoint(TRUNCATE)")
  }

  /** 永久关闭（幂等）：注销实例，之后所有访问抛错；空闲释放不算永久关闭 */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.releaseHandle()
    liveDatabases.delete(this)
  }
}
