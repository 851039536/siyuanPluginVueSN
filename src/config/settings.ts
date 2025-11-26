/**
 * 插件配置管理模块
 */
import { Plugin } from 'siyuan'

/**
 * 插件配置接口
 */
export interface PluginSettings {
  enablePageLock: boolean       // 是否启用页面锁定功能
  enableTableOfContents: boolean // 是否启用目录插件功能
  enableImageCompressor: boolean // 是否启用图片压缩功能
}

/**
 * 默认配置
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  enablePageLock: true,
  enableTableOfContents: true,
  enableImageCompressor: true,
}

/**
 * 配置存储键
 */
const SETTINGS_KEY = 'plugin-settings'

/**
 * 加载插件配置
 */
export async function loadSettings(plugin: Plugin): Promise<PluginSettings> {
  try {
    const data = await plugin.loadData(SETTINGS_KEY)
    if (!data) {
      return { ...DEFAULT_SETTINGS }
    }
    // 合并默认配置和已保存的配置
    return { ...DEFAULT_SETTINGS, ...data }
  } catch (error) {
    console.error('加载配置失败:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * 保存插件配置
 */
export async function saveSettings(plugin: Plugin, settings: PluginSettings): Promise<boolean> {
  try {
    await plugin.saveData(SETTINGS_KEY, settings)
    console.log('配置已保存:', settings)
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
}
