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
  registerHtmlViewer,
  registerImageCompressor,
  registerPageLock,
  registerPasswordVault,
  registerResourceManager,
  registerRssReader,
  registerShortcut,
  registerStatistics,
  getStatisticsInstance,
  registerStatusBar,
  registerSuperPanel,
  registerTableOfContents,
  registerTextDiff,
  registerUnitConverter,
  registerVideo,
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

    // 清理HTML展示资源
    if ((this as any).__htmlViewer) {
      (this as any).__htmlViewer.destroy()
    }

    // 清理统计数据资源
    getStatisticsInstance()?.destroy()

    destroyCommands()
    destroy()
  }

  /**
   * 注册所有功能模块（必须同步调用，addDock 需在 onload 同步阶段完成）
   * 所有功能默认启用，不再通过配置开关控制
   */
  private registerFeatures() {
    registerSuperPanel(this)
    registerPageLock(this)
    registerTableOfContents(this)
    registerImageCompressor(this)
    registerDocNavigation(this)
    registerShortcut(this)
    registerWordQuery(this)
    registerGeneralSettings(this)
    registerUnitConverter(this)
    registerDiskBrowser(this)
    registerCodeImageGenerator(this)
    registerAIContentGenerator(this)
    registerStatistics(this)
    registerEncryption(this)
    registerVideo(this)
    registerEverythingSearch(this)
    registerStatusBar(this)
    registerFloatingToolbar(this)
    registerFloatingBox(this)
    registerTextDiff(this)
    registerBase64Image(this)
    registerFlashcardReading(this)
    registerPasswordVault(this)
    registerDocAnalysis(this)
    registerFormatAssistant(this)
    registerHtmlViewer(this)
    registerResourceManager(this)
    registerRssReader(this)
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
