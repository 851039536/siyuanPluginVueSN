/**
 * 统计模块存储管理
 * 使用 PluginStorage 统一存储模式
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"

/** 存储键常量 */
export const STATISTICS_STORAGE_KEYS = {
  HISTORY: "statistics-history",
  SETTINGS: "statistics-settings",
} as const

/** 统计面板设置 */
export interface StatisticsSettings {
  /** 是否开启定时自动刷新 */
  autoRefreshEnabled: boolean
  /** 自动刷新间隔（分钟） */
  refreshInterval: number
}

/** 统计设置默认值：默认关闭自动刷新，间隔 30 分钟 */
export const DEFAULT_STATISTICS_SETTINGS: StatisticsSettings = {
  autoRefreshEnabled: false,
  refreshInterval: 30,
}

/**
 * 统计存储管理类
 */
export class StatisticsStorage {
  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /**
   * 加载历史统计数据
   */
  async loadHistory(): Promise<Record<string, any>> {
    const data = await this.storage.load<Record<string, any>>(
      STATISTICS_STORAGE_KEYS.HISTORY,
    )
    return data || {}
  }

  /**
   * 保存历史统计数据
   */
  async saveHistory(data: Record<string, any>): Promise<boolean> {
    return this.storage.save(STATISTICS_STORAGE_KEYS.HISTORY, data)
  }

  /**
   * 加载统计面板设置（未保存过时按默认值返回）
   */
  async loadSettings(): Promise<StatisticsSettings> {
    const data = await this.storage.load<Partial<StatisticsSettings>>(
      STATISTICS_STORAGE_KEYS.SETTINGS,
    )
    return { ...DEFAULT_STATISTICS_SETTINGS, ...(data || {}) }
  }

  /**
   * 保存统计面板设置
   */
  async saveSettings(settings: StatisticsSettings): Promise<boolean> {
    return this.storage.save(STATISTICS_STORAGE_KEYS.SETTINGS, settings)
  }
}
