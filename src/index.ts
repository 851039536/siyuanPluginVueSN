import type { PluginSettings } from "@/config/settings"
import { DEFAULT_SETTINGS } from "@/config/settings"

import {
  getFrontend,
  Plugin,
} from "siyuan"

import PluginInfoString from "@/../plugin.json"
import {
  destroyCommands,
  initCommands,
} from "@/commands"
import {
  clearCachedKey,
  loadSettings,

  saveSettings,
} from "@/config/settings"
import {
  registerAIContentGenerator,
  registerBase64Image,
  registerCodeImageGenerator,
  registerDiskBrowser,
  registerDocAnalysis,
  registerDocNavigation,
  registerEncryption,
  registerEverythingSearch,
  registerFlashcardReading,
  registerFloatingBox,
  registerFloatingToolbar,
  registerFormatAssistant,
  registerGeneralSettings,
  registerImageCompressor,
  registerPageLock,
  registerPasswordVault,
  registerShortcut,
  registerStatistics,
  registerStatusBar,
  registerSuperPanel,
  registerTableOfContents,
  registerTextDiff,
  registerUnitConverter,
  registerVideo,
  registerWebDAV,
  registerWordQuery,
} from "@/features"
import {
  destroy,
  init,
} from "@/main"
// ========== 全局样式导入 ==========
// 使用普通 import 而非 @use，确保 CSS 在插件加载时就注入
// Vite 会将此 CSS 编译到 index.css 并在入口点立即注入
import "@/index.scss"

let PluginInfo = {
  version: "",
}
try {
  PluginInfo = PluginInfoString
} catch (err) {}
const { version } = PluginInfo

export default class PluginSample extends Plugin {
  // Run as mobile
  public isMobile: boolean
  // Run in browser
  public isBrowser: boolean
  // Run as local
  public isLocal: boolean
  // Run in Electron
  public isElectron: boolean
  // Run in window
  public isInWindow: boolean
  public platform: SyFrontendTypes
  public readonly version = version
  // 插件配置
  public settings: PluginSettings

  onload() {
    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.isBrowser = frontEnd.includes("browser")
    this.isLocal =
      location.href.includes("127.0.0.1")
      || location.href.includes("localhost")
    this.isInWindow = location.href.includes("window.html")

    try {
      require("@electron/remote").require("@electron/remote/main")
      this.isElectron = true
    } catch (err) {
      this.isElectron = false
    }

    // 关键：先用默认配置同步注册所有 Dock，
    // 确保 addDock() 在 onload 同步阶段完成（思源框架不等待异步 onload）
    this.settings = { ...DEFAULT_SETTINGS }
    this.registerFeatures()

    // 初始化斜杠命令
    initCommands(this)

    init(this)

    // 异步加载真实配置并更新
    this.loadAndApplySettings()
  }

  /**
   * 异步加载真实配置，覆盖默认值
   */
  private async loadAndApplySettings() {
    this.settings = await loadSettings(this)
    // 根据真实配置同步紧凑模式 CSS 类
    // （init() 时基于 DEFAULT_SETTINGS.compactMode=true 已添加，
    //   这里需要按真实配置修正）
    if (this.settings.compactMode) {
      document.documentElement.classList.add("siyuan-compact-mode")
    } else {
      document.documentElement.classList.remove("siyuan-compact-mode")
    }
  }

  onunload() {
    // 清除缓存的加密密钥（内存安全）
    clearCachedKey()

    // 清理单词阅读资源
    if ((this as any).__flashcardReading) {
      (this as any).__flashcardReading.destroy()
    }

    // 清理悬浮框资源
    if ((this as any).__floatingBox) {
      (this as any).__floatingBox.destroy()
    }

    // 清理浮动工具栏资源
    if ((this as any).__floatingToolbar) {
      (this as any).__floatingToolbar.destroy()
    }

    // 清理通用设置资源
    if ((this as any).__generalSettings) {
      (this as any).__generalSettings.destroy()
    }

    // 清理排版助手资源
    if ((this as any).__formatAssistant) {
      (this as any).__formatAssistant.destroy()
    }

    destroyCommands()
    destroy()
  }

  /**
   * 注册所有功能模块（必须同步调用，addDock 需在 onload 同步阶段完成）
   */
  private registerFeatures() {
    // 注册超级面板（统一入口，始终启用）
    registerSuperPanel(this)

    // 根据配置注册功能模块
    if (this.settings.enablePageLock) {
      registerPageLock(this)
    }

    // 注册目录插件功能
    if (this.settings.enableTableOfContents) {
      registerTableOfContents(this)
    }

    // 注册图片压缩功能
    if (this.settings.enableImageCompressor) {
      registerImageCompressor(this)
    }

    // 注册文档层级导航功能
    if (this.settings.enableDocNavigation) {
      registerDocNavigation(this)
    }

    // 注册快捷键模块（addDock 已调整为同步优先，异步部分在后台完成）
    if (this.settings.enableShortcuts) {
      registerShortcut(this)
    }

    // 注册单词查询功能
    if (this.settings.enableWordQuery) {
      registerWordQuery(this)
    }
    // 注册通用设置功能
    if (this.settings.enableGeneralSettings) {
      registerGeneralSettings(this)
    }

    // 注册单位转换功能
    if (this.settings.enableUnitConverter) {
      registerUnitConverter(this)
    }

    // 注册本地磁盘浏览器功能
    if (this.settings.enableDiskBrowser) {
      registerDiskBrowser(this)
    }

    // 注册代码图片生成器功能
    if (this.settings.enableCodeImageGenerator) {
      registerCodeImageGenerator(this)
    }

    // 注册AI信息生成功能
    if (this.settings.enableAIContentGenerator) {
      registerAIContentGenerator(this)
    }

    // 注册数据统计功能
    if (this.settings.enableStatistics) {
      registerStatistics(this)
    }

    // 注册内容加密功能（addDock 不受异步影响，后台初始化即可）
    if (this.settings.enableEncryption) {
      registerEncryption(this)
    }
    // 注册视频播放功能
    if (this.settings.enableVideo) {
      registerVideo(this)
    }
    // 注册全局搜索功能
    if (this.settings.enableEverythingSearch) {
      registerEverythingSearch(this)
    }

    // 注册状态栏功能
    if (this.settings.enableStatusBar) {
      registerStatusBar(this)
    }

    // 注册浮动工具栏功能
    if (this.settings.enableFloatingToolbar) {
      registerFloatingToolbar(this)
    }

    // 注册悬浮框功能
    if (this.settings.enableFloatingBox) {
      registerFloatingBox(this)
    }

    // 注册文本对比功能
    if (this.settings.enableTextDiff) {
      registerTextDiff(this)
    }

    // 注册 Base64 图片转换器功能
    if (this.settings.enableBase64Image) {
      registerBase64Image(this)
    }

    // 注册单词阅读功能
    if (this.settings.enableFlashcardReading) {
      registerFlashcardReading(this)
    }

    // 注册密码箱功能
    if (this.settings.enablePasswordVault) {
      registerPasswordVault(this)
    }

    // 注册文档分析功能
    if (this.settings.enableDocAnalysis) {
      registerDocAnalysis(this)
    }

    // 注册 WebDAV 功能
    if (this.settings.enableWebDAV) {
      registerWebDAV(this)
    }

    // 注册排版助手功能
    if (this.settings.enableFormatAssistant) {
      registerFormatAssistant(this)
    }
  }

  /**
   * 更新插件配置
   */
  async updateSettings(newSettings: PluginSettings) {
    this.settings = newSettings
    const success = await saveSettings(this, newSettings)
    if (success) {
    }
    return success
  }
}
