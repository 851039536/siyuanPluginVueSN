/**
 * 数据管理 - 全量备份 / 逻辑还原
 *
 * 全量备份复用 `@/utils/settingsBackup`（整目录 zip，不持有运行期文件句柄）。
 * 运行中还原只做逻辑写回：JSON 槽按 key 写回，`git-push-index` 文件槽整目录替换。
 * 旧版备份中的 `plugin.db` 会被忽略（插件已移除 SQLite）。
 */
import JSZip from "jszip"
import { JSON_SLOTS } from "@/config/storage"
import type {
  BackupResult,
  PluginBackupListItem,
} from "@/utils/settingsBackup"
import {
  backupPluginData,
  deletePluginBackup,
  listPluginBackups,
} from "@/utils/settingsBackup"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { readWorkspaceDir } from "@/utils/workspaceDir"
import type {
  ImportReport,
  ModuleExportPayload,
} from "../types/model"
import type { StorageContext } from "./context"

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

/** 备份目录绝对路径（`<workspace>/data-backup`）；未就绪时为空串 */
export async function getBackupDir(): Promise<string> {
  const root = await getWorkspaceRoot()
  const node = getNodeFsPathOs()
  return root && node ? node.path.join(root, "data-backup") : ""
}

/** 删除一个备份 */
export async function deleteBackup(fileName: string): Promise<boolean> {
  const root = await getWorkspaceRoot()
  return root ? deletePluginBackup(root, fileName) : false
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

  // 旧备份可能含 plugin.db：插件已移除 SQLite，明确跳过而不是静默解压
  if (zip.file("plugin.db") || zip.file("plugin.db-wal") || zip.file("plugin.db-shm")) {
    report.skipped.push({ slotId: "core.pluginDb", reason: "sqliteRemoved" })
  }

  const hasData = Object.keys(payload.slots).length > 0
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
