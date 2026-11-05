/**
 * 插件数据目录解析（唯一入口）
 *
 * 位置：`<workspace>/data/storage/petal/<plugin.name>`，与思源 saveData 落盘位置一致。
 *
 * ⚠️ 绝不能用 `plugin.dataDir` 直接拼接：该字段在思源运行时通常为 undefined，
 * 拼出的相对路径会把文件写到渲染进程 CWD（实测落到 `E:\siyuan2\storage\...`）。
 * 所有需要插件数据目录的代码（SQLite、备份、索引、UI 路径展示）都必须走本模块。
 */
import type { Plugin } from "siyuan"
import { getNodeFsPathOs } from "./nodeModules"
import { readWorkspaceDir, readWorkspaceDirSync } from "./workspaceDir"

/** 思源 Plugin 上供本模块使用的字段（dataDir 未在公开类型声明中，显式收窄） */
interface PluginWithDataDir extends Plugin {
  dataDir?: string
}

/** 同步解析（仅用于 onload 同步阶段；拿不到工作区路径时返回空串） */
export function resolvePluginDataDirSync(plugin: Plugin): string {
  const node = getNodeFsPathOs()
  if (!node) return ""

  const injected = (plugin as PluginWithDataDir).dataDir
  if (injected && node.path.isAbsolute(injected)) {
    return injected
  }

  const workspaceDir = readWorkspaceDirSync()
  if (workspaceDir && node.path.isAbsolute(workspaceDir)) {
    return node.path.join(workspaceDir, "data", "storage", "petal", plugin.name)
  }
  return ""
}

/** 异步解析（内核未就绪时回退 `/api/system/getConf`） */
export async function resolvePluginDataDir(plugin: Plugin): Promise<string> {
  const node = getNodeFsPathOs()
  if (!node) return ""

  const injected = (plugin as PluginWithDataDir).dataDir
  if (injected && node.path.isAbsolute(injected)) {
    return injected
  }

  const workspaceDir = await readWorkspaceDir()
  if (workspaceDir && node.path.isAbsolute(workspaceDir)) {
    return node.path.join(workspaceDir, "data", "storage", "petal", plugin.name)
  }
  return ""
}

/** 拼接插件数据目录下的相对路径；目录不可解析时返回空串 */
export async function joinPluginDataPath(plugin: Plugin, relativePath: string): Promise<string> {
  const dir = await resolvePluginDataDir(plugin)
  if (!dir) return ""
  const node = getNodeFsPathOs()
  return node ? node.path.join(dir, relativePath) : ""
}
