/**
 * 数据管理 - 全量备份 / 逻辑还原
 *
 * 全量备份复用 `@/utils/settingsBackup`（内部已用 SQLite 在线快照）。
 * 运行中还原只做逻辑写回：JSON 按 key 写回，SQLite 从 zip 内的临时库读出后整表替换；
 * **禁止**在插件运行中覆盖 `plugin.db` 等被连接持有的文件。
 */
import JSZip from "jszip"
import {
  JSON_SLOTS,
  SQLITE_SLOTS,
} from "@/config/storage"
import type {
  BackupResult,
  PluginBackupListItem,
} from "@/utils/settingsBackup"
import {
  backupPluginData,
  deletePluginBackup,
  listPluginBackups,
} from "@/utils/settingsBackup"
import type { SqliteDatabaseSync } from "@/utils/sqliteDb"
import { getSqlite } from "@/utils/sqliteDb"
import { readWorkspaceDir } from "@/utils/workspaceDir"
import type {
  ImportReport,
  ModuleExportPayload,
} from "../types/model"
import { isSafeTableName, type StorageContext } from "./context"

/** 可还原的文件槽前缀（与注册表 gitPush.index 对应） */
const RESTORABLE_FILE_PREFIX = "git-push-index/"

async function getWorkspaceRoot(): Promise<string> {
  return readWorkspaceDir()
}

/** 全量备份插件数据目录 */
export async function createFullBackup(ctx: StorageContext): Promise<BackupResult> {
  const root = await getWorkspaceRoot()
  if (!root) throw new Error("workspaceUnresolved")
  return backupPluginData(ctx.plugin, root)
}

/** 列出已有插件整目录备份 */
export async function listBackups(): Promise<PluginBackupListItem[]> {
  const root = await getWorkspaceRoot()
  return root ? listPluginBackups(root) : []
}

/** 删除一个备份 */
export async function deleteBackup(fileName: string): Promise<boolean> {
  const root = await getWorkspaceRoot()
  return root ? deletePluginBackup(root, fileName) : false
}

/** 从 zip 中读出注册表内的 SQLite 表 */
async function readSqliteTables(
  ctx: StorageContext,
  zip: JSZip,
  payload: ModuleExportPayload,
  report: ImportReport,
): Promise<void> {
  const dbEntry = zip.file("plugin.db")
  if (!dbEntry) return

  const root = await getWorkspaceRoot()
  if (!root) {
    report.failed.push({ slotId: "core.pluginDb", error: "workspaceUnresolved" })
    return
  }

  const tempDir = ctx.path.join(root, "data-backup", ".tmp", `restore-${Date.now()}`)
  try {
    ctx.fs.mkdirSync(tempDir, { recursive: true })
    const tempDbPath = ctx.path.join(tempDir, "plugin.db")
    ctx.fs.writeFileSync(tempDbPath, await dbEntry.async("nodebuffer"))
    // 兼容旧备份（快照失败时可能连 -wal/-shm 一起打包）：一并解出，让 SQLite 自行恢复
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = zip.file(`plugin.db${suffix}`)
      if (sidecar) {
        ctx.fs.writeFileSync(`${tempDbPath}${suffix}`, await sidecar.async("nodebuffer"))
      }
    }

    const sqlite = getSqlite()
    if (!sqlite) {
      for (const slot of SQLITE_SLOTS) {
        report.failed.push({ slotId: slot.id, error: "sqliteUnavailable" })
      }
      return
    }

    let db: SqliteDatabaseSync | null = null
    try {
      // 临时库可写：允许 SQLite 自行恢复旧备份里可能附带的 -wal
      db = new sqlite.DatabaseSync(tempDbPath)
      for (const slot of SQLITE_SLOTS) {
        if (!isSafeTableName(slot.key)) continue
        const exists = db.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ).get(slot.key)
        if (!exists) continue
        payload.tables[slot.key] = db.prepare(`SELECT * FROM "${slot.key}"`).all() as Record<string, unknown>[]
      }
    } finally {
      try {
        db?.close()
      } catch {
        // 关闭失败不掩盖读取结果
      }
    }
  } catch (error) {
    report.failed.push({
      slotId: "core.pluginDb",
      error: error instanceof Error ? error.message : "sqliteReadFailed",
    })
  } finally {
    try {
      ctx.fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // 清理失败不阻塞还原
    }
  }
}

/** 还原可还原的文件槽（仅 git-push-index；带 zip-slip 防护） */
async function restoreFileSlots(ctx: StorageContext, zip: JSZip): Promise<number> {
  const entries = Object.entries(zip.files).filter(([rawRel, entry]) => {
    const rel = rawRel.replace(/\\/g, "/")
    return !entry.dir && rel.startsWith(RESTORABLE_FILE_PREFIX) && !rel.includes("..")
  })
  if (!entries.length) return 0

  // 整目录替换：先清空旧索引，避免新旧文件混合（调用方已完成全量快照）
  const dirName = RESTORABLE_FILE_PREFIX.replace(/\/$/, "")
  ctx.fs.rmSync(ctx.path.join(ctx.dataDir, dirName), { recursive: true, force: true })

  let count = 0
  for (const [rawRel, entry] of entries) {
    const rel = rawRel.replace(/\\/g, "/")
    const target = ctx.path.join(ctx.dataDir, rel)
    ctx.fs.mkdirSync(ctx.path.dirname(target), { recursive: true })
    ctx.fs.writeFileSync(target, await entry.async("nodebuffer"))
    count++
  }
  return count
}

/** 可还原文件槽的写回句柄：等全量快照完成后再执行，避免快照失败时已改动文件 */
export interface RestorableFileSource {
  write: (ctx: StorageContext) => Promise<number>
}

/**
 * 读取上传的 zip 备份并解析为载荷（只读，不落盘）。
 *
 * 调用方先校验本步骤，再创建全量快照，最后调用 `applyPayload()` 与 `fileSource.write()`。
 */
export async function loadBackupZip(
  ctx: StorageContext,
  file: File,
): Promise<{ payload: ModuleExportPayload | null, report: ImportReport, fileSource: RestorableFileSource | null }> {
  const report: ImportReport = {
    applied: [],
    skipped: [],
    failed: [],
    requiresReload: false,
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    report.failed.push({ slotId: "*", error: "invalidZip" })
    return { payload: null, report, fileSource: null }
  }

  const payload: ModuleExportPayload = {
    version: 1,
    exportedAt: Date.now(),
    owners: [],
    slots: {},
    tables: {},
  }

  for (const slot of JSON_SLOTS) {
    if (!slot.restorable) continue
    const entry = zip.file(slot.key)
    if (!entry) continue
    try {
      // 备份是插件数据目录的原样打包，不能假定每个槽都是 JSON：
      // SiYuan saveData 对字符串值原样落盘（如 `xsmall` / `head`），强制 JSON.parse
      // 会把这类槽误判为损坏，导致整份备份「还原失败」。按原始文本读入，
      // 写回时 saveData 同样原样落盘，字节一致。
      payload.slots[slot.key] = await entry.async("string")
    } catch {
      report.failed.push({ slotId: slot.id, error: "readFailed" })
    }
  }

  await readSqliteTables(ctx, zip, payload, report)

  const hasData = Object.keys(payload.slots).length > 0 || Object.keys(payload.tables).length > 0
  const hasFiles = Object.keys(zip.files).some((rel) => {
    const normalized = rel.replace(/\\/g, "/")
    return normalized.startsWith(RESTORABLE_FILE_PREFIX) && zip.files[rel]?.dir !== true
  })
  if (!hasData && !hasFiles) {
    // 常见误选：把「整工作区备份 data-*.zip」当成插件备份上传
    report.failed.push({ slotId: "*", error: "noRestorableData" })
    return { payload: null, report, fileSource: null }
  }

  return {
    payload,
    report,
    fileSource: {
      write: (targetCtx: StorageContext) => restoreFileSlots(targetCtx, zip),
    },
  }
}
