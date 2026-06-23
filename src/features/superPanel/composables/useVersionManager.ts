/**
 * 超级面板 - 版本管理逻辑
 *
 * 从 SuperPanelManager 提取，职责单一：CRUD 版本记录
 */
import type { FeatureVersionEntry } from "../types"
import type { PluginStorage } from "@/utils/pluginStorage"

export const VERSIONS_STORAGE_KEY = "superPanel-feature-versions"

export interface VersionManager {
  /** 当前内存中的版本数据 */
  featureVersions: Record<string, FeatureVersionEntry[]>
  /** 从存储加载版本数据 */
  loadVersions: () => Promise<void>
  /** 将版本数据持久化到存储 */
  save: () => Promise<void>
  /** 获取存储文件路径（展示用） */
  getStoragePath: () => string
  /** 新增版本记录 */
  addVersion: (featureId: string, entry: FeatureVersionEntry) => Promise<void>
  /** 更新指定索引的版本记录 */
  updateVersion: (featureId: string, index: number, entry: FeatureVersionEntry) => Promise<void>
  /** 删除指定索引的版本记录 */
  deleteVersion: (featureId: string, index: number) => Promise<void>
}

/**
 * 创建版本管理器实例
 *
 * @param storage   PluginStorage 实例（由 SuperPanelManager 提供）
 * @param dataDir   插件数据目录路径（如 data/storage/petal/xxx）
 */
export function createVersionManager(
  storage: PluginStorage,
  dataDir: string,
): VersionManager {
  const featureVersions: Record<string, FeatureVersionEntry[]> = {}
  const storagePath = `${dataDir}/${VERSIONS_STORAGE_KEY}.json`

  async function loadVersions(): Promise<void> {
    const loaded = await storage.load<Record<string, FeatureVersionEntry[]>>(VERSIONS_STORAGE_KEY)
    const data = loaded ?? {}
    Object.keys(featureVersions).forEach((k) => delete featureVersions[k])
    Object.assign(featureVersions, data)
  }

  async function save(): Promise<void> {
    await storage.save(VERSIONS_STORAGE_KEY, featureVersions)
  }

  function getStoragePath(): string {
    return storagePath
  }

  async function addVersion(featureId: string, entry: FeatureVersionEntry): Promise<void> {
    if (!featureVersions[featureId]) {
      featureVersions[featureId] = []
    }
    featureVersions[featureId].unshift(entry)
    await save()
  }

  async function updateVersion(
    featureId: string,
    index: number,
    entry: FeatureVersionEntry,
  ): Promise<void> {
    const versions = featureVersions[featureId]
    if (!versions || !versions[index]) return
    versions[index] = entry
    await save()
  }

  async function deleteVersion(featureId: string, index: number): Promise<void> {
    const versions = featureVersions[featureId]
    if (!versions) return
    versions.splice(index, 1)
    await save()
  }

  return {
    featureVersions,
    loadVersions,
    save,
    getStoragePath,
    addVersion,
    updateVersion,
    deleteVersion,
  }
}
