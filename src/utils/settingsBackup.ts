/**
 * 插件设置备份/恢复工具
 *
 * 将插件数据目录整体打包为 zip 备份到 `<workspace>/data-backup/`。
 * 所有数据均为思源 saveData JSON 槽或普通文件，直接读取即可，不持有运行期文件句柄；
 * 备份/还原不再需要数据库快照或 WAL 处理。
 */
import JSZip from "jszip"
import type { Plugin } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { resolvePluginDataDir } from "@/utils/pluginDataDir"

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

const BACKUP_FILE_RE = /^sn-plugin-\d{6}-\d{6}\.zip$/

/** 生成 `YYMMDD-HHmmss` 时间戳 */
function makeTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** 递归添加目录到 zip */
function addDirToZip(
  zip: JSZip,
  dirPath: string,
  relativePath: string,
  fs: NodeFS,
  path: NodePath,
) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, relPath, fs, path)
      continue
    }
    zip.file(relPath, fs.readFileSync(fullPath))
  }
}

/**
 * 将 zip 内容解压到目标目录。
 * 不做任何文件类型特判：备份是整目录原样打包，还原也应当原样写回。
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

  const zip = new JSZip()
  addDirToZip(zip, pluginDataDir, "", node.fs, node.path)
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
}

/**
 * 从上传的 zip 文件恢复插件数据（**二进制整目录覆盖**）
 *
 * ⚠️ 仅适用于插件禁用后的手动恢复；运行中请使用 storageManager 的「逻辑还原」。
 * 备份内若残留旧版 `plugin.db`，会被原样解压但运行时不再读取（见迁移脚本说明）。
 */
export async function restoreFromUpload(file: File, plugin: Plugin, workspaceRoot: string): Promise<{ restored: number }> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = (await resolvePluginDataDir(plugin))
    || node.path.join(workspaceRoot, "data", "storage", "petal", plugin.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)

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
