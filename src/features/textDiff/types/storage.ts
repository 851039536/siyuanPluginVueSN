import { Plugin } from 'siyuan'
import { PluginStorage } from '@/utils/pluginStorage'

/**
 * 文本对比设置接口
 */
export interface TextDiffSettings {
  fontSize: number           // 字体大小
  diffMode: 'split' | 'unified'  // 显示模式：分栏或统一
  theme: 'light' | 'dark'    // 主题：浅色或深色
}

/**
 * 默认文本对比设置
 */
export const DEFAULT_TEXTDIFF_SETTINGS: TextDiffSettings = {
  fontSize: 14,
  diffMode: 'split',
  theme: 'light'
}

/**
 * 文本对比存储管理类
 */
export class TextDiffStorage {
  private storage: PluginStorage
  private readonly SETTINGS_KEY = 'textdiff-settings'

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /**
   * 保存设置
   */
  async saveSettings(settings: TextDiffSettings): Promise<boolean> {
    return this.storage.save(this.SETTINGS_KEY, settings)
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<TextDiffSettings> {
    const settings = await this.storage.load<TextDiffSettings>(this.SETTINGS_KEY)
    if (!settings) {
      return { ...DEFAULT_TEXTDIFF_SETTINGS }
    }
    return { ...DEFAULT_TEXTDIFF_SETTINGS, ...settings }
  }

  /**
   * 初始化存储
   */
  async init(): Promise<void> {
    const settings = await this.loadSettings()
    if (!settings) {
      await this.saveSettings(DEFAULT_TEXTDIFF_SETTINGS)
    }
  }
}
