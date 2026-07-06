import type { PluginSettings } from "@/config/settings"
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
  DEFAULT_SETTINGS,
  loadFeatureFlagsSync,
  loadSettings,
  saveFeatureFlagsSync,
  saveSettings,
  setFeatureFlagsDir,
} from "@/config/settings"

import {
  getStatisticsInstance,
  registerAIContentGenerator,
  registerApiDebugger,
  registerBookmarkMarker,
  registerDataSnapshot,
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
  registerGitPush,
  registerHtmlViewer,
  registerImageCompressor,
  registerImageCreation,
  registerPageLock,
  registerPasswordVault,
  registerResourceManager,
  registerRssReader,
  registerS3Backup,
  registerScriptLauncher,
  registerShortcut,
  registerSkillLearning,
  registerPrompts,
  registerSkillsViewer,
  registerStatistics,
  registerStatusBar,
  registerSuperPanel,
  registerTableOfContents,
  registerTextDiff,
  registerThemeColor,
  registerToolCollection,
  // unitConverter 已迁移至 toolCollection/tools/unitConverter/
  registerVideo,
  registerWebsiteNavigation,
  registerWordQuery,
} from "@/features"
import { applyCompactMode } from "@/features/compactMode"

import {
  destroy,
  init,
} from "@/main"
import { setupIconifyOffline } from "@/utils/iconifySetup"
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
    setupIconifyOffline() // 预加载 mdi + ph 图标数据，确保断网可用

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

    // 关键：初始化功能开关文件持久化目录（必须在 loadFeatureFlagsSync 之前）
    setFeatureFlagsDir((this as any).dataDir)

    // 存储 dataDir 到实例上，供子模块通过 plugin 引用获取
    ;(this as any).__pluginDataDir = (this as any).dataDir

    // 同步读取功能开关（优先从文件，跨重启可靠）
    // 因为 addDock() 必须在 onload 同步阶段完成，不能等异步 loadData
    const savedFlags = loadFeatureFlagsSync()
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedFlags,
    }
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
    // 同步回文件缓存，确保下次 onload 同步阶段能读到最新开关
    saveFeatureFlagsSync(this.settings)
    // 根据真实配置同步紧凑模式 CSS 类
    applyCompactMode({
      compactMode: this.settings.compactMode,
      compactModeDensity: this.settings.compactModeDensity ?? 'compact',
      compactModeFontScale: this.settings.compactModeFontScale ?? 94,
      compactModeAreas: this.settings.compactModeAreas ?? {
        sidebar: true,
        editor: true,
        tabs: true,
        dialogs: true,
        controls: true,
      },
    })
    // 主题色可能在异步加载后需要重新应用（scheme 已变）
    if ((this as any).__themeColor) {
      (this as any).__themeColor.destroy()
    }
    if (this.settings.enableThemeColor) {
      (this as any).__themeColor = registerThemeColor(this, this.settings.themeColorScheme)
    }
  }

  onunload() {
    // 清除缓存的加密密钥（内存安全）
    clearCachedKey()

    // 清理页面锁定资源（interval + 事件监听器）
    if ((this as any).__pageLock) {
      (this as any).__pageLock.destroy()
    }

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

    // 清理主题色
    if ((this as any).__themeColor) {
      (this as any).__themeColor.destroy()
    }

    // 清理书签标记
    if ((this as any).__bookmarkMarker) {
      (this as any).__bookmarkMarker.destroy()
    }

    // 清理单词查询资源
    if ((this as any).__wordQuery) {
      (this as any).__wordQuery.destroy()
    }

    // 清理脚本启动器资源
    if ((this as any).__scriptLauncher) {
      (this as any).__scriptLauncher.destroy()
    }

    // 清理 Git 推送资源
    if ((this as any).__gitPush) {
      (this as any).__gitPush.destroy()
    }

    // 清理统计数据资源
    getStatisticsInstance()?.destroy()

    // 清理工具合集资源
    if ((this as any).__toolCollection) {
      ;(this as any).__toolCollection.app.unmount()
      ;(this as any).__toolCollection.container.remove()
    }

    // 清理 S3 备份资源
    if ((this as any).__s3Backup) {
      ;(this as any).__s3Backup.destroy()
    }

    destroyCommands()
    destroy()
  }

  /**
   * 注册所有功能模块（必须同步调用，addDock 需在 onload 同步阶段完成）
   * 根据 this.settings 中的 enable* 开关决定是否注册各功能
   */
  private registerFeatures() {
    const s = this.settings

    registerSuperPanel(this)

    if (s.enablePageLock) (this as any).__pageLock = registerPageLock(this)
    if (s.enableTableOfContents) registerTableOfContents(this)
    if (s.enableImageCompressor) registerImageCompressor(this)
    if (s.enableDocNavigation) registerDocNavigation(this)
    if (s.enableShortcuts) registerShortcut(this)
    if (s.enableWordQuery) registerWordQuery(this)
    if (s.enableGeneralSettings) registerGeneralSettings(this)
    // unitConverter 已迁移至 toolCollection/tools/unitConverter/
    if (s.enableDiskBrowser) registerDiskBrowser(this)
    if (s.enableAIContentGenerator) registerAIContentGenerator(this)
    if (s.enableImageCreation) registerImageCreation(this)
    if (s.enableStatistics) registerStatistics(this)
    if (s.enableEncryption) registerEncryption(this)
    if (s.enableVideo) registerVideo(this)
    if (s.enableEverythingSearch) registerEverythingSearch(this)
    if (s.enableStatusBar) registerStatusBar(this)
    if (s.enableFloatingToolbar) registerFloatingToolbar(this)
    if (s.enableFloatingBox) registerFloatingBox(this)
    if (s.enableTextDiff) registerTextDiff(this)
    if (s.enableFlashcardReading) registerFlashcardReading(this)
    if (s.enablePasswordVault) registerPasswordVault(this)
    if (s.enablePrompts) registerPrompts(this)
    if (s.enableSkillsViewer) registerSkillsViewer(this)
    if (s.enableDocAnalysis) registerDocAnalysis(this)
    if (s.enableFormatAssistant) registerFormatAssistant(this)
    if (s.enableHtmlViewer) registerHtmlViewer(this)
    if (s.enableResourceManager) registerResourceManager(this)
    if (s.enableRssReader) registerRssReader(this)
    if (s.enableThemeColor) {
      (this as any).__themeColor = registerThemeColor(this, s.themeColorScheme)
    }
    if (s.enableBookmarkMarker) registerBookmarkMarker(this)
    if (s.enableApiDebugger) registerApiDebugger(this)
    if (s.enableWebsiteNavigation) registerWebsiteNavigation(this)
    if (s.enableScriptLauncher) registerScriptLauncher(this)
    if (s.enableDataSnapshot) registerDataSnapshot(this)
    if (s.enableGitPush) registerGitPush(this)
    if (s.enableSkillLearning) registerSkillLearning(this)
    if (s.enableToolCollection) registerToolCollection(this)
    if (s.enableS3Backup) registerS3Backup(this)
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
