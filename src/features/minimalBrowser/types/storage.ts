/**
 * 极简浏览器 — 设置数据持久化层
 */
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 浏览器设置 */
export interface BrowserSettings {
  /** 主页网址（空字符串 = 打开收藏列表作为主页） */
  homeUrl: string
}

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  homeUrl: "",
}

const SETTINGS_KEY = "minimal-browser-settings"

export class BrowserSettingsStorage {
  readonly settings: TypedStorage<BrowserSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, SETTINGS_KEY, DEFAULT_BROWSER_SETTINGS)
  }

  /** 加载设置；从未保存过时返回默认值（启动即加载，设置面板只负责修改） */
  async loadOrDefault(): Promise<BrowserSettings> {
    return this.settings.loadOrDefault()
  }

  /** 保存设置，返回是否成功 */
  async save(settings: BrowserSettings): Promise<boolean> {
    return this.settings.save(settings)
  }
}
