/**
 * 插件设置备份/恢复工具
 *
 * 将插件数据目录整体打包为 zip 备份到 workspace/data-backup/，
 * 恢复时解压回原目录。
 */
import JSZip from "jszip"
import { Plugin } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"

/** 备份结果 */
export interface BackupResult {
  fileName: string
  filePath: string
  size: number
  fileCount: number
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

/** 将 zip 内容解压到目标目录 */
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
  return { fileName, filePath, size: content.length, fileCount: Object.keys(zip.files).length }
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
  const restored = await extractZipToDir(zip, pluginDataDir, node.fs, node.path)

  return { restored }
}
