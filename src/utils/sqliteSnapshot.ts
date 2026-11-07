/**
 * SQLite 一致性快照工具
 *
 * WAL 模式下已提交数据可能仍在 `-wal` 中，直接复制 `.db` 会得到空库；
 * `wal_checkpoint(TRUNCATE)` 在并发写时可能 busy 而不截断。因此备份/导出统一走
 * SQLite 官方在线备份 API（`sqlite.backup`），在库被其它连接持有、甚至并发写入时
 * 仍能产出完整单文件快照。
 */
import type { SqliteDatabaseSync } from "./sqliteDb"
import { getNodeFsPathOs } from "./nodeModules"
import { getSqlite, waitForSyncIdle } from "./sqliteDb"

/** 单个库文件的一致性快照结果 */
export interface DatabaseSnapshotEntry {
  /** 相对扫描目录根的路径（含 .db 后缀） */
  relPath: string
  /** 快照绝对路径；生成失败为 null（调用方应回退到原文件 + sidecar） */
  snapshotPath: string | null
}

/**
 * 为单个库文件生成一致性快照。
 *
 * ⚠️ `node:sqlite` 的 `backup()` 返回 Promise，必须 await 后再关闭连接并读文件；
 * 调用后立即 `statSync` 会得到 0 字节（实测 Node 24.15）。返回 false 时调用方
 * 应回退到「原库 + -wal/-shm」一起打包。
 *
 * @param dbPath 源库绝对路径
 * @param destPath 快照目标绝对路径（目录必须已存在）
 */
export async function snapshotDatabaseFile(dbPath: string, destPath: string): Promise<boolean> {
  const sqlite = getSqlite()
  const node = getNodeFsPathOs()
  if (!sqlite || !node) return false

  // 同步窗口内先等结束：这里的裸连接不在 liveDatabases 里，守卫无法关闭它，
  // 打开后会重新锁住 plugin.db，让 dejavu 的 rename 失败。
  // 备份不阻塞用户操作，超时就直接跳过（调用方回退为「原库 + sidecar」），
  // 不像 openPluginDatabase 那样放弃整轮同步窗口。
  if (!(await waitForSyncIdle())) {
    console.warn(`[sqliteSnapshot] 思源正在同步，跳过一致性快照 [${dbPath}]`)
    return false
  }

  let db: SqliteDatabaseSync | null = null
  try {
    db = new sqlite.DatabaseSync(dbPath)
    await sqlite.backup(db, destPath)
    return node.fs.statSync(destPath).size > 0
  } catch (error) {
    console.warn(`[sqliteSnapshot] 生成快照失败 [${dbPath}]:`, error)
    return false
  } finally {
    try {
      db?.close()
    } catch {
      // 关闭失败不掩盖快照结果
    }
  }
}

/**
 * 递归扫描目录内所有 `.db` 并生成快照。
 * @param dirPath 扫描根目录
 * @param tempDir 快照临时目录（必须位于扫描目录之外，否则会被自己打包进去）
 */
export async function snapshotDatabasesInDir(dirPath: string, tempDir: string): Promise<DatabaseSnapshotEntry[]> {
  const node = getNodeFsPathOs()
  if (!node) return []

  const { fs, path } = node
  // 惰性创建：没有 .db 时不留空临时目录
  let tempReady = false

  const entries: DatabaseSnapshotEntry[] = []
  const walk = async (dir: string): Promise<void> => {
    let dirEntries: import("node:fs").Dirent[]
    try {
      dirEntries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of dirEntries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.name.endsWith(".db")) continue

      if (!tempReady) {
        fs.mkdirSync(tempDir, { recursive: true })
        tempReady = true
      }

      const relPath = path.relative(dirPath, fullPath).replace(/\\/g, "/")
      const snapshotPath = path.join(tempDir, `${relPath.replace(/\//g, "__")}`)
      entries.push({
        relPath,
        snapshotPath: await snapshotDatabaseFile(fullPath, snapshotPath) ? snapshotPath : null,
      })
    }
  }
  await walk(dirPath)
  return entries
}

/** 清理快照临时目录（best-effort） */
export function cleanupSnapshotDir(tempDir: string): void {
  const node = getNodeFsPathOs()
  if (!node) return
  try {
    node.fs.rmSync(tempDir, { recursive: true, force: true })
  } catch (error) {
    console.warn(`[sqliteSnapshot] 清理临时目录失败 [${tempDir}]:`, error)
  }
}

/** 判断相对路径是否为 SQLite WAL 附属文件 */
export function isSqliteSidecar(relPath: string): boolean {
  return relPath.endsWith(".db-wal") || relPath.endsWith(".db-shm")
}

/** 取 sidecar 对应的主库相对路径（`a.db-wal` → `a.db`） */
export function sidecarBasePath(relPath: string): string {
  return relPath.replace(/-wal$/, "").replace(/-shm$/, "")
}
