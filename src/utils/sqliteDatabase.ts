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

/** 同步窗口内访问数据库的显式错误（调用方按「数据库暂不可用」兜底） */
export class SqliteSyncInProgressError extends Error {
  constructor() {
    super("[sqlite] 思源正在同步，数据库暂不可用，请稍后重试")
    this.name = "SqliteSyncInProgressError"
  }
}

/** 同步相关的模块级定时器（等待超时 + 同步态兜底解除） */
const syncTimers = new TimerRegistry()

/**
 * 同步态跨模块实例共享。
 *
 * 思源每次重载插件都用 `window.eval` 重新求值插件脚本（app/src/plugin/loader.ts），
 * 模块级变量随之归零。若重载发生在同步进行中（改代码热更 / 启用禁用插件），
 * 新模块会误判「没在同步」并立刻重开 `plugin.db`，让本轮同步的 rename 失败。
 * 因此把「是否在同步窗口内」放到 globalThis 上，让重新求值出的模块实例继承。
 */
const SYNC_STATE_KEY = "__snPluginSqliteSyncing"

function readSharedSyncState(): boolean {
  try {
    return (globalThis as any)[SYNC_STATE_KEY] === true
  } catch {
    return false
  }
}

function writeSharedSyncState(inProgress: boolean): void {
  try {
    (globalThis as any)[SYNC_STATE_KEY] = inProgress
  } catch {
    // globalThis 不可写时退化为模块级状态（与未共享时行为一致）
  }
}

/**
 * 同步进行中标记：同步引擎正在用 rename 覆盖工作区文件，此时**任何重开**都会让整轮同步失败。
 * 同步窗口内 `acquire()` 直接抛错，异步入口先 `waitForSyncIdle()` 再访问。
 */
let syncInProgress = readSharedSyncState()
/** 兜底解除同步态（防止结束事件丢失让数据库永久不可用）——只在极长同步时才触发 */
const SYNC_WATCHDOG_MS = 30 * 60 * 1000
let syncWatchdog: TimerHandle | null = null
/** 等待同步结束的异步入口（存储层读取 / 初始化 / 快照） */
let syncWaiters: Array<() => void> = []

/** 同步窗口内等待数据库恢复可用的默认上限（常见同步在数秒内结束） */
const SYNC_WAIT_TIMEOUT_MS = 10_000

/**
 * 继承来的同步态只保留一次「等待同步结束」的时间预算（与 `waitForSyncIdle` 上限一致）。
 *
 * 为什么不用 30 分钟兜底：旧模块的结束事件可能已被它自己消费（卸载/重载的间隙），
 * 新模块继承到的 `true` 可能已经过期。若沿用长兜底，重载后数据库会长时间不可写。
 * 10s 后仍无法确认就按既有约定「超时后照常打开」（见 sqliteDatabase 文件头）。
 */
const INHERITED_SYNC_GRACE_MS = SYNC_WAIT_TIMEOUT_MS

/** 当前是否处于思源同步窗口（供存储层判断是否需要等待） */
export function isSyncInProgress(): boolean {
  return syncInProgress
}

/**
 * 等待同步结束（有界）。
 *
 * @returns true = 已结束（或本来就没在同步）；false = 超时仍在同步
 *
 * 只用于**异步入口**（打开库 / 存储层读取 / 快照）；同步 API 无法等待，
 * 由 `acquire()` 抛 `SqliteSyncInProgressError` 兜底。
 */
export function waitForSyncIdle(timeoutMs = SYNC_WAIT_TIMEOUT_MS): Promise<boolean> {
  if (!syncInProgress) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    let settled = false
    let timeoutHandle: TimerHandle | null = null
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (timeoutHandle !== null) syncTimers.clear(timeoutHandle)
      resolve(ok)
    }
    const waiter = () => finish(true)
    timeoutHandle = syncTimers.setTimeout(() => {
      const index = syncWaiters.indexOf(waiter)
      if (index >= 0) syncWaiters.splice(index, 1)
      finish(false)
    }, timeoutMs)
    syncWaiters.push(waiter)
  })
}

/**
 * 续期兜底定时器：结束事件丢失时仍能在上限内解除同步态。
 * 同步开始与「重载后继承同步态」两处共用，避免各写一份。
 *
 * @param delayMs 兜底时长；同步开始用 `SYNC_WATCHDOG_MS`，
 *   继承同步态用 `INHERITED_SYNC_GRACE_MS`（见其注释）
 */
function armSyncWatchdog(delayMs = SYNC_WATCHDOG_MS): void {
  if (syncWatchdog !== null) syncTimers.clear(syncWatchdog)
  syncWatchdog = syncTimers.setTimeout(() => {
    syncWatchdog = null
    endSync()
  }, delayMs)
}

/**
 * 进入同步窗口：立即释放所有句柄，并在窗口内拒绝重开。
 * 幂等：`sync-start` 与 `ws-main` 会重复触发，重复调用只续期兜底定时器。
 */
function beginSync(): void {
  const first = !syncInProgress
  syncInProgress = true
  writeSharedSyncState(true)
  for (const db of liveDatabases) db.releaseForSync()
  armSyncWatchdog()
  if (first) console.info("[sqlite] 思源同步开始，已释放所有数据库句柄（同步期间暂停数据库访问）")
}

/** 退出同步窗口：再释放一次兜底（如释放时正被快照占用），唤醒等待中的异步入口 */
function endSync(): void {
  if (!syncInProgress) return
  syncInProgress = false
  writeSharedSyncState(false)
  if (syncWatchdog !== null) {
    syncTimers.clear(syncWatchdog)
    syncWatchdog = null
  }
  for (const db of liveDatabases) db.releaseForSync()
  const waiters = syncWaiters
  syncWaiters = []
  for (const resume of waiters) resume()
  console.info("[sqlite] 思源同步结束，数据库恢复可用")
}

/**
 * 主动放弃本轮同步窗口（异步入口等待超时后的显式放行）。
 *
 * 超时后不能只「打开但不放行」：`acquire()` 仍会抛 `SqliteSyncInProgressError`，
 * `openWithRetry` 的建表紧随其后就失败，只能返回 null 且不再重试 ——
 * 该功能整个会话都不可用。放行的代价是本轮同步可能失败（下一轮恢复），
 * 与「功能不可无限期不可用」的既有约定一致。
 */
export function abandonSyncWindow(): void {
  if (!syncInProgress) return
  console.warn("[sqlite] 同步等待超时，放弃本轮同步窗口（本轮同步可能失败，下一轮恢复）")
  endSync()
}

/**
 * 注册思源同步守卫：同步开始即释放所有 `plugin.db` 句柄，同步期间拒绝重开。
 *
 * 信号源以 `ws-main` 的 `syncing` 为准（内核广播后**最先**到达插件）：
 * 思源 3.8.9 的 `sync-start` 是在状态栏同步按钮 `#barSync` 的处理函数里发出的，
 * 该元素不存在（状态栏隐藏 / 尚未渲染）时会 `return`，插件就永远收不到 ——
 * 这是「明明做了守卫、同步仍失败」的根因。`sync-start/end/fail` 仅作兜底。
 *
 * 由插件 `onload` 调用一次，返回的 `destroy` 供 `onunload` 注销监听。
 */
export function installSqliteSyncGuard(plugin: Plugin): { destroy: () => void } {
  const onWsMain = (event: CustomEvent) => {
    const detail = event.detail as { cmd?: string, code?: number } | undefined
    if (detail?.cmd !== "syncing") return
    if (detail.code === 0) beginSync()
    else if (detail.code === 1 || detail.code === 2) endSync()
  }
  const listeners: Array<[string, (event: CustomEvent) => void]> = [
    ["ws-main", onWsMain],
    ["sync-start", () => beginSync()],
    ["sync-end", () => endSync()],
    ["sync-fail", () => endSync()],
  ]
  for (const [type, listener] of listeners) plugin.eventBus.on(type as any, listener)
  // 脚本重新求值后继承同步窗口（见 SYNC_STATE_KEY）：旧模块的监听器已随卸载注销，
  // 这里等待本次同步的结束事件；继承态只给一次等待预算，避免错过结束事件后长期锁库
  if (syncInProgress) {
    console.info("[sqlite] 插件重载时思源仍在同步，继续暂停数据库访问")
    armSyncWatchdog(INHERITED_SYNC_GRACE_MS)
  }
  return {
    destroy: () => {
      for (const [type, listener] of listeners) plugin.eventBus.off(type as any, listener)
      // 本模块卸载后不再负责解除同步态：否则旧看门狗会在 30 分钟后
      // 把新模块（重新求值出的脚本）正在经历的同步窗口清掉
      if (syncWatchdog !== null) {
        syncTimers.clear(syncWatchdog)
        syncWatchdog = null
      }
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
 * 已知限制：同步窗口内所有访问都会被拒绝（异步入口先等待，最多 10s）；
 * 超时后由 `abandonSyncWindow()` 放弃本轮窗口并放行，代价是该轮同步可能失败、下一轮恢复。
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
    // 同步窗口内绝不重开：dejavu 正在 rename 覆盖 plugin.db，句柄会让整轮同步失败
    if (syncInProgress) throw new SqliteSyncInProgressError()
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
    // 快照需要读文件：同步窗口内先等结束，避免重新锁住 plugin.db
    await waitForSyncIdle()
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
