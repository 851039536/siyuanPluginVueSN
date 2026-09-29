// gitPush 本地提交索引 — 目录解析（定位 <workspace>/data/storage/petal/<plugin>/git-push-index）
import type { Plugin } from "siyuan"
import type { IndexFileIO } from "./indexIo"
import { getWorkspaceDir } from "@/api"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import {
  FsIndexIO,
  INDEX_DIR_NAME,

} from "./indexIo"

/** 思源 Plugin 上供本模块使用的字段（dataDir 未在类型声明中，故显式收窄） */
interface PluginWithDataDir extends Plugin {
  dataDir?: string
}

/**
 * 解析索引目录绝对路径；无法确定时返回空串。
 *
 * 优先用 plugin.dataDir（思源直接给出的工作空间根，最可靠且无 IO），
 * 为空时回退 getWorkspaceDir()（老版本思源可能不注入 dataDir）。
 */
export async function resolveIndexDir(plugin: Plugin): Promise<string> {
  const node = getNodeFsPathOs()
  if (!node) return ""
  const { path } = node
  const dataDir = (plugin as PluginWithDataDir).dataDir || (await getWorkspaceDir()) || ""
  if (!dataDir) return ""
  return path.join(dataDir, "storage", "petal", plugin.name, INDEX_DIR_NAME)
}

/**
 * 创建索引 IO。目录不可用（非 Electron / 无法确定工作空间）时返回 null，
 * 调用方据此把索引标记为不可用并降级到「直接跑 git」的旧路径。
 */
export async function createIndexIo(plugin: Plugin): Promise<IndexFileIO | null> {
  const dir = await resolveIndexDir(plugin)
  if (!dir) return null
  return new FsIndexIO(dir)
}
