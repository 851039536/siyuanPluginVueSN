/**
 * 插件入口：主类 PluginSample
 * onload 同步读取功能开关并条件注册各功能模块；onunload 统一销毁持有持久资源的实例
 */
import type { PluginSettings } from "@/config/settings"
import { Plugin } from "siyuan"

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
import { emitCustomEvent } from "@/utils/eventBus"
import { clearRendererCache } from "@/utils/mdRenderer"

import {
  getStatisticsInstance,
  registerAIContentGenerator,
  scanSkills as scanSkillsFromViewer,
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
  registerGlobalRelations,
  registerHtmlViewer,
  registerImageCompressor,
  registerImageCreation,
  registerMinimalBrowser,
  registerPageLock,
  registerPasswordVault,
  registerPrompts,
  registerQuickNote,
  registerResourceManager,
  registerRssReader,
  registerS3Backup,
  registerS3FileManager,
  registerScriptLauncher,
  registerShortcut,
  registerSkillLearning,
  registerSkillsViewer,
  registerStatistics,
  registerStatusBar,
  unregisterStatusBar,
  registerSuperPanel,
  registerTableOfContents,
  registerTextDiff,
  registerThemeColor,
  registerToolCollection,
  // unitConverter 已迁移至 toolCollection/tools/unitConverter/
  // wordQuery 已迁移至 toolCollection/tools/wordQuery/
  registerVideo,
  registerWebsiteNavigation,
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

export default class PluginSample extends Plugin {
  // 插件配置（onload 同步阶段赋值，非空断言）
  public settings!: PluginSettings
  /** 浮动工具栏实例（由 floatingToolbar 功能模块注入） */
  public __floatingToolbar?: import("@/features/floatingToolbar/core/FloatingToolbar").FloatingToolbar
  /** 全局关系列表实例（由 globalRelations 功能模块注入，onunload 经 DESTROYABLE_KEYS 销毁） */
  private __globalRelations?: { destroy: () => void }
  /** Git 推送实例（由 gitPush 功能模块注入，onunload 经 DESTROYABLE_KEYS 销毁） */
  private __gitPush?: { destroy: () => void }
  /** 主题色实例（rebuildThemeColor 维护，onunload 经 DESTROYABLE_KEYS 销毁） */
  private __themeColor?: { destroy: () => void }

  /** 持有持久资源（定时器/监听器/Modal）、需在 onunload 统一 destroy 的实例字段清单 */
  private static readonly DESTROYABLE_KEYS = [
    "__pageLock", // 页面锁定（interval + 事件监听器）
    "__flashcardReading", // 单词阅读
    "__floatingBox", // 悬浮框
    "__floatingToolbar", // 浮动工具栏
    "__generalSettings", // 通用设置
    "__formatAssistant", // 排版助手
    "__htmlViewer", // HTML 展示
    "__themeColor", // 主题色
    "__bookmarkMarker", // 书签标记
    "__scriptLauncher", // 脚本启动器
    "__s3Backup", // S3 备份
    "__s3FileManager", // S3 文件管理
    "__textDiff", // 文本对比
    "__quickNote", // 速记（persistent Modal）
    "__toolCollection", // 工具合集（Vue app + 容器 DOM）
    "__docNavigation", // 文档层级导航（IntersectionObserver + 事件监听 + Vue app）
    "__superPanel", // 超级面板（持久 Modal + 事件监听器）
    "__websiteNavigation", // 网站导航（非持久 Modal，卸载时清理打开的 DOM）
    "__minimalBrowser", // 极简浏览器（addTab 模型 + 独立窗口 + 全局事件监听）
  ] as const

  onload() {
    setupIconifyOffline() // 预加载 mdi + ph 图标数据，确保断网可用

    // 关键：初始化功能开关文件持久化目录（必须在 loadFeatureFlagsSync 之前）
    setFeatureFlagsDir((this as any).dataDir)

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

    // 异步加载真实配置并更新（失败时保持默认配置运行，仅记录日志）
    this.loadAndApplySettings().catch((err) => {
      console.error("[PluginSample] 异步加载配置失败，继续使用默认配置:", err)
    })
  }

  /**
   * 异步加载真实配置，覆盖默认值
   */
  private async loadAndApplySettings() {
    this.settings = await loadSettings(this)
    // 同步回文件缓存，确保下次 onload 同步阶段能读到最新开关
    saveFeatureFlagsSync(this.settings)
    // 根据真实配置同步紧凑模式 CSS 类（settings 已合并 DEFAULT_SETTINGS，无需兜底默认值）
    applyCompactMode(this.settings)
    // 主题色可能在异步加载后需要重新应用（scheme 已变）
    this.rebuildThemeColor()
  }

  /** 重建主题色实例：先销毁旧实例，再按 enableThemeColor 开关决定是否注册 */
  private rebuildThemeColor() {
    this.__themeColor?.destroy()
    this.__themeColor = this.settings.enableThemeColor
      ? registerThemeColor(this, this.settings.themeColorScheme)
      : undefined
  }

  onunload() {
    // 清除缓存的加密密钥（内存安全）
    clearCachedKey()
    // 清除 Markdown 渲染器缓存
    clearRendererCache()

    // 全局关系列表 Modal 显式销毁（保持类型可见性）
    this.__globalRelations?.destroy()

    // Git 推送显式销毁（kill 子进程 / 清空等待队列与 AbortController）
    this.__gitPush?.destroy()

    // 统一销毁各功能实例（新增功能只需将实例字段名加入 DESTROYABLE_KEYS）
    for (const key of PluginSample.DESTROYABLE_KEYS) {
      const instance = (this as any)[key] as { destroy?: () => void } | undefined
      instance?.destroy?.()
    }

    // 清理统计数据资源（模块级单例，不挂在 plugin 实例上）
    getStatisticsInstance()?.destroy()

    // 清理状态栏资源
    unregisterStatusBar()

    destroyCommands()
    destroy()
  }

  /**
   * 注册所有功能模块（必须同步调用，addDock 需在 onload 同步阶段完成）
   * 根据 this.settings 中的 enable* 开关决定是否注册各功能
   */
  private registerFeatures() {
    const s = this.settings

    // superPanel 是设置中枢（功能开关的管理入口），不受开关控制，始终注册
    registerSuperPanel(this)

    if (s.enablePageLock) registerPageLock(this)
    if (s.enableTableOfContents) registerTableOfContents(this)
    if (s.enableImageCompressor) registerImageCompressor(this)
    if (s.enableDocNavigation) registerDocNavigation(this)
    if (s.enableShortcuts) registerShortcut(this)
    // wordQuery 已迁移至 toolCollection/tools/wordQuery/
    if (s.enableGeneralSettings) registerGeneralSettings(this)
    // unitConverter 已迁移至 toolCollection/tools/unitConverter/
    if (s.enableDiskBrowser) registerDiskBrowser(this)
    if (s.enableAIContentGenerator) registerAIContentGenerator(this, { scanSkills: scanSkillsFromViewer })
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
    this.rebuildThemeColor() // 主题色（方法内部检查 enableThemeColor 开关）
    if (s.enableBookmarkMarker) registerBookmarkMarker(this)
    if (s.enableApiDebugger) registerApiDebugger(this)
    if (s.enableWebsiteNavigation) registerWebsiteNavigation(this)
    if (s.enableMinimalBrowser) registerMinimalBrowser(this)
    if (s.enableScriptLauncher) registerScriptLauncher(this)
    if (s.enableDataSnapshot) registerDataSnapshot(this)
    if (s.enableGitPush) this.__gitPush = registerGitPush(this)
    if (s.enableSkillLearning) registerSkillLearning(this)
    if (s.enableToolCollection) registerToolCollection(this)
    if (s.enableS3Backup) registerS3Backup(this)
    if (s.enableS3FileManager) registerS3FileManager(this)
    if (s.enableGlobalRelations) this.__globalRelations = registerGlobalRelations(this)
    if (s.enableQuickNote) registerQuickNote(this)
  }

  /**
   * 更新插件配置
   */
  async updateSettings(newSettings: PluginSettings) {
    this.settings = newSettings
    const success = await saveSettings(this, newSettings)
    if (success) {
      // 广播设置变更，供 statusBar 等独立挂载模块同步功能开关状态
      emitCustomEvent("settingsUpdated")
    }
    return success
  }
}
