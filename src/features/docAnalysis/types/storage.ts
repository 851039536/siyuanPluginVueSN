/**
 * 文档分析功能 - 数据存储管理
 */
import type { Plugin } from "siyuan"
import type { FilterOptions, HealthSettings, PlatformMeta, PublishPromoteConfig } from "./index"
import { DEFAULT_FILTER_OPTIONS, DEFAULT_HEALTH_SETTINGS, DEFAULT_PLATFORM_META, DEFAULT_PUBLISH_PROMOTE } from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/**
 * 文档分析存储管理类
 */
export class DocAnalysisStorage {
  readonly options: TypedStorage<FilterOptions>
  readonly platformMeta: TypedStorage<PlatformMeta[]>
  readonly duplicateNameFilter: TypedStorage<string[]>
  readonly publishPromote: TypedStorage<PublishPromoteConfig>
  readonly healthSettings: TypedStorage<HealthSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.options = new TypedStorage(storage, "doc-analysis-options", DEFAULT_FILTER_OPTIONS)
    this.platformMeta = new TypedStorage(storage, "doc-analysis-platforms", DEFAULT_PLATFORM_META)
    this.duplicateNameFilter = new TypedStorage(storage, "doc-analysis-dup-filter", [])
    this.publishPromote = new TypedStorage(storage, "doc-analysis-publish-promote", DEFAULT_PUBLISH_PROMOTE)
    this.healthSettings = new TypedStorage(storage, "doc-analysis-health-settings", DEFAULT_HEALTH_SETTINGS)
  }
}
