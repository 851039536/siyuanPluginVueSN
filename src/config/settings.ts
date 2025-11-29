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
  enableDocNavigation: boolean   // 是否启用文档层级导航功能
  enableShortcuts: boolean       // 是否启用快捷键面板功能
  enableWordQuery: boolean       // 是否启用单词查询功能
  enableGeneralSettings: boolean // 是否启用通用设置功能
  enableQRCode: boolean          // 是否启用二维码生成功能
  enableUnitConverter: boolean   // 是否启用单位转换功能
  enableDiskBrowser: boolean     // 是否启用本地磁盘浏览器功能
  enableCodeImageGenerator: boolean // 是否启用代码图片生成器功能
  wordQueryApiKey: string        // 单词查询API密钥（已废弃，使用aiApiProvider和aiApiKey）
  compactMode: boolean           // 是否启用全局紧洛模式
  // 统一的大模型API配置
  aiApiProvider: string          // AI API供应商: 'tongyi' | 'openai' | 'deepseek' | 'custom'
  aiApiKey: string               // AI API密钥
  aiCustomEndpoint: string       // 自定义API端点（仅在provider为custom时使用）
}

/**
 * 字体设置接口
 */
export interface FontSettings {
  fontFamily: string    // 字体族
  fontSize: number      // 字体大小
  fontWeight: string    // 字体粗细
  lineHeight: number    // 行高
}

/**
 * 默认配置
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  enablePageLock: true,
  enableTableOfContents: true,
  enableImageCompressor: true,
  enableDocNavigation: true,
  enableShortcuts: true,
  enableWordQuery: true,
  enableGeneralSettings: true,
  enableQRCode: true,
  enableUnitConverter: true,
  enableDiskBrowser: true,
  enableCodeImageGenerator: true,
  wordQueryApiKey: 'sk-fae27cc50015409fb2524b0970d3f0b0',
  compactMode: true,
  // 统一的大模型API配置默认值
  aiApiProvider: 'tongyi',
  aiApiKey: 'sk-fae27cc50015409fb2524b0970d3f0b0',
  aiCustomEndpoint: '',
}

/**
 * 默认字体设置
 */
export const DEFAULT_FONT_SETTINGS: FontSettings = {
  fontFamily: '',
  fontSize: 14,
  fontWeight: 'normal',
  lineHeight: 1.6
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

/**
 * 加载字体设置
 */
export function loadFontSettings(): FontSettings {
  try {
    const saved = localStorage.getItem('general-font-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...DEFAULT_FONT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error('加载字体设置失败:', error)
  }
  return { ...DEFAULT_FONT_SETTINGS }
}

/**
 * 保存字体设置
 */
export function saveFontSettings(settings: FontSettings): boolean {
  try {
    localStorage.setItem('general-font-settings', JSON.stringify(settings))
    console.log('字体设置已保存:', settings)
    return true
  } catch (error) {
    console.error('保存字体设置失败:', error)
    return false
  }
}

/**
 * 重置字体设置
 */
export function resetFontSettings(): boolean {
  try {
    localStorage.removeItem('general-font-settings')
    console.log('字体设置已重置')
    return true
  } catch (error) {
    console.error('重置字体设置失败:', error)
    return false
  }
}
