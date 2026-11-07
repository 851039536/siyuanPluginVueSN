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
 *
 * Windows 同步注意事项（关键，勿删）：
 * `plugin.db` 位于 `<工作区>/data/storage/petal/<插件>/`，是思源同步目录的一部分。
 * 思源同步引擎（dejavu）下载文件时先写同目录临时文件、再 `os.Rename` 覆盖目标；
 * 而 SQLite 在 Windows 上打开库文件时**不带 FILE_SHARE_DELETE**，只要连接保持打开，
 * rename 就报 "Access is denied"，重试 3 次后整轮同步失败 ——
 * 即用户看到的「同步失败：读写文件或访问网络权限不足」。
 * 因此本模块强制两条：
 * 1) 句柄**空闲即释放**（`IDLE_RELEASE_MS` 后 close，下次访问惰性重开）；
 * 2) 思源广播同步状态时立即释放所有句柄，并在**同步窗口内拒绝重开**
 *    （`installSqliteSyncGuard` 监听 `ws-main` 的 `syncing`，`sync-start` 仅兜底）。
 * 副作用正好是需要的：关闭最后一个连接会让 SQLite 归并 WAL 并删除 `-wal`/`-shm`，
 * 而 dejavu 的忽略规则（仅点号前缀与 `.tmp`）并不会跳过这两个附属文件，
 * 常驻句柄会让它们被同步到其它设备。
 *
 * ⚠️ 不能用 `sync-start` 作为唯一信号：思源 3.8.9 的 `syncing` 处理函数在
 * `#barSync` 元素不存在时会提前 return，`sync-start` 根本不会发到插件事件总线。
 *
 * 已知限制：同步窗口内数据库访问会被拒绝（异步入口先等待，最多 10s）；
 * 超时后**放弃本轮同步窗口**并放行访问 —— 否则该功能会在整个会话内不可用。
 * 代价是本轮同步可能失败，下一轮恢复。
 *
 * 职责拆分：会话与句柄生命周期（`PluginDatabase`、空闲释放、同步守卫）在
 * `./sqliteDatabase`，本文件保留路径解析、打开重试与对外汇聚（re-export），
 * 消费方仍统一从 `@/utils/sqliteDb` 导入。
 */
import type { Plugin } from "siyuan"
import { abandonSyncWindow, createHandle, getSqlite, PluginDatabase, waitForSyncIdle } from "./sqliteDatabase"
import { getNodeFsPathOs } from "./nodeModules"
import { resolvePluginDataDir } from "./pluginDataDir"

/** 对外导出面保持不变（会话/守卫已拆至 ./sqliteDatabase） */
export {
  getSqlite,
  installSqliteSyncGuard,
  isSqliteAvailable,
  PluginDatabase,
  waitForSyncIdle,
} from "./sqliteDatabase"
export type { SqliteDatabaseSync } from "./sqliteDatabase"

/**
 * 全插件唯一的库文件名（不含扩展名）。
 * 落在 `<插件数据目录>/plugin.db`，所有功能共享，靠表名前缀隔离。
 */
export const PLUGIN_DB_NAME = "plugin"

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
 * 插件数据目录解析已迁至 `@/utils/pluginDataDir`（统一入口）。
 * 此处保留 re-export，避免既有消费方改动导入路径。
 */
export { resolvePluginDataDir }

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

  // 同步窗口内先等结束：此刻打开文件会让 dejavu 的 rename 失败（见文件头说明）。
  // 超时则**放弃本轮窗口**：只打开不放行没有意义 —— acquire() 仍会抛错，
  // 紧随其后的建表会失败，openWithRetry 只能返回 null 且不再重试（功能整会话不可用）。
  if (!(await waitForSyncIdle())) {
    abandonSyncWindow()
  }

  try {
    // 目录可能尚未创建（首次运行且插件从未写过 saveData）
    node.fs.mkdirSync(node.path.dirname(dbPath), { recursive: true })
    return { ok: true, db: new PluginDatabase(sqlite, createHandle(sqlite, dbPath), dbPath) }
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
