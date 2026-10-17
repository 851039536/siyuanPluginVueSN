/**
 * 插件设置备份/恢复工具
 *
 * 将插件数据目录整体打包为 zip 备份到 workspace/data-backup/，
 * 恢复时解压回原目录。
 *
 * ⚠️ SQLite/WAL 一致性（关键）：
 * 备份目录中可能含 SQLite 库（见 @/utils/sqliteDb）。WAL 模式下已提交数据可能仍在
 * `-wal` 附属文件里（实测主库 4KB / wal 48KB），若逐个 readFileSync 三个文件，
 * 可能抓到「新 .db + 旧 -wal」的错配组合，恢复出损坏库；而用户只取 .db 时更会得到空库。
 * 因此备份前必须先对每个库做 checkpoint（把 WAL 并回主库），使 .db 自包含。
 */
import JSZip from "jszip"
import { Plugin } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getSqlite } from "@/utils/sqliteDb"

/** 备份结果 */
export interface BackupResult {
  fileName: string
  filePath: string
  size: number
  fileCount: number
}

/** SQLite 附属文件名后缀（WAL 模式产物） */
const SQLITE_SIDECAR_SUFFIXES = ["-wal", "-shm"] as const

/**
 * 把目录内所有 SQLite 库的 WAL 内容并回主库（best-effort）。
 *
 * 库正被插件持有时无法再开第二个连接，此时由持有方自行 checkpoint；
 * 本函数仅处理「备份时无人持有」的库，失败静默（不影响其余文件备份）。
 */
function checkpointDatabasesInDir(dirPath: string, fs: any, path: any): void {
  // 走统一入口（@/utils/sqliteDb），避免在本文件重复 require 与类型推导
  const sqlite = getSqlite()
  if (!sqlite) return

  const walk = (dir: string): void => {
    let entries: any[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith(".db")) continue
      try {
        const db = new sqlite.DatabaseSync(full)
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)")
        db.close()
      } catch {
        // 库被占用或损坏：跳过，后续仍按原样打包
      }
    }
  }
  walk(dirPath)
}

/** 递归添加目录到 zip */
function addDirToZip(zip: JSZip, dirPath: string, relativePath: string, fs: any, path: any) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, relPath, fs, path)
    } else {
      zip.file(relPath, fs.readFileSync(fullPath))
    }
  }
}

/**
 * 将 zip 内容解压到目标目录。
 *
 * SQLite 三件套处理：解压回 .db 时若同时存在 -wal/-shm，交由 SQLite 自行完成 WAL 恢复，
 * **禁止**手动删除 -wal（那会丢掉尚未归并的数据）。
 */
async function extractZipToDir(zip: JSZip, targetDir: string, fs: any, path: any): Promise<number> {
  let count = 0
  for (const [relativePath, zipEntry] of Object.entries(zip.files) as [string, any][]) {
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

  const pluginDataDir = `${workspaceRoot}/data/storage/petal/${plugin.name}`
  if (!node.fs.existsSync(pluginDataDir)) {
    throw new Error(`插件数据目录不存在: ${pluginDataDir}`)
  }

  // 先归并 WAL，确保 .db 自包含（否则单独取 .db 会得到空库）
  checkpointDatabasesInDir(pluginDataDir, node.fs, node.path)

  const zip = new JSZip()
  addDirToZip(zip, pluginDataDir, "", node.fs, node.path)
  const content = await zip.generateAsync({ type: "nodebuffer" })

  const backupDir = `${workspaceRoot}/data-backup`
  if (!node.fs.existsSync(backupDir)) {
    node.fs.mkdirSync(backupDir, { recursive: true })
  }

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const ts = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const fileName = `sn-plugin-${ts}.zip`
  const filePath = node.path.join(backupDir, fileName)

  node.fs.writeFileSync(filePath, content)
  return {
    fileName,
    filePath,
    size: content.length,
    fileCount: Object.keys(zip.files).length,
  }
}

/**
 * 从上传的 zip 文件恢复插件数据
 */
export async function restoreFromUpload(file: File, plugin: Plugin, workspaceRoot: string): Promise<{ restored: number }> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = `${workspaceRoot}/data/storage/petal/${plugin.name}`
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
