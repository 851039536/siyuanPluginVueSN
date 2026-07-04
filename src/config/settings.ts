/**
 * 插件配置管理模块
 *
 * 注意：FontSettings、HeadingSettings、CodeBlockSettings、ListSettings、
 * HighlightSettings、TabPinSettings、TextDiffSettings 等类型及其默认值
 * 已统一迁移至各 feature 的 types/storage.ts，
 * 此处仅保留插件全局配置（PluginSettings）。
 */
import { Plugin } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import {
  decryptSetting,
  encryptSetting,
} from "@/utils/settingsCrypto"

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
  enableDiskBrowser: boolean // 是否启用本地磁盘浏览器功能
  enableAIContentGenerator: boolean // 是否启用AI信息生成功能
  enableStatistics: boolean // 是否启用数据统计功能
  enablePronunciation: boolean // 是否启用谐音翻译功能
  enableEncryption: boolean // 是否启用内容加密功能
  enableVideo: boolean // 是否启用视频管理器功能
  enableEverythingSearch: boolean // 是否启用Everything本地搜索功能
  enableStatusBar: boolean // 是否启用状态栏功能
  enableFloatingToolbar: boolean // 是否启用浮动工具栏功能
  enableFloatingBox: boolean // 是否启用悬浮框功能
  enablePrompts: boolean // 是否启用提示词库功能
  enableSkillsViewer: boolean // 是否启用 Skills 查看器功能
  enableTextDiff: boolean // 是否启用文本对比功能
  enableFlashcardReading: boolean // 是否启用单词阅读功能
  enableHeatmapMarker: boolean // 是否启用热力图标记功能
  enableTranslate: boolean // 是否启用翻译替换功能
  enablePasswordVault: boolean // 是否启用密码箱功能
  enableDocAnalysis: boolean // 是否启用文档分析功能
  enableFormatAssistant: boolean // 是否启用排版助手功能
  enableHtmlViewer: boolean // 是否启用HTML展示功能
  enableRssReader: boolean // 是否启用RSS订阅功能
  enableResourceManager: boolean // 是否启用资源管理功能
  enableThemeColor: boolean // 是否启用全局主题色功能
  enableBookmarkMarker: boolean // 是否启用手动书签标记功能
  enableApiDebugger: boolean // 是否启用API调试器功能
  enableImageCreation: boolean // 是否启用图片生成功能
  enableWebsiteNavigation: boolean // 是否启用网站导航功能
  enableScriptLauncher: boolean // 是否启用脚本启动器功能
  enableDataSnapshot: boolean // 是否启用数据快照功能
  enableGitPush: boolean // 是否启用Git推送功能
  enableSkillLearning: boolean // 是否启用技能学习功能
  enableToolCollection: boolean // 是否启用工具合集功能
  enableS3Backup: boolean // 是否启用 S3 备份功能
  featureStatus: Record<string, string> // 功能状态标识: featureId -> 'stable' | 'needsFix' | 'critical' | 'minor'
  themeColorScheme: string // 主题色方案: 'orange' | 'github'
  videoCategories?: string[] // 视频分类列表
  compactMode: boolean // 是否启用全局紧凑模式
  compactModeDensity: 'moderate' | 'compact' | 'extreme' // 密度级别
  compactModeFontScale: number // 字号缩放 100|98|96|94|92|90
  compactModeAreas: Record<string, boolean> // 区域开关: sidebar/editor/tabs/dialogs/controls
  statisticsTheme: "default" | "github" // 统计面板主题风格
  statisticsUpdateInterval: number // 统计自动更新时间间隔(毫秒),默认60000(1分钟)
  // 统一的大模型API配置
  aiApiProvider: string // AI API供应商: 'tongyi' | 'openai' | 'deepseek' | 'custom'
  aiModel: string // AI 模型名称
  aiCustomModel: string // 自定义模型名称
  aiApiKeys: Record<string, string> // AI API密钥（按供应商存储）
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
  enableDiskBrowser: true,
  enableAIContentGenerator: true,
  enableStatistics: true,
  enablePronunciation: true,
  enableEncryption: true,
  enableVideo: true,
  enableEverythingSearch: true,
  enableStatusBar: true,
  enableFloatingToolbar: true,
  enableFloatingBox: true,
  enablePrompts: true,
  enableSkillsViewer: true,
  enableTextDiff: true,
  enableFlashcardReading: true,
  enableHeatmapMarker: true,
  enableTranslate: true,
  enablePasswordVault: true,
  enableDocAnalysis: true,
  enableFormatAssistant: true,
  enableHtmlViewer: true,
  enableRssReader: true,
  enableResourceManager: true,
  enableThemeColor: false,
  enableBookmarkMarker: true,
  enableImageCreation: true,
  enableApiDebugger: true,
  enableWebsiteNavigation: true,
  enableScriptLauncher: true,
  enableDataSnapshot: true,
  enableGitPush: true,
  enableSkillLearning: true,
  enableToolCollection: true,
  enableS3Backup: true,
  featureStatus: {},
  themeColorScheme: "orange",
  videoCategories: ["默认分类", "教程", "演示", "其他"],
  compactMode: true,
  compactModeDensity: 'compact',
  compactModeFontScale: 94,
  compactModeAreas: {
    sidebar: true,
    editor: true,
    tabs: true,
    dialogs: true,
    controls: true,
  },
  statisticsTheme: "default",
  statisticsUpdateInterval: 60000,
  // 统一的大模型API配置默认值
  aiApiProvider: "tongyi",
  aiModel: "qwen-plus",
  aiCustomModel: "",
  aiApiKeys: {},
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
const FEATURE_FLAGS_FILE = "feature-flags.json"

/**
 * 获取插件数据目录路径（功能开关持久化时已验证可用）
 */
export function getPluginDataDir(): string | null {
  return _flagsDir
}

let _flagsDir: string | null = null

/**
 * 设置功能开关持久化目录
 * 必须在 onload 中同步调用一次，后续 save/load 默认写入此目录
 */
export function setFeatureFlagsDir(dir: string): void {
  _flagsDir = dir
}

/**
 * 功能 ID → PluginSettings 键名映射
 * 处理缩写词（如 QR、AI）的特殊大小写
 */
const FEATURE_ID_TO_KEY_MAP: Record<string, string> = {
  qrCode: "enableQRCode",
  aiContentGenerator: "enableAIContentGenerator",
}

export function featureIdToSettingKey(featureId: string): string {
  if (FEATURE_ID_TO_KEY_MAP[featureId]) {
    return FEATURE_ID_TO_KEY_MAP[featureId]
  }
  return `enable${featureId.charAt(0).toUpperCase() + featureId.slice(1)}`
}

/**
 * 检查一个 key 是否是 enable* 开关字段
 */
function isEnableKey(key: string): boolean {
  return key.startsWith("enable")
}

/**
 * 获取 fs 和 path 模块（Electron 环境可用）
 */
/**
 * 从完整 settings 中提取 enable* 开关并同步持久化
 * 优先使用 fs.writeFileSync 写入文件，不支持时降级到 localStorage
 */
export function saveFeatureFlagsSync(settings: PluginSettings): void {
  const flags: Record<string, boolean> = {}
  for (const key of Object.keys(settings) as (keyof PluginSettings)[]) {
    if (isEnableKey(key)) {
      flags[key] = settings[key] as boolean
    }
  }
  const json = JSON.stringify(flags)

  // 优先使用文件持久化（跨重启可靠）
  if (_flagsDir) {
    const node = getNodeModules()
    if (node) {
      try {
        node.fs.writeFileSync(node.path.join(_flagsDir, FEATURE_FLAGS_FILE), json, "utf-8")
        return
      } catch {
        // 文件写入失败，降级到 localStorage
      }
    }
  }

  // 降级：localStorage
  try {
    localStorage.setItem("sn-plugin-feature-flags", json)
  } catch {
    // 静默失败
  }
}

/**
 * 同步加载 enable* 开关
 * 优先从文件读取（跨重启可靠），不支持时降级到 localStorage
 */
export function loadFeatureFlagsSync(): Partial<PluginSettings> {
  // 优先从文件读取
  if (_flagsDir) {
    const node = getNodeModules()
    if (node) {
      try {
        const raw = node.fs.readFileSync(node.path.join(_flagsDir, FEATURE_FLAGS_FILE), "utf-8")
        const flags = JSON.parse(raw)
        if (flags && typeof flags === "object") {
          return flags
        }
      } catch {
        // 文件不存在或读取失败，降级到 localStorage
      }
    }
  }

  // 降级：localStorage
  try {
    const raw = localStorage.getItem("sn-plugin-feature-flags")
    if (raw) {
      const flags = JSON.parse(raw)
      if (flags && typeof flags === "object") {
        return flags
      }
    }
  } catch {
    // 静默失败
  }
  return {}
}

/**
 * 对 settings 中的敏感字段执行加密（保存前调用）
 */
async function encryptSensitiveFields(
  settings: PluginSettings,
): Promise<PluginSettings> {
  const encrypted = { ...settings }
  // 按供应商加密 API 密钥
  encrypted.aiApiKeys = {}
  for (const [provider, key] of Object.entries(settings.aiApiKeys || {})) {
    if (key) {
      encrypted.aiApiKeys[provider] = await encryptSetting(key)
    }
  }
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
  // 按供应商解密 API 密钥
  decrypted.aiApiKeys = {}
  for (const [provider, key] of Object.entries(settings.aiApiKeys || {})) {
    if (key) {
      decrypted.aiApiKeys[provider] = await decryptSetting(key)
    }
  }
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
    } as PluginSettings
    // 兼容旧版 enableSkills → enablePrompts 迁移
    if ((data as any).enableSkills !== undefined && (data as any).enablePrompts === undefined) {
      merged.enablePrompts = (data as any).enableSkills
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
 * 敏感字段 (aiApiKeys, searchBochaApiKey) 在保存前
 * 会使用 AES-GCM 加密，防止明文泄漏。
 */
export async function saveSettings(
  plugin: Plugin,
  settings: PluginSettings,
): Promise<boolean> {
  try {
    const encrypted = await encryptSensitiveFields(settings)
    await plugin.saveData(SETTINGS_KEY, encrypted)
    saveFeatureFlagsSync(settings)
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


