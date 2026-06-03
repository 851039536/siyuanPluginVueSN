/**
 * 统计模块存储管理
 * 使用 PluginStorage 统一存储模式
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"

/** 存储键常量 */
export const STATISTICS_STORAGE_KEYS = {
  HISTORY: "statistics-history",
} as const

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
}
