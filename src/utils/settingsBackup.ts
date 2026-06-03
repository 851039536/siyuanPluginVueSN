/**
 * 插件设置备份/恢复工具
 *
 * 将插件数据目录整体打包为 zip 备份到 workspace/data-backup/，
 * 恢复时解压回原目录。
 */
import JSZip from "jszip"
import { Plugin } from "siyuan"

/** 备份结果 */
export interface BackupResult {
  fileName: string
  filePath: string
  size: number
  fileCount: number
}

/** 获取 fs/path/JSZip */
function getNodeModules(): { fs: any, path: any } | null {
  try {
    const fs = require("node:fs")
    const path = require("node:path")
    return { fs, path }
  } catch {
    return null
  }
}

/**
 * 备份插件数据目录为 zip 文件
 * @param plugin 插件实例
 * @param workspaceRoot 工作区根目录（如 E:\siyuan）
 */
export async function backupPluginData(plugin: Plugin, workspaceRoot: string): Promise<BackupResult> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = `${workspaceRoot}/data/storage/petal/${plugin.name}`
  if (!node.fs.existsSync(pluginDataDir)) {
    throw new Error(`插件数据目录不存在: ${pluginDataDir}`)
  }


  const zip = new JSZip()

  // 递归读取目录下所有文件
  const { fs, path } = node
  function addDir(dirPath: string, relativePath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        addDir(fullPath, relPath)
      } else {
        zip.file(relPath, fs.readFileSync(fullPath))
      }
    }
  }

  addDir(pluginDataDir, "")

  const content = await zip.generateAsync({ type: "nodebuffer" })

  // 保存到 workspace/data-backup/
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
 * 从 zip 文件恢复插件数据
 * @param backupFilePath zip 文件路径
 * @param plugin 插件实例
 * @param workspaceRoot 工作区根目录
 */
export async function restorePluginData(
  backupFilePath: string,
  plugin: Plugin,
  workspaceRoot: string,
): Promise<{ restored: number }> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = `${workspaceRoot}/data/storage/petal/${plugin.name}`


  const buffer = node.fs.readFileSync(backupFilePath)
  const zip = await JSZip.loadAsync(buffer)

  let restored = 0

  for (const [relativePath, zipEntry] of Object.entries(zip.files) as [string, any][]) {
    if (zipEntry.dir) continue

    const targetPath = node.path.join(pluginDataDir, relativePath)
    const targetDir = node.path.dirname(targetPath)

    if (!node.fs.existsSync(targetDir)) {
      node.fs.mkdirSync(targetDir, { recursive: true })
    }

    const data = await zipEntry.async("nodebuffer")
    node.fs.writeFileSync(targetPath, data)
    restored++
  }

  return { restored }
}

/**
 * 从上传的 zip 文件恢复
 */
export async function restoreFromUpload(
  file: File,
  plugin: Plugin,
  workspaceRoot: string,
): Promise<{ restored: number }> {
  const node = getNodeModules()
  if (!node) throw new Error("当前环境不支持文件系统操作")

  const pluginDataDir = `${workspaceRoot}/data/storage/petal/${plugin.name}`


  const buffer = Buffer.from(await file.arrayBuffer())
  const zip = await JSZip.loadAsync(buffer)

  let restored = 0

  for (const [relativePath, zipEntry] of Object.entries(zip.files) as [string, any][]) {
    if (zipEntry.dir) continue

    const targetPath = node.path.join(pluginDataDir, relativePath)
    const targetDir = node.path.dirname(targetPath)

    if (!node.fs.existsSync(targetDir)) {
      node.fs.mkdirSync(targetDir, { recursive: true })
    }

    const data = await zipEntry.async("nodebuffer")
    node.fs.writeFileSync(targetPath, data)
    restored++
  }

  return { restored }
}
