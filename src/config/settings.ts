/**
 * 插件配置管理模块
 *
 * 注意：FontSettings、HeadingSettings、CodeBlockSettings、ListSettings、
 * HighlightSettings、TabPinSettings、TextDiffSettings 等类型及其默认值
 * 已统一迁移至各 feature 的 types/storage.ts，
 * 此处仅保留插件全局配置（PluginSettings）。
 */
import { Plugin } from "siyuan"
import {
  decryptSetting,
  encryptSetting,
} from "@/utils/settingsCrypto"

// 从规范位置 re-export，保持向后兼容
export type {
  CodeBlockSettings,
  FontSettings,
  HeadingSettings,
  HighlightSettings,
  ListSettings,
  TabPinSettings,
} from "@/features/generalSettings/types/storage"

export {
  DEFAULT_CODEBLOCK_SETTINGS,
  DEFAULT_FONT_SETTINGS,
  DEFAULT_HEADING_SETTINGS,
  DEFAULT_HIGHLIGHT_SETTINGS,
  DEFAULT_LIST_SETTINGS,
  DEFAULT_TABPIN_SETTINGS,
} from "@/features/generalSettings/types/storage"

// TextDiffSettings 也从 feature 规范位置 re-export
export type { TextDiffSettings } from "@/features/textDiff/types/storage"
export { DEFAULT_TEXTDIFF_SETTINGS } from "@/features/textDiff/types/storage"

/**
 * 插件配置接口
 */
export interface PluginSettings {
  enablePageLock: boolean // 是否启用页面锁定功能
  enableTableOfContents: boolean // 是否启用目录插件功能
  enableImageCompressor: boolean // 是否启用图片压缩功能
  enableDocNavigation: boolean // 是否启用文档层级导航功能
  enableShortcuts: boolean // 是否启用快捷键面板功能
  enableWordQuery: boolean // 是否启用单词查询功能
  enableGeneralSettings: boolean // 是否启用通用设置功能
  enableQRCode: boolean // 是否启用二维码生成功能
  enableUnitConverter: boolean // 是否启用单位转换功能
  enableDiskBrowser: boolean // 是否启用本地磁盘浏览器功能
  enableCodeImageGenerator: boolean // 是否启用代码图片生成器功能
  enableAIContentGenerator: boolean // 是否启用AI信息生成功能
  enableStatistics: boolean // 是否启用数据统计功能
  enablePronunciation: boolean // 是否启用谐音翻译功能
  enableEncryption: boolean // 是否启用内容加密功能
  enableVideo: boolean // 是否启用视频管理器功能
  enableEverythingSearch: boolean // 是否启用Everything本地搜索功能
  enableStatusBar: boolean // 是否启用状态栏功能
  enableFloatingToolbar: boolean // 是否启用浮动工具栏功能
  enableFloatingBox: boolean // 是否启用悬浮框功能
  enableSkills: boolean // 是否启用技能库功能
  enableTextDiff: boolean // 是否启用文本对比功能
  enableBase64Image: boolean // 是否启用 Base64 图片转换器功能
  enableFlashcardReading: boolean // 是否启用单词阅读功能
  enableHeatmapMarker: boolean // 是否启用热力图标记功能
  enableTranslate: boolean // 是否启用翻译替换功能
  enablePasswordVault: boolean // 是否启用密码箱功能
  enableDocAnalysis: boolean // 是否启用文档分析功能
  enableFormatAssistant: boolean // 是否启用排版助手功能
  enableHtmlViewer: boolean // 是否启用HTML展示功能
  enableRssReader: boolean // 是否启用RSS订阅功能
  videoCategories?: string[] // 视频分类列表
  compactMode: boolean // 是否启用全局紧洛模式
  statisticsTheme: "default" | "github" // 统计面板主题风格
  statisticsUpdateInterval: number // 统计自动更新时间间隔(毫秒),默认60000(1分钟)
  // 统一的大模型API配置
  aiApiProvider: string // AI API供应商: 'tongyi' | 'openai' | 'deepseek' | 'custom'
  aiModel: string // AI 模型名称
  aiCustomModel: string // 自定义模型名称
  aiApiKey: string // AI API密钥
  aiCustomEndpoint: string // 自定义API端点(仅在provider为custom时使用)
  aiEnableThinking: boolean // DeepSeek思考模式开关
  // 联网搜索配置（RAG 模式）
  searchProvider: string // 搜索引擎供应商: 'jina' | 'bocha' | 'searxng'
  searchBochaApiKey: string // 博查搜索 API Key
  searchSearxngUrl: string // SearXNG 实例地址
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
  enableAIContentGenerator: true,
  enableStatistics: true,
  enablePronunciation: true,
  enableEncryption: true,
  enableVideo: true,
  enableEverythingSearch: true,
  enableStatusBar: true,
  enableFloatingToolbar: true,
  enableFloatingBox: true,
  enableSkills: true,
  enableTextDiff: true,
  enableBase64Image: true,
  enableFlashcardReading: true,
  enableHeatmapMarker: true,
  enableTranslate: true,
  enablePasswordVault: true,
  enableDocAnalysis: true,
  enableFormatAssistant: true,
  enableHtmlViewer: true,
  enableRssReader: true,
  videoCategories: ["默认分类", "教程", "演示", "其他"],
  compactMode: true,
  statisticsTheme: "default",
  statisticsUpdateInterval: 60000,
  // 统一的大模型API配置默认值
  aiApiProvider: "tongyi",
  aiModel: "qwen-plus",
  aiCustomModel: "",
  aiApiKey: "",
  aiCustomEndpoint: "",
  aiEnableThinking: false,
  // 联网搜索默认值
  searchProvider: "jina",
  searchBochaApiKey: "",
  searchSearxngUrl: "",
}

/**
 * 配置存储键
 */
const SETTINGS_KEY = "plugin-settings"

/**
 * 对 settings 中的敏感字段执行加密（保存前调用）
 */
async function encryptSensitiveFields(
  settings: PluginSettings,
): Promise<PluginSettings> {
  const encrypted = { ...settings }
  encrypted.aiApiKey = await encryptSetting(settings.aiApiKey)
  encrypted.searchBochaApiKey = await encryptSetting(settings.searchBochaApiKey)
  return encrypted
}

/**
 * 对 settings 中的敏感字段执行解密（加载后调用）
 */
async function decryptSensitiveFields(
  settings: PluginSettings,
): Promise<PluginSettings> {
  const decrypted = { ...settings }
  decrypted.aiApiKey = await decryptSetting(settings.aiApiKey)
  decrypted.searchBochaApiKey = await decryptSetting(settings.searchBochaApiKey)
  return decrypted
}

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
    const merged = {
      ...DEFAULT_SETTINGS,
      ...data,
    }
    // 解密敏感字段
    return await decryptSensitiveFields(merged)
  } catch (error) {
    console.error("加载配置失败:", error)
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * 保存插件配置
 *
 * 敏感字段 (aiApiKey) 在保存前
 * 会使用 AES-GCM 加密，防止明文泄漏。
 */
export async function saveSettings(
  plugin: Plugin,
  settings: PluginSettings,
): Promise<boolean> {
  try {
    const encrypted = await encryptSensitiveFields(settings)
    await plugin.saveData(SETTINGS_KEY, encrypted)
    return true
  } catch (error) {
    console.error("保存配置失败:", error)
    return false
  }
}

/**
 * 清除加密密钥缓存（在插件卸载时调用，内存安全）
 */
export { clearCachedKey } from "@/utils/settingsCrypto"


