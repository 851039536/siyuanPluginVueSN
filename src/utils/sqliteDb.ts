/**
 * SQLite 数据库统一入口（全项目唯一的 SQLite 访问点）
 *
 * 依赖思源 Electron 内置的 node:sqlite（Electron 44 / Node 24 起已转为稳定特性），
 * 无需原生编译，随思源升级自动可用。
 *
 * 设计契约（调用方必须遵守）：
 * - `openPluginDatabase()` 返回**判别联合**：成功 `{ ok: true, db }`，失败 `{ ok: false, reason }`。
 *   `reason` 区分「永久性失败」（no-sqlite / no-node / open-failed）与「暂未就绪」
 *   （path-unresolved）。**只有 path-unresolved 值得重试**，`openWithRetry()` 已按此实现；
 * - 数据库**不可用即功能不可用**（纯 SQLite，无 JSON 回退），失败必须让用户可感知，
 *   禁止静默吞掉；
 * - 库文件位于 `<插件数据目录>/plugin.db`（全插件唯一，见 `PLUGIN_DB_NAME`）。
 *
 * WAL 注意事项（关键，勿删）：
 * 启用 WAL 后，已提交数据可能仍留在 `-wal` 附属文件中（实测：主库 4KB / wal 48KB），
 * 此时**单独复制 `.db` 会得到空库**。因此提供 `snapshotTo()` —— 内部走 SQLite 官方
 * 在线备份 API 产出单文件一致性快照，备份/导出必须改用它，禁止直接复制 `.db`。
 */
import type { Plugin } from "siyuan"
import { getNodeFsPathOs } from "./nodeModules"
import { readWorkspaceDir } from "./workspaceDir"

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
  backup: (sourceDb: SqliteDatabaseSync, destPath: string) => void
}

/** 思源 Plugin 上供本模块使用的字段（dataDir 未在公开类型声明中，显式收窄） */
interface PluginWithDataDir extends Plugin {
  dataDir?: string
}

/**
 * 全插件唯一的库文件名（不含扩展名）。
 * 落在 `<插件数据目录>/plugin.db`，所有功能共享，靠表名前缀隔离。
 */
export const PLUGIN_DB_NAME = "plugin"

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
 * 由**插件数据目录**拼出库文件的绝对路径；无法确定时返回空串。
 *
 * ⚠️ `dataDir` 语义：必须是 `<workspace>/data/storage/petal/<pluginName>` 这个
 * **插件自己的数据目录**（与思源 saveData 的落盘位置一致），不是工作区根。
 *
 * ⚠️ 绝不能用 `plugin.dataDir` 直接拼接：该字段在思源运行时**为 undefined**
 * （非公开属性），拼出的会是相对路径，把库建到渲染进程的 CWD
 * （实测落到 `E:\siyuan2\storage\...` 或开发目录），而不是工作区的
 * `data/storage/petal/...`。相对路径一律拒绝。
 */
export function buildDbPath(dataDir: string, name = PLUGIN_DB_NAME): string {
  const node = getNodeFsPathOs()
  if (!node || !dataDir) return ""
  const { path } = node
  if (!path.isAbsolute(dataDir)) return ""
  return path.join(dataDir, `${name}.db`)
}

/**
 * 解析插件数据目录（绝对路径）；无法确定时返回空串。
 *
 * 来源优先级：
 * 1. `plugin.dataDir`（部分思源版本注入，最可靠且无 IO）；
 * 2. `<workspaceDir>/data/storage/petal/<pluginName>`（从内核配置取工作区根）。
 *
 * ⚠️ 时序约束：`onload` 早期内核可能尚未就绪，此时读不到工作区路径。
 * 调用方（如 warmup）应容忍失败并在稍后重试，**不可**退化成相对路径。
 *
 * ⚠️ 模块纯度：这里**不 import `@/api`**。`api.ts` 顶层对 `siyuan` 做值导入，
 * 会把运行时依赖钉进本模块的模块图，使本模块无法在纯 Node 环境（单元测试）中加载；
 * 且 `@/api` 已被其它 feature 静态导入，动态 import 只会得到
 * `INEFFECTIVE_DYNAMIC_IMPORT` 警告（不会分包）。故直接读内核配置。
 */
export async function resolvePluginDataDir(plugin: Plugin): Promise<string> {
  const node = getNodeFsPathOs()
  if (!node) return ""

  // 1. 思源注入的绝对路径（若存在）
  const injected = (plugin as PluginWithDataDir).dataDir
  if (injected && node.path.isAbsolute(injected)) {
    return injected
  }

  // 2. 回退：工作区根 + 约定子目录
  const workspaceDir = await readWorkspaceDir()
  if (workspaceDir && node.path.isAbsolute(workspaceDir)) {
    return node.path.join(workspaceDir, "data", "storage", "petal", plugin.name)
  }
  return ""
}

/**
 * 读取工作区根目录：已抽为共享工具 `utils/workspaceDir.ts`（skills 管理等消费方共用），
 * 此处经顶部导入复用。
 */

/**
 * 解析库文件绝对路径（异步便捷入口）。无法确定时返回空串。
 */
export async function resolveDbPath(plugin: Plugin, name = PLUGIN_DB_NAME): Promise<string> {
  const dataDir = await resolvePluginDataDir(plugin)
  return buildDbPath(dataDir, name)
}

/**
 * 打开数据库的失败原因。
 *
 * 为什么要区分：`openWithRetry` 只应对「路径暂未就绪」退避重试；
 * 其余原因重试**不可能成功**，应立即失败并保留真实错误，
 * 否则会白等 10.5s 并刷出误导性的「插件数据目录暂未就绪」日志。
 */
export type OpenFailureReason =
  /** 当前环境没有 node:sqlite（旧版思源 / 纯浏览器）——永久性 */
  | "no-sqlite"
  /** 拿不到 node 的 fs/path——永久性 */
  | "no-node"
  /** 工作区路径解析不出来（启动早期内核未就绪）——**唯一可重试** */
  | "path-unresolved"
  /** 打开/建目录/PRAGMA 失败，如 SQLITE_CANTOPEN / EBUSY / 库损坏——需人工介入 */
  | "open-failed"

/** 打开数据库的结果（判别联合，避免把不同失败压成同一个 null） */
export type OpenResult =
  | { ok: true, db: PluginDatabase }
  | { ok: false, reason: OpenFailureReason, error?: unknown }

/**
 * 打开（必要时创建）插件数据库。
 *
 * **统一单库**：全插件共用一个 `plugin.db`，而不是每个功能一个库文件。
 * 各功能通过**表名前缀**隔离（如 `wn_entries` / `wn_categories`），
 * 见 {@link FeatureTable}。理由：多库会导致备份/快照/迁移各做一遍，
 * 且与「减少 petal 目录下的散落文件」的迁移初衷相悖。
 *
 * @param plugin 思源插件实例
 * @param name 库文件名（不含扩展名）；默认即是唯一的那一个，**不要按功能传不同值**
 * @returns 成功时带句柄，失败时带**具体原因**（调用方据此决定是否重试）
 */
export async function openPluginDatabase(
  plugin: Plugin,
  name = PLUGIN_DB_NAME,
): Promise<OpenResult> {
  const sqlite = getSqlite()
  if (!sqlite) return { ok: false, reason: "no-sqlite" }
  const node = getNodeFsPathOs()
  if (!node) return { ok: false, reason: "no-node" }

  const dbPath = await resolveDbPath(plugin, name)
  if (!dbPath) {
    // 路径无法解析（通常是启动早期内核未就绪）——唯一值得重试的情况
    return { ok: false, reason: "path-unresolved" }
  }

  try {
    // 目录可能尚未创建（首次运行且插件从未写过 saveData）
    node.fs.mkdirSync(node.path.dirname(dbPath), { recursive: true })
    const db = new sqlite.DatabaseSync(dbPath)
    // WAL：读写并发更好，且崩溃不损坏主库。注意其副作用见文件头「WAL 注意事项」
    db.exec("PRAGMA journal_mode=WAL")
    db.exec("PRAGMA foreign_keys=ON")
    return { ok: true, db: new PluginDatabase(sqlite, db, dbPath) }
  } catch (error) {
    console.error(`[sqlite] 打开数据库失败 [${dbPath}]:`, error)
    return { ok: false, reason: "open-failed", error }
  }
}

/**
 * 功能表命名空间：为某功能生成带前缀的表名集合。
 *
 * 统一单库下，表名必须按功能前缀隔离，避免不同功能撞表。
 * 约定：`<prefix>_<entity>`，前缀取功能缩写（如 websiteNavigation → `wn`）。
 *
 * @example
 *   const T = featureTables("wn", ["entries", "categories"])
 *   T.entries  // "wn_entries"
 *   T.categories // "wn_categories"
 */
export function featureTables<P extends string, E extends string>(
  prefix: P,
  entities: readonly E[],
): Record<E, string> {
  const out = {} as Record<E, string>
  for (const e of entities) {
    out[e] = `${prefix}_${e}`
  }
  return out
}

/** openWithRetry 的选项 */
export interface OpenWithRetryOptions {
  /** 日志前缀，如 "[websiteNavigation]"（便于区分功能） */
  logTag: string
  /** 最大尝试次数，默认 6 */
  maxAttempts?: number
  /** 首次退避毫秒数（后续按 attempt 递增），默认 500 */
  baseDelayMs?: number
}

/**
 * 打开插件数据库，并在**启动早期内核未就绪**时自动退避重试。
 *
 * 为什么需要重试：`openPluginDatabase()` 解析路径依赖工作区目录，
 * 而 `onload` 阶段（registerFeature 预热）内核可能尚未就绪。
 * 若不重试，一次瞬时失败就会让本进程整个生命周期都用不了数据库。
 *
 * **只对 `path-unresolved` 重试**。其余失败（无 node:sqlite / 打开失败 / 库损坏）
 * 重试不可能成功，立即返回并保留真实错误 —— 避免白等 10.5s 与误导性日志。
 *
 * 成功后调用 `migrateFn(db)` 建表/播种；若 `migrateFn` 抛错，会关闭连接并返回 null
 * （避免半初始化的句柄泄漏）。
 *
 * @example
 *   const db = await openWithRetry(plugin, (d) => {
 *     d.exec(`CREATE TABLE IF NOT EXISTS ${TABLE.entries} (...)`)
 *   }, { logTag: "[websiteNavigation]" })
 *
 * @returns 已建好表的句柄；不可用时返回 null
 */
export async function openWithRetry(
  plugin: Plugin,
  migrateFn: (db: PluginDatabase) => void,
  options: OpenWithRetryOptions,
): Promise<PluginDatabase | null> {
  const { logTag, maxAttempts = 6, baseDelayMs = 500 } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await openPluginDatabase(plugin)

    if (result.ok) {
      const db = result.db
      try {
        migrateFn(db)
      } catch (error) {
        // 建表/播种失败：关掉句柄，避免半初始化连接泄漏
        console.error(`${logTag} 数据库初始化（建表/播种）失败:`, error)
        db.close()
        return null
      }
      console.info(`${logTag} SQLite 已启用: ${db.getPath()}`)
      return db
    }

    // 非「路径未就绪」的失败：重试无意义，立即失败并说清真实原因
    if (result.reason !== "path-unresolved") {
      logOpenFailure(logTag, result.reason, result.error)
      return null
    }

    // 路径未就绪 → 退避重试
    if (attempt < maxAttempts) {
      const waitMs = baseDelayMs * attempt
      console.info(`${logTag} 插件数据目录暂未就绪，${waitMs}ms 后重试 (${attempt}/${maxAttempts})`)
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
    }
  }

  console.error(
    `${logTag} 已重试 ${maxAttempts} 次，工作区路径仍未就绪，该功能数据不可用`
    + `（总耗时约 ${(baseDelayMs * (maxAttempts - 1) * maxAttempts) / 2}ms）。`,
  )
  return null
}

/** 按失败原因输出对应的、可诊断的日志 */
function logOpenFailure(logTag: string, reason: OpenFailureReason, error?: unknown): void {
  switch (reason) {
    case "no-sqlite":
      console.error(
        `${logTag} 当前环境不支持 node:sqlite（需思源 Electron 44+ / Node 24+），该功能不可用。`,
      )
      break
    case "no-node":
      console.error(`${logTag} 当前环境无 Node 文件系统能力（非 Electron 渲染进程），该功能不可用。`)
      break
    case "open-failed": {
      const detail = error instanceof Error ? error.message : String(error ?? "未知错误")
      console.error(
        `${logTag} 数据库打开失败（不可重试）：${detail}。`
        + `常见原因：plugin.db 被其它进程独占、文件损坏或磁盘只读；详见上方 [sqlite] 日志。`,
      )
      break
    }
    default:
      console.error(`${logTag} 数据库不可用（${reason}）。`)
  }
}

/**
 * 插件数据库句柄：薄封装 DatabaseSync，附加迁移与快照能力。
 * 所有 SQL 均通过 prepared statement 传参，禁止字符串拼接（防注入）。
 */
export class PluginDatabase {
  private readonly sqlite: SqliteModule
  private readonly db: SqliteDatabaseSync
  private readonly dbPath: string
  private closed = false

  constructor(sqlite: SqliteModule, db: SqliteDatabaseSync, dbPath: string) {
    this.sqlite = sqlite
    this.db = db
    this.dbPath = dbPath
  }

  /** 库文件绝对路径 */
  getPath(): string {
    return this.dbPath
  }

  /** 执行不返回结果的 SQL（建表 / PRAGMA 等） */
  exec(sql: string): void {
    this.db.exec(sql)
  }

  /** 查询多行 */
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...params) as T[]
  }

  /** 查询单行（无结果返回 undefined） */
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined
  }

  /** 执行写入，返回受影响行数 */
  run(sql: string, ...params: unknown[]): number {
    const result = this.db.prepare(sql).run(...params)
    return Number(result.changes)
  }

  /**
   * 在事务中执行（异常自动回滚）。
   * SQLite 的事务在单连接上是串行的，回调内不要再嵌套 withTransaction。
   */
  withTransaction<T>(fn: () => T): T {
    this.db.exec("BEGIN")
    try {
      const result = fn()
      this.db.exec("COMMIT")
      return result
    } catch (error) {
      try {
        this.db.exec("ROLLBACK")
      } catch {
        // 回滚失败不掩盖原始异常
      }
      throw error
    }
  }

  /**
   * 读取 user_version（结构版本号，用于迁移判定）
   */
  getUserVersion(): number {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined
    return Number(row?.user_version ?? 0)
  }

  /**
   * 设置 user_version（结构迁移完成后调用）
   */
  setUserVersion(version: number): void {
    // PRAGMA 不支持参数绑定，此处版本号来自代码常量而非外部输入
    this.db.exec(`PRAGMA user_version=${Math.max(0, Math.floor(version))}`)
  }

  /**
   * 产出**单文件一致性快照**（SQLite 官方在线备份 API）。
   *
   * 为什么必须用它而不是复制 `.db`：WAL 模式下已提交数据可能仍在 `-wal` 中，
   * 直接复制 `.db` 会得到空库（实测 `no such table`）。本方法在库处于打开状态、
   * 甚至并发写入时也能产出完整可用的单文件快照。
   *
   * @param destPath 目标文件路径（同目录下的临时名即可，调用方可再改名/打包）
   */
  snapshotTo(destPath: string): void {
    // node:sqlite 的 backup() 是同步的：这里不声明 async，
    // 让失败同步抛出（带 destPath 上下文），而不是变成一个无人 await 的 rejected Promise
    try {
      this.sqlite.backup(this.db, destPath)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`[sqlite] 生成快照失败 [${destPath}]: ${reason}`)
    }
  }

  /**
   * 把 WAL 内容并回主库并截断 `-wal`（仅在确定无并发写时使用）。
   * 适用于「确实需要直接复制 .db」的场景；一般备份请优先用 snapshotTo()。
   */
  checkpoint(): void {
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)")
  }

  /** 关闭连接（幂等）；关闭后 SQLite 会自动把 WAL 归并回主库 */
  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      this.db.close()
    } catch (error) {
      console.error("[sqlite] 关闭数据库失败:", error)
    }
  }
}

/**
 * 删除 SQLite 的三件套文件（主库 + wal + shm）。
 * 用于「首次导入后清理旧 JSON」或回滚时彻底移除库文件。
 */
export function removeDatabaseFiles(dbPath: string): void {
  const node = getNodeFsPathOs()
  if (!node) return
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      node.fs.rmSync(dbPath + suffix, { force: true })
    } catch {
      // 删除失败不阻塞（文件可能被占用）
    }
  }
}
