/**
 * 插件设置备份/恢复工具
 *
 * 将插件数据目录整体打包为 zip 备份到 `<workspace>/data-backup/`。
 *
 * ⚠️ SQLite/WAL 一致性（关键）：
 * 备份目录中可能含 SQLite 库（`plugin.db`）。WAL 模式下已提交数据可能仍在 `-wal`
 * 中，直接复制三个文件会得到「新 .db + 旧 -wal」的错配组合，只取 .db 更是空库。
 * 因此备份前必须用 SQLite 官方在线备份 API 产出单文件快照（见 `@/utils/sqliteSnapshot`），
 * zip 内用快照替换 `.db` 并**跳过 `-wal` / `-shm`**。
 */
import JSZip from "jszip"
import type { Plugin } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { resolvePluginDataDir } from "@/utils/pluginDataDir"
import type { DatabaseSnapshotEntry } from "@/utils/sqliteSnapshot"
import {
  cleanupSnapshotDir,
  isSqliteSidecar,
  sidecarBasePath,
  snapshotDatabasesInDir,
} from "@/utils/sqliteSnapshot"

type NodeFS = typeof import("node:fs")
type NodePath = typeof import("node:path")

/** 备份结果 */
export interface BackupResult {
  fileName: string
  filePath: string
  size: number
  fileCount: number
  createdAt: number
}

/** 备份列表项 */
export interface PluginBackupListItem {
  fileName: string
  filePath: string
  size: number
  createdAt: number
}

/** SQLite 附属文件名后缀（WAL 模式产物） */
const SQLITE_SIDECAR_SUFFIXES = ["-wal", "-shm"] as const
const BACKUP_FILE_RE = /^sn-plugin-\d{6}-\d{6}\.zip$/

/** 生成 `YYMMDD-HHmmss` 时间戳 */
function makeTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/**
 * 递归添加目录到 zip。
 * `.db` 优先用一致性快照；对应快照成功时跳过 `-wal` / `-shm`。
 */
function addDirToZip(
  zip: JSZip,
  dirPath: string,
  relativePath: string,
  snapshotMap: Map<string, string>,
  fs: NodeFS,
  path: NodePath,
) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, relPath, snapshotMap, fs, path)
      continue
    }
    if (entry.name.endsWith(".db")) {
      const snapshotPath = snapshotMap.get(relPath)
      zip.file(relPath, fs.readFileSync(snapshotPath || fullPath))
      continue
    }
    if (isSqliteSidecar(relPath) && snapshotMap.has(sidecarBasePath(relPath))) {
      continue
    }
    zip.file(relPath, fs.readFileSync(fullPath))
  }
}

/**
 * 将 zip 内容解压到目标目录。
 *
 * SQLite 三件套处理：解压回 .db 时若同时存在 -wal/-shm，交由 SQLite 自行完成 WAL 恢复，
 * **禁止**手动删除 -wal（那会丢掉尚未归并的数据）。
 */
async function extractZipToDir(zip: JSZip, targetDir: string, fs: NodeFS, path: NodePath): Promise<number> {
  let count = 0
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue
    const targetPath = path.join(targetDir, relativePath)
    const targetSubDir = path.dirname(targetPath)
    if (!fs.existsSync(targetSubDir)) {
      fs.mkdirSync(targetSubDir, { recursive: true })
    }
    fs.writeFileSync(targetPath, await zipEntry.async("nodebuffer"))
    count++
  }
  return count
}

/**
 * 备份插件数据目录为 zip 文件
 */
export async function backupPluginData(plugin: Plugin, workspaceRoot: string): Promise<BackupResult> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = await resolvePluginDataDir(plugin)
  if (!pluginDataDir) throw new Error("无法解析插件数据目录（工作区路径尚未就绪）")
  if (!node.fs.existsSync(pluginDataDir)) {
    throw new Error(`插件数据目录不存在: ${pluginDataDir}`)
  }

  const now = new Date()
  const backupDir = node.path.join(workspaceRoot, "data-backup")
  const tempDir = node.path.join(backupDir, ".tmp", `snapshot-${now.getTime()}`)

  let snapshots: DatabaseSnapshotEntry[] = []
  try {
    snapshots = await snapshotDatabasesInDir(pluginDataDir, tempDir)
    const snapshotMap = new Map<string, string>()
    for (const entry of snapshots) {
      if (entry.snapshotPath) snapshotMap.set(entry.relPath, entry.snapshotPath)
    }

    const zip = new JSZip()
    addDirToZip(zip, pluginDataDir, "", snapshotMap, node.fs, node.path)
    const content = await zip.generateAsync({ type: "nodebuffer" })

    if (!node.fs.existsSync(backupDir)) {
      node.fs.mkdirSync(backupDir, { recursive: true })
    }

    const fileName = `sn-plugin-${makeTimestamp(now)}.zip`
    const filePath = node.path.join(backupDir, fileName)
    node.fs.writeFileSync(filePath, content)

    return {
      fileName,
      filePath,
      size: content.length,
      fileCount: Object.keys(zip.files).length,
      createdAt: now.getTime(),
    }
  } finally {
    // 无 .db 时不会创建临时目录；rm -rf 是幂等的
    cleanupSnapshotDir(tempDir)
  }
}

/**
 * 从上传的 zip 文件恢复插件数据（**二进制整目录覆盖**）
 *
 * ⚠️ 仅适用于插件禁用后的手动恢复；运行中请使用 storageManager 的「逻辑还原」，
 * 直接覆盖被连接持有的 `plugin.db` 会失败或损坏数据。
 */
export async function restoreFromUpload(file: File, plugin: Plugin, workspaceRoot: string): Promise<{ restored: number }> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = (await resolvePluginDataDir(plugin))
    || node.path.join(workspaceRoot, "data", "storage", "petal", plugin.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)

  // 恢复前清掉现存库的 WAL 附属文件：旧的 -wal 若与备份中的新 .db 混搭会损坏数据。
  // （备份内自带的 -wal/-shm 会在下面正常解压回来，由 SQLite 自行恢复。）
  const zipHasWal = Object.keys(zip.files).some((p) =>
    SQLITE_SIDECAR_SUFFIXES.some((s) => p.endsWith(s)))
  if (!zipHasWal) {
    for (const rel of Object.keys(zip.files)) {
      if (!rel.endsWith(".db")) continue
      for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
        try {
          node.fs.rmSync(node.path.join(pluginDataDir, rel + suffix), { force: true })
        } catch {
          // 忽略
        }
      }
    }
  }

  const restored = await extractZipToDir(zip, pluginDataDir, node.fs, node.path)

  return { restored }
}

/** 列出插件整目录备份（`sn-plugin-*.zip`），按时间倒序 */
export function listPluginBackups(workspaceRoot: string): PluginBackupListItem[] {
  const node = getNodeModules()
  if (!node) return []

  const backupDir = node.path.join(workspaceRoot, "data-backup")
  if (!node.fs.existsSync(backupDir)) return []

  const items: PluginBackupListItem[] = []
  for (const name of node.fs.readdirSync(backupDir)) {
    if (!BACKUP_FILE_RE.test(name)) continue
    const filePath = node.path.join(backupDir, name)
    try {
      const stat = node.fs.statSync(filePath)
      items.push({
        fileName: name,
        filePath,
        size: stat.size,
        createdAt: stat.mtimeMs,
      })
    } catch {
      // 文件在扫描后被删除：跳过
    }
  }
  return items.sort((a, b) => b.createdAt - a.createdAt)
}

/** 删除一个插件整目录备份（只允许 `data-backup` 下的 `sn-plugin-*.zip`） */
export function deletePluginBackup(workspaceRoot: string, fileName: string): boolean {
  const node = getNodeModules()
  if (!node) return false
  if (node.path.basename(fileName) !== fileName || !BACKUP_FILE_RE.test(fileName)) {
    return false
  }
  try {
    node.fs.rmSync(node.path.join(workspaceRoot, "data-backup", fileName), { force: true })
    return true
  } catch (error) {
    console.error(`[settingsBackup] 删除备份失败 [${fileName}]:`, error)
    return false
  }
}
