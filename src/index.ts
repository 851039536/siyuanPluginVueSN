import {
  Plugin,
  getFrontend,
} from "siyuan";
import "@/index.scss";
import PluginInfoString from '@/../plugin.json'
import { destroy, init } from '@/main'
import { registerPageLock, registerTableOfContents, registerImageCompressor, registerDocNavigation, registerShortcut, registerWordQuery, registerGeneralSettings, registerUnitConverter, registerSuperPanel, registerDiskBrowser, registerCodeImageGenerator, registerAIContentGenerator, registerStatistics, registerEncryption, registerVideo, registerEverythingSearch, registerSystemMonitor, registerApiReference, registerHighlight, registerFloatingToolbar, registerFloatingBox, registerTextDiff, registerBase64Image, registerFlashcardReading } from '@/features'
import { loadSettings, saveSettings, loadHighlightSettings, type PluginSettings } from '@/config/settings'
import { initCommands, destroyCommands } from '@/commands'

let PluginInfo = {
  version: '',
}
try {
  PluginInfo = PluginInfoString
} catch (err) {
  console.log('Plugin info parse error: ', err)
}
const {
  version,
} = PluginInfo

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

  async onload() {
    const frontEnd = getFrontend();
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile"
    this.isBrowser = frontEnd.includes('browser')
    this.isLocal =
      location.href.includes('127.0.0.1')
      || location.href.includes('localhost')
    this.isInWindow = location.href.includes('window.html')

    try {
      require("@electron/remote")
        .require("@electron/remote/main")
      this.isElectron = true
    } catch (err) {
      this.isElectron = false
    }

    console.log('Plugin loaded, the plugin is ', this)

    // 加载配置
    this.settings = await loadSettings(this)
    console.log('插件配置已加载:', this.settings)

    // 注册功能模块
    await this.registerFeatures()

    // 初始化斜杠命令
    initCommands(this)

    init(this)
  }

  onunload() {
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

    destroyCommands()
    destroy()
  }

  /**
   * 注册所有功能模块
   */
  private async registerFeatures() {
    // 注册超级面板（统一入口，始终启用）
    console.log('注册超级面板')
    registerSuperPanel(this)

    // 根据配置注册功能模块
    if (this.settings.enablePageLock) {
      console.log('注册页面锁定功能')
      registerPageLock(this)
    }
    if (this.settings.enableTableOfContents) {
      console.log('注册目录插件功能')
      registerTableOfContents(this)
    }
    if (this.settings.enableImageCompressor) {
      console.log('注册图片压缩功能')
      registerImageCompressor(this)
    }
    if (this.settings.enableDocNavigation) {
      console.log('注册文档层级导航功能')
      registerDocNavigation(this)
    }
    if (this.settings.enableShortcuts) {
      console.log('注册快捷键模块')
      await registerShortcut(this)
    }
    if (this.settings.enableWordQuery) {
      console.log('注册单词查询功能')
      registerWordQuery(this)
    }
    if (this.settings.enableGeneralSettings) {
      console.log('注册通用设置功能')
      registerGeneralSettings(this)
    }
    if (this.settings.enableUnitConverter) {
      console.log('注册单位转换功能')
      registerUnitConverter(this)
    }
    if (this.settings.enableDiskBrowser) {
      console.log('注册本地磁盘浏览器功能')
      registerDiskBrowser(this)
    }
    if (this.settings.enableCodeImageGenerator) {
      console.log('注册代码图片生成器功能')
      registerCodeImageGenerator(this)
    }
    if (this.settings.enableAIContentGenerator) {
      console.log('注册AI信息生成功能')
      registerAIContentGenerator(this)
    }
    if (this.settings.enableStatistics) {
      console.log('注册数据统计功能')
      registerStatistics(this)
    }
    if (this.settings.enableEncryption) {
      console.log('注册内容加密功能')
      await registerEncryption(this)
    }
    if (this.settings.enableVideo) {
      registerVideo(this)
    }
    if (this.settings.enableEverythingSearch) {
      registerEverythingSearch(this)
    }
    if (this.settings.enableSystemMonitor) {
      console.log('注册系统监控功能')
      registerSystemMonitor(this)
    }
    if (this.settings.enableApiReference) {
      console.log('注册API参考功能')
      registerApiReference(this)
    }
    // 注册双击高亮功能（从数据库读取设置）
    console.log('注册双击高亮功能')
    const highlightSettings = await loadHighlightSettings(this)
    registerHighlight(this, highlightSettings.enableHighlight)

    // 注册浮动工具栏功能
    if (this.settings.enableFloatingToolbar) {
      console.log('注册浮动工具栏功能')
      registerFloatingToolbar(this)
    }

    // 注册悬浮框功能
    if (this.settings.enableFloatingBox) {
      console.log('注册悬浮框功能')
      registerFloatingBox(this)
    }

    // 注册文本对比功能
    if (this.settings.enableTextDiff) {
      console.log('注册文本对比功能')
      registerTextDiff(this)
    }

    // 注册 Base64 图片转换器功能
    if (this.settings.enableBase64Image) {
      console.log('注册 Base64 图片转换器功能')
      registerBase64Image(this)
    }

    // 注册单词阅读功能
    if (this.settings.enableFlashcardReading) {
      console.log('注册单词阅读功能')
      registerFlashcardReading(this)
    }
  }

  /**
   * 更新插件配置
   */
  async updateSettings(newSettings: PluginSettings) {
    this.settings = newSettings
    const success = await saveSettings(this, newSettings)
    if (success) {
      console.log('配置已更新:', this.settings)
    }
    return success
  }
}
