import {
  Plugin,
  getFrontend,
} from "siyuan";
import "@/index.scss";
import PluginInfoString from '@/../plugin.json'
import { destroy, init } from '@/main'
import { registerPageLock, registerTableOfContents, registerImageCompressor, registerDocNavigation, registerShortcut, registerWordQuery, registerGeneralSettings, registerQRCode, registerUnitConverter, registerSuperPanel, registerDiskBrowser } from '@/features'
import { loadSettings, saveSettings, type PluginSettings } from '@/config/settings'

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

    init(this)
  }

  onunload() {
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
    if (this.settings.enableQRCode) {
      console.log('注册二维码生成功能')
      registerQRCode(this)
    }
    if (this.settings.enableUnitConverter) {
      console.log('注册单位转换功能')
      registerUnitConverter(this)
    }
    if (this.settings.enableDiskBrowser) {
      console.log('注册本地磁盘浏览器功能')
      registerDiskBrowser(this)
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
