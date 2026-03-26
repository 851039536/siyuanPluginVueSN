/**
 * Everything本地搜索功能 - 数据存储管理
 */
import { Plugin } from 'siyuan'
import { PluginStorage } from '@/utils/pluginStorage'
import type { SearchOptions, EverythingConfig } from './index'

/** 存储的设置数据 */
export interface EverythingSearchSettings {
  config: EverythingConfig
  options: SearchOptions
}

/** 默认配置 */
export const DEFAULT_CONFIG: EverythingConfig = {
  host: 'localhost',
  port: 80
}

/** 默认搜索选项 */
export const DEFAULT_OPTIONS: SearchOptions = {
  matchCase: false,
  matchWholeWord: false,
  matchPath: false,
  regex: false,
  maxResults: 100,
  autoSearch: true,
  debounceDelay: 500,
  sort: 'date_modified',
  ascending: false,
  selectedDrive: ''
}

/**
 * Everything搜索存储管理类
 */
export class EverythingSearchStorage {
  private storage: PluginStorage
  private readonly CONFIG_KEY = 'everything-search-config'
  private readonly OPTIONS_KEY = 'everything-search-options'

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /**
   * 保存服务配置
   */
  async saveConfig(config: EverythingConfig): Promise<boolean> {
    return this.storage.save(this.CONFIG_KEY, {
      host: config.host || 'localhost',
      port: config.port || 80
    })
  }

  /**
   * 加载服务配置
   */
  async loadConfig(): Promise<EverythingConfig> {
    const data = await this.storage.load<EverythingConfig>(this.CONFIG_KEY)
    return data || { ...DEFAULT_CONFIG }
  }

  /**
   * 保存搜索选项
   */
  async saveOptions(options: SearchOptions): Promise<boolean> {
    return this.storage.save(this.OPTIONS_KEY, { ...options })
  }

  /**
   * 加载搜索选项
   */
  async loadOptions(): Promise<SearchOptions> {
    const data = await this.storage.load<SearchOptions>(this.OPTIONS_KEY)
    return data ? { ...DEFAULT_OPTIONS, ...data } : { ...DEFAULT_OPTIONS }
  }

  /**
   * 初始化存储（加载或使用默认值）
   */
  async init(): Promise<{ config: EverythingConfig; options: SearchOptions }> {
    const config = await this.loadConfig()
    const options = await this.loadOptions()
    return { config, options }
  }
}
