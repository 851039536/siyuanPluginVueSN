import type {
  EverythingConfig,
  SearchOptions,
} from "./index"
/**
 * Everything本地搜索功能 - 数据存储管理
 */
import type { Plugin } from "siyuan"
import type { CacheCleanMode, CacheRootId } from "./cacheScan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

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
  minSizeUnit: "KB",
  maxSize: 0,
  maxSizeUnit: "KB",
  frequentKeywords: [],
  includePathsEnabled: false,
  includePaths: [],
  excludePathsEnabled: false,
  excludePaths: [],
}

/** 缓存清理面板的持久化偏好 */
export interface CacheCleanSettings {
  /**
   * 各缓存分类的启用偏好。
   * ⚠️ 只记录用户**显式改过**的项；缺省 key 由 `CACHE_ROOTS` 的 `defaultEnabled` 决定，
   * 这样以后新增分类、或调整某类的默认勾选状态时，老用户无需迁移（也避免默认值双份定义）。
   */
  enabledRoots: Partial<Record<CacheRootId, boolean>>
  /** 清理方式 */
  mode: CacheCleanMode
  /** 单次扫描最多收集的条目数（防止临时目录海量小文件拖垮面板） */
  maxEntries: number
  /** 只清理「最近修改时间早于 N 分钟」的条目，避免误删正在使用的临时文件 */
  minAgeMinutes: number
}

/** 默认清理偏好：回收站 + 5 分钟年龄门槛 + 3000 条上限 */
export const DEFAULT_CACHE_CLEAN_SETTINGS: CacheCleanSettings = {
  enabledRoots: {},
  mode: "recycle",
  maxEntries: 3000,
  minAgeMinutes: 5,
}

/**
 * 构造一份独立的默认搜索选项。
 *
 * 数组字段必须逐次新建：直接展开 `DEFAULT_OPTIONS` 会让多个面板实例
 * （overlay 弹窗 + 浮动窗口）共享同一数组引用，`addKeyword` 等原地修改会互相污染。
 */
export function createDefaultOptions(): SearchOptions {
  return {
    ...DEFAULT_OPTIONS,
    frequentKeywords: [],
    includePaths: [],
    excludePaths: [],
  }
}

/** 构造一份独立的默认清理偏好（`enabledRoots` 同理，不能共用默认对象） */
export function createDefaultCacheCleanSettings(): CacheCleanSettings {
  return {
    ...DEFAULT_CACHE_CLEAN_SETTINGS,
    enabledRoots: {},
  }
}

/**
 * Everything搜索存储管理类
 */
export class EverythingSearchStorage {
  readonly config: TypedStorage<EverythingConfig>
  readonly options: TypedStorage<SearchOptions>
  readonly cacheClean: TypedStorage<CacheCleanSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.config = new TypedStorage(storage, "everything-search-config", DEFAULT_CONFIG)
    this.options = new TypedStorage(storage, "everything-search-options", DEFAULT_OPTIONS)
    this.cacheClean = new TypedStorage(
      storage,
      "everything-search-cache-clean",
      DEFAULT_CACHE_CLEAN_SETTINGS,
    )
  }

  /**
   * 初始化存储（加载或使用默认值）。
   *
   * 返回的 `options` / `cacheClean` 均为独立副本：`TypedStorage` 的默认值只做浅拷贝，
   * 若不在此处复制嵌套数组/对象，多个面板实例会共享同一份默认引用。
   */
  async init(): Promise<{
    config: EverythingConfig,
    options: SearchOptions,
    cacheClean: CacheCleanSettings,
  }> {
    const [config, options, cacheClean] = await Promise.all([
      this.config.loadOrDefault(),
      this.options.loadOrDefault(),
      this.cacheClean.loadOrDefault(),
    ])
    return {
      config,
      options: {
        ...options,
        frequentKeywords: [...(options.frequentKeywords ?? [])],
        includePaths: [...(options.includePaths ?? [])],
        excludePaths: [...(options.excludePaths ?? [])],
      },
      cacheClean: {
        ...cacheClean,
        enabledRoots: { ...(cacheClean.enabledRoots ?? {}) },
      },
    }
  }
}
