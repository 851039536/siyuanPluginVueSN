/**
 * API参考数据存储模块
 * 使用思源API进行数据持久化
 */
import { Plugin } from 'siyuan'
import type { ApiProvider } from './types'

const STORAGE_KEY = 'apiReference'

export interface ApiReferenceStorage {
  providers: ApiProvider[]
  markdownContent: Record<string, string> // providerId -> markdown content
  lastUpdated: number
}

/**
 * 默认存储数据
 */
const defaultStorage: ApiReferenceStorage = {
  providers: [],
  markdownContent: {},
  lastUpdated: Date.now()
}

/**
 * API参考存储管理器
 */
export class ApiReferenceStorageManager {
  private plugin: Plugin
  private cache: ApiReferenceStorage | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 加载存储数据
   */
  async loadData(): Promise<ApiReferenceStorage> {
    if (this.cache) {
      return this.cache
    }

    try {
      const data = await this.plugin.loadData(STORAGE_KEY)
      this.cache = data ? { ...defaultStorage, ...data } : defaultStorage
      return this.cache
    } catch (error) {
      console.error('[API Reference Storage] Failed to load data:', error)
      this.cache = defaultStorage
      return this.cache
    }
  }

  /**
   * 保存存储数据
   */
  async saveData(data: Partial<ApiReferenceStorage>): Promise<void> {
    try {
      const currentData = await this.loadData()
      const newData = {
        ...currentData,
        ...data,
        lastUpdated: Date.now()
      }

      await this.plugin.saveData(STORAGE_KEY, newData)
      this.cache = newData
    } catch (error) {
      console.error('[API Reference Storage] Failed to save data:', error)
      throw error
    }
  }

  /**
   * 获取所有API提供者
   */
  async getProviders(): Promise<ApiProvider[]> {
    const data = await this.loadData()
    return data.providers
  }

  /**
   * 保存API提供者列表
   */
  async saveProviders(providers: ApiProvider[]): Promise<void> {
    await this.saveData({ providers })
  }

  /**
   * 获取指定提供者的Markdown内容
   */
  async getMarkdownContent(providerId: string): Promise<string | null> {
    const data = await this.loadData()
    return data.markdownContent[providerId] || null
  }

  /**
   * 保存指定提供者的Markdown内容
   */
  async saveMarkdownContent(providerId: string, content: string): Promise<void> {
    const data = await this.loadData()
    const newMarkdownContent = {
      ...data.markdownContent,
      [providerId]: content
    }
    await this.saveData({ markdownContent: newMarkdownContent })
  }

  /**
   * 删除指定提供者的数据
   */
  async removeProvider(providerId: string): Promise<void> {
    const data = await this.loadData()
    const newProviders = data.providers.filter(p => p.id !== providerId)
    const newMarkdownContent = { ...data.markdownContent }
    delete newMarkdownContent[providerId]

    await this.saveData({
      providers: newProviders,
      markdownContent: newMarkdownContent
    })
  }

  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    await this.saveData(defaultStorage)
    this.cache = null
  }

  /**
   * 获取最后更新时间
   */
  async getLastUpdated(): Promise<number> {
    const data = await this.loadData()
    return data.lastUpdated
  }
}

/**
 * 创建存储管理器实例
 */
export function createApiReferenceStorage(plugin: Plugin): ApiReferenceStorageManager {
  return new ApiReferenceStorageManager(plugin)
}
