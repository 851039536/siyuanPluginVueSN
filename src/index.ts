import {
  Plugin,
  getFrontend,
} from "siyuan";
import "@/index.scss";
import PluginInfoString from '@/../plugin.json'
import { destroy, init } from '@/main'
import { registerPageLock, registerTableOfContents } from '@/features'
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
    this.registerFeatures()

    init(this)
  }

  onunload() {
    destroy()
  }

  openSetting() {
    window._sy_plugin_sample.openSetting()
  }

  /**
   * 注册所有功能模块
   */
  private registerFeatures() {
    // 根据配置注册功能模块
    if (this.settings.enablePageLock) {
      console.log('注册页面锁定功能')
      registerPageLock(this)
    }
    if (this.settings.enableTableOfContents) {
      console.log('注册目录插件功能')
      registerTableOfContents(this)
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
