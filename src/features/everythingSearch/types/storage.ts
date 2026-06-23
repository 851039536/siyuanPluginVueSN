import type {
  EverythingConfig,
  SearchOptions,
} from "./index"
/**
 * Everything本地搜索功能 - 数据存储管理
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 存储的设置数据 */
export interface EverythingSearchSettings {
  config: EverythingConfig
  options: SearchOptions
}

/** 默认配置 */
export const DEFAULT_CONFIG: EverythingConfig = {
  host: "localhost",
  port: 80,
}

/** 默认搜索选项 */
export const DEFAULT_OPTIONS: SearchOptions = {
  matchCase: false,
  matchWholeWord: false,
  matchPath: false,
  regex: false,
  maxResults: 100,
  debounceDelay: 500,
  sort: "date_modified",
  ascending: false,
  advancedMode: false,
  minSize: 0,
  minSizeUnit: 'KB',
  maxSize: 0,
  maxSizeUnit: 'KB',
}

/**
 * Everything搜索存储管理类
 */
export class EverythingSearchStorage {
  readonly config: TypedStorage<EverythingConfig>
  readonly options: TypedStorage<SearchOptions>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.config = new TypedStorage(storage, "everything-search-config", DEFAULT_CONFIG)
    this.options = new TypedStorage(storage, "everything-search-options", DEFAULT_OPTIONS)
  }

  /**
   * 初始化存储（加载或使用默认值）
   */
  async init(): Promise<{ config: EverythingConfig, options: SearchOptions }> {
    const [config, options] = await Promise.all([
      this.config.loadOrDefault(),
      this.options.loadOrDefault(),
    ])
    return {
      config,
      options,
    }
  }
}
