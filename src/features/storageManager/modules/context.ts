/**
 * 数据管理 - 运行上下文
 *
 * 统一封装插件实例、数据目录与 Node 模块；不可用时返回 null，
 * 由调用方转成可展示的失败原因。
 */
import type { Plugin } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { resolvePluginDataDir } from "@/utils/pluginDataDir"

type NodeFS = typeof import("node:fs")
type NodePath = typeof import("node:path")

export interface StorageContext {
  plugin: Plugin
  dataDir: string
  fs: NodeFS
  path: NodePath
}

export async function createStorageContext(plugin: Plugin): Promise<StorageContext | null> {
  const node = getNodeModules()
  if (!node) return null
  const dataDir = await resolvePluginDataDir(plugin)
  if (!dataDir) return null
  return {
    plugin,
    dataDir,
    fs: node.fs,
    path: node.path,
  }
}

/** 表名安全校验：来自注册表的受信值，仍拒绝非标识符字符以防拼接 */
export function isSafeTableName(table: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(table)
}
