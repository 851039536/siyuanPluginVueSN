// gitPush 本地提交索引 — 目录解析（定位 <workspace>/data/storage/petal/<plugin>/git-push-index）
import type { Plugin } from "siyuan"
import type { IndexFileIO } from "./indexIo"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { resolvePluginDataDir } from "@/utils/pluginDataDir"
import {
  FsIndexIO,
  INDEX_DIR_NAME,

} from "./indexIo"

/**
 * 解析索引目录绝对路径；无法确定时返回空串。
 *
 * 插件数据目录统一走 `resolvePluginDataDir()`：`plugin.dataDir` 在运行时通常是
 * undefined，且其语义是「插件数据目录」而非工作区根，不能在这里二次拼接
 * `storage/petal/<name>`（会得到 `<petal>/storage/petal/...`）。
 */
export async function resolveIndexDir(plugin: Plugin): Promise<string> {
  const node = getNodeFsPathOs()
  if (!node) return ""
  const dataDir = await resolvePluginDataDir(plugin)
  if (!dataDir) return ""
  return node.path.join(dataDir, INDEX_DIR_NAME)
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
