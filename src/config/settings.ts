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
  enableAIContentGenerator: boolean // 是否启用AI信息生成功能
  enableStatistics: boolean      // 是否启用数据统计功能
  enablePronunciation: boolean   // 是否启用谐音翻译功能
  enableEncryption: boolean      // 是否启用内容加密功能
  enableVideo: boolean           // 是否启用视频管理器功能
  enableEverythingSearch: boolean // 是否启用Everything本地搜索功能
  enableSystemMonitor: boolean   // 是否启用系统监控功能
  enableApiReference: boolean    // 是否启用API参考功能
  enableFloatingToolbar: boolean // 是否启用浮动工具栏功能
  enableFloatingBox: boolean     // 是否启用悬浮框功能
  enableSkills: boolean          // 是否启用技能库功能
  enableTextDiff: boolean        // 是否启用文本对比功能
  enableBase64Image: boolean     // 是否启用 Base64 图片转换器功能
  enableFlashcardReading: boolean // 是否启用单词阅读功能
  enableFlashcardQuery: boolean  // 是否启用查询单词功能
  enableTranslate: boolean       // 是否启用翻译替换功能
  enablePasswordVault: boolean   // 是否启用密码箱功能
  enableWebDAV: boolean          // 是否启用WebDAV功能
  webdavConfig: WebDAVConfig     // WebDAV服务器配置
  videoCategories?: string[]     // 视频分类列表
  wordQueryApiKey: string        // 单词查询API密钥(已废弃,使用aiApiProvider和aiApiKey)
  compactMode: boolean           // 是否启用全局紧洛模式
  statisticsTheme: 'default' | 'github'  // 统计面板主题风格
  statisticsUpdateInterval: number  // 统计自动更新时间间隔(毫秒),默认60000(1分钟)
  // 统一的大模型API配置
  aiApiProvider: string          // AI API供应商: 'tongyi' | 'openai' | 'deepseek' | 'custom'
  aiModel: string                // AI 模型名称
  aiCustomModel: string          // 自定义模型名称
  aiApiKey: string               // AI API密钥
  aiCustomEndpoint: string       // 自定义API端点(仅在provider为custom时使用)
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
 * 列表设置接口
 */
export interface ListSettings {
  enableCustomUnorderedList: boolean  // 是否启用自定义无序列表样式
  enableCustomOrderedList: boolean     // 是否启用自定义有序列表样式
  firstLevelSymbol: string             // 一级列表符号
  secondLevelSymbol: string            // 二级列表符号
  thirdLevelSymbol: string             // 三级列表符号
  customFirstLevelSymbol: string       // 自定义一级符号
  customSecondLevelSymbol: string      // 自定义二级符号
  customThirdLevelSymbol: string       // 自定义三级符号
  symbolSize: number                   // 符号大小(em)
  symbolMarginLeft: number             // 符号左边距(px)
  numberFormat: string                 // 有序列表编号格式
  applyToListBlocks: boolean           // 应用于列表块
  applyToEmbedBlocks: boolean          // 应用于嵌入块
  applyToFloatWindows: boolean         // 应用于浮窗
  css?: string                         // 生成的CSS样式
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
  enableSystemMonitor: true,
  enableApiReference: true,
  enableFloatingToolbar: true,
  enableFloatingBox: true,
  enableSkills: true,
  enableTextDiff: true,
  enableBase64Image: true,
  enableFlashcardReading: true,
  enableFlashcardQuery: true,
  enableTranslate: true,
  enablePasswordVault: true,
  enableWebDAV: true,
  webdavConfig: {
    serverUrl: '',
    username: '',
    password: '',
    basePath: '/',
    autoSync: false,
    syncInterval: 30,
    lastSyncTime: ''
  },
  videoCategories: ['默认分类', '教程', '演示', '其他'],
  wordQueryApiKey: 'sk-fae27cc50015409fb2524b0970d3f0b0',
  compactMode: true,
  statisticsTheme: 'default',
  statisticsUpdateInterval: 60000,
  // 统一的大模型API配置默认值
  aiApiProvider: 'tongyi',
  aiModel: 'qwen-plus',
  aiCustomModel: '',
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
 * 默认列表设置
 */
export const DEFAULT_LIST_SETTINGS: ListSettings = {
  enableCustomUnorderedList: false,
  enableCustomOrderedList: false,
  firstLevelSymbol: '▪',
  secondLevelSymbol: '•',
  thirdLevelSymbol: '◦',
  customFirstLevelSymbol: '',
  customSecondLevelSymbol: '',
  customThirdLevelSymbol: '',
  symbolSize: 1.5,
  symbolMarginLeft: 13,
  numberFormat: 'decimal',
  applyToListBlocks: true,
  applyToEmbedBlocks: true,
  applyToFloatWindows: true
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
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
}






/**
 * 重置列表设置
 */
export function resetListSettings(): boolean {
  try {
    localStorage.removeItem('general-list-settings')
    return true
  } catch (error) {
    console.error('重置列表设置失败:', error)
    return false
  }
}

/**
 * 应用列表样式CSS到页面
 */
export function applyListStyles(css: string): void {
  if (!css) {
    // 移除现有的列表样式
    removeExistingListStyles()
    return
  }

  // 移除现有的样式
  removeExistingListStyles()

  // 创建新的样式元素
  const styleElement = document.createElement('style')
  styleElement.id = 'custom-list-styles'
  styleElement.textContent = css
  document.head.appendChild(styleElement)
}

/**
 * 移除现有的列表样式
 */
function removeExistingListStyles(): void {
  const existingStyle = document.getElementById('custom-list-styles')
  if (existingStyle) {
    existingStyle.remove()
  }
}

/**
 * 标题设置接口
 */
export interface HeadingSettings {
  style: string
  colors: {
    h1: string
    h2: string
    h3: string
    h4: string
    h5: string
    h6: string
  }
  fontSizes: {
    h1: number
    h2: number
    h3: number
    h4: number
    h5: number
    h6: number
  }
  levelDisplay: string
  customMarkers: string[]
  titleCenterAlign: boolean
  titleColor: string
  titleFontSize: number
}

/**
 * 默认标题设置
 */
export const DEFAULT_HEADING_SETTINGS: HeadingSettings = {
  style: 'default',
  colors: {
    h1: '#F39A94',
    h2: '#F8D694',
    h3: '#B1DCB9',
    h4: '#AAD2FC',
    h5: '#AC9DC0',
    h6: '#D7D7D7'
  },
  fontSizes: {
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 18,
    h5: 16,
    h6: 14
  },
  levelDisplay: 'none',
  customMarkers: ['1', '2', '3', '4', '5', '6'],
  titleCenterAlign: false,
  titleColor: '#2C3E50',
  titleFontSize: 24
}

/**
 * 配置存储键
 */
const HEADING_SETTINGS_KEY = 'heading-settings'

/**
 * 加载标题设置
 */
export async function loadHeadingSettings(plugin: Plugin): Promise<HeadingSettings> {
  try {
    const data = await plugin.loadData(HEADING_SETTINGS_KEY)
    if (!data) {
      return { ...DEFAULT_HEADING_SETTINGS }
    }
    // 合并默认配置和已保存的配置，确保 colors 和 fontSizes 都正确合并
    return {
      ...DEFAULT_HEADING_SETTINGS,
      ...data,
      colors: { ...DEFAULT_HEADING_SETTINGS.colors, ...data.colors },
      fontSizes: { ...DEFAULT_HEADING_SETTINGS.fontSizes, ...data.fontSizes }
    }
  } catch (error) {
    console.error('加载标题设置失败:', error)
    return { ...DEFAULT_HEADING_SETTINGS }
  }
}

/**
 * 保存标题设置
 */
export async function saveHeadingSettings(plugin: Plugin, settings: HeadingSettings): Promise<boolean> {
  try {
    await plugin.saveData(HEADING_SETTINGS_KEY, settings)
    return true
  } catch (error) {
    console.error('保存标题设置失败:', error)
    return false
  }
}

/**
 * 重置标题设置
 */
export async function resetHeadingSettings(plugin: Plugin): Promise<boolean> {
  try {
    await plugin.saveData(HEADING_SETTINGS_KEY, DEFAULT_HEADING_SETTINGS)
    return true
  } catch (error) {
    console.error('重置标题设置失败:', error)
    return false
  }
}

/**
 * 代码块设置接口
 */
export interface CodeBlockSettings {
  style: 'default' | 'github' | 'mac' | 'cartoon'
  enableCollapse: boolean
  collapseHeight: number
}

/**
 * 默认代码块设置
 */
export const DEFAULT_CODEBLOCK_SETTINGS: CodeBlockSettings = {
  style: 'default',
  enableCollapse: true,
  collapseHeight: 400
}

/**
 * 配置存储键
 */
const CODEBLOCK_SETTINGS_KEY = 'codeblock-settings'

/**
 * 加载代码块设置
 */
export async function loadCodeBlockSettings(plugin: Plugin): Promise<CodeBlockSettings> {
  try {
    const data = await plugin.loadData(CODEBLOCK_SETTINGS_KEY)
    if (!data) {
      return { ...DEFAULT_CODEBLOCK_SETTINGS }
    }
    return { ...DEFAULT_CODEBLOCK_SETTINGS, ...data }
  } catch (error) {
    console.error('加载代码块设置失败:', error)
    return { ...DEFAULT_CODEBLOCK_SETTINGS }
  }
}

/**
 * 保存代码块设置
 */
export async function saveCodeBlockSettings(plugin: Plugin, settings: CodeBlockSettings): Promise<boolean> {
  try {
    await plugin.saveData(CODEBLOCK_SETTINGS_KEY, settings)
    return true
  } catch (error) {
    console.error('保存代码块设置失败:', error)
    return false
  }
}

/**
 * 配置存储键
 */
const LIST_SETTINGS_KEY = 'list-settings'

/**
 * 加载列表设置
 */
export async function loadListSettingsFromDB(plugin: Plugin): Promise<ListSettings> {
  try {
    const data = await plugin.loadData(LIST_SETTINGS_KEY)
    if (!data) {
      return { ...DEFAULT_LIST_SETTINGS }
    }
    return { ...DEFAULT_LIST_SETTINGS, ...data }
  } catch (error) {
    console.error('加载列表设置失败:', error)
    return { ...DEFAULT_LIST_SETTINGS }
  }
}

/**
 * 保存列表设置
 */
export async function saveListSettingsToDB(plugin: Plugin, settings: ListSettings): Promise<boolean> {
  try {
    await plugin.saveData(LIST_SETTINGS_KEY, settings)
    return true
  } catch (error) {
    console.error('保存列表设置失败:', error)
    return false
  }
}

/**
 * 高亮设置存储键
 */
const HIGHLIGHT_SETTINGS_KEY = 'highlight-settings'

/**
 * 加载高亮设置
 */
export async function loadHighlightSettings(plugin: Plugin): Promise<{ enableHighlight: boolean }> {
  try {
    const data = await plugin.loadData(HIGHLIGHT_SETTINGS_KEY)
    if (!data) {
      return { enableHighlight: true }
    }
    return { enableHighlight: data.enableHighlight ?? true }
  } catch (error) {
    console.error('加载高亮设置失败:', error)
    return { enableHighlight: true }
  }
}

/**
 * 保存高亮设置
 */
export async function saveHighlightSettings(plugin: Plugin, settings: { enableHighlight: boolean }): Promise<boolean> {
  try {
    await plugin.saveData(HIGHLIGHT_SETTINGS_KEY, settings)
    return true
  } catch (error) {
    console.error('保存高亮设置失败:', error)
    return false
  }
}

/**
 * 字体设置存储键
 */
const FONT_SETTINGS_KEY = 'font-settings'

/**
 * 从数据库加载字体设置
 */
export async function loadFontSettingsFromDB(plugin: Plugin): Promise<FontSettings> {
  try {
    const data = await plugin.loadData(FONT_SETTINGS_KEY)
    if (!data) {
      return { ...DEFAULT_FONT_SETTINGS }
    }
    return { ...DEFAULT_FONT_SETTINGS, ...data }
  } catch (error) {
    console.error('加载字体设置失败:', error)
    return { ...DEFAULT_FONT_SETTINGS }
  }
}

/**
 * 保存字体设置到数据库
 */
export async function saveFontSettingsToDB(plugin: Plugin, settings: FontSettings): Promise<boolean> {
  try {
    await plugin.saveData(FONT_SETTINGS_KEY, settings)
    return true
  } catch (error) {
    console.error('保存字体设置失败:', error)
    return false
  }
}

/**
 * 文本对比设置接口
 */
export interface TextDiffSettings {
  fontSize: number           // 字体大小
  diffMode: 'split' | 'unified'  // 显示模式：分栏或统一
  theme: 'light' | 'dark'    // 主题：浅色或深色
}

/**
 * WebDAV配置接口
 */
export interface WebDAVConfig {
  serverUrl: string          // WebDAV服务器地址
  username: string           // 用户名
  password: string           // 密码
  basePath: string           // 基础路径
  autoSync: boolean          // 是否自动同步
  syncInterval: number       // 同步间隔(分钟)
  lastSyncTime: string       // 最后同步时间
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
 * 文本对比设置存储键
 */
const TEXTDIFF_SETTINGS_KEY = 'textdiff-settings'

/**
 * 从数据库加载文本对比设置
 */
export async function loadTextDiffSettings(plugin: Plugin): Promise<TextDiffSettings> {
  try {
    const data = await plugin.loadData(TEXTDIFF_SETTINGS_KEY)
    if (!data) {
      return { ...DEFAULT_TEXTDIFF_SETTINGS }
    }
    return { ...DEFAULT_TEXTDIFF_SETTINGS, ...data }
  } catch (error) {
    console.error('加载文本对比设置失败:', error)
    return { ...DEFAULT_TEXTDIFF_SETTINGS }
  }
}

/**
 * 保存文本对比设置到数据库
 */
export async function saveTextDiffSettings(plugin: Plugin, settings: TextDiffSettings): Promise<boolean> {
  try {
    await plugin.saveData(TEXTDIFF_SETTINGS_KEY, settings)
    return true
  } catch (error) {
    console.error('保存文本对比设置失败:', error)
    return false
  }
}
