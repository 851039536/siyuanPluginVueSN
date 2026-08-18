/**
 * 极简浏览器 — 类型定义 + BrowserManager 类 + 公开 API
 *
 * 窗口承载方案：plugin.addTab 注册自定义 Tab 模型（init 回调的 this 为 Custom 实例，
 * this.element 为挂载点）→ openTab 在主窗口创建自定义页签 → openWindow({tab}) 将页签
 * 移入独立窗口；若移动失败页签保留在主窗口（优雅降级）。
 */
import type { Plugin } from "siyuan"
import {
  openTab,
  openWindow,
} from "siyuan"
import type { App } from "vue"
import {
  createApp,
  h,
} from "vue"
import MinimalBrowserPanel from "../index.vue"

export interface I18n {
  title?: string
  back?: string
  forward?: string
  refresh?: string
  home?: string
  addressPlaceholder?: string
  favorite?: string
  unfavorite?: string
  favoritesTitle?: string
  noFavorites?: string
  resizeSidebar?: string
  collapseSidebar?: string
  expandSidebar?: string
  saveFavoriteTitle?: string
  favoriteName?: string
  favoriteNamePlaceholder?: string
  save?: string
  cancel?: string
  editName?: string
  delete?: string
  confirmDelete?: string
  openExternal?: string
  settings?: string
  settingsTitle?: string
  homeUrl?: string
  homeUrlPlaceholder?: string
  homeUrlDesc?: string
  invalidUrl?: string
  saveSuccess?: string
  saveFailed?: string
  favoriteAdded?: string
  favoriteRemoved?: string
  favoriteExists?: string
  favoritesLoadFailed?: string
  noHomeConfigured?: string
}

export const TAB_TYPE = "minimal-browser-tab"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：插件在每个渲染进程 onload 一次，多窗口场景下每个窗口只注册一次 */
let tabRegistered = false

/**
 * Manager：管理自定义 Tab 模型与独立窗口生命周期。
 * 数据/导航状态由 index.vue 内 composable 统一负责。
 */
export class BrowserManager {
  private plugin: Plugin
  private app: App | null = null
  private container: HTMLElement | null = null
  private readonly boundOpenHandler: () => void

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.boundOpenHandler = () => {
      void this.open()
    }
    this.registerTabModel()
    // 监听全局打开事件（来自超级面板/状态栏的跨功能联动），destroy 时移除
    window.addEventListener("openMinimalBrowser", this.boundOpenHandler)
  }

  /** 注册自定义 Tab 模型（init 的 this 指向 Custom 实例，this.element 为挂载点） */
  private registerTabModel() {
    if (tabRegistered) return
    tabRegistered = true

    const self = this
    const init = function (this: TabCustom) {
      if (this.element) {
        self.mountPanel(this.element as HTMLElement)
      }
    }
    const destroy = () => {
      self.unmountPanel()
    }
    const resize = () => {
      // iframe 自适应容器尺寸，无需额外处理；保留钩子供后续扩展
    }

    this.plugin.addTab({
      type: TAB_TYPE,
      init: init as () => void,
      destroy,
      resize,
    })
  }

  /** 挂载 Vue 面板到 Tab 容器（容器补全局基准字号类 + 全高，与 createVueDockApp 一致） */
  private mountPanel(element: HTMLElement) {
    this.unmountPanel()
    const container = document.createElement("div")
    container.classList.add("vp-dock-root")
    container.style.height = "100%"
    container.style.overflow = "hidden"
    this.container = container
    element.appendChild(container)
    this.app = createApp({
      setup: () => () => h(MinimalBrowserPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      plugin: this.plugin,
      i18n: (this.plugin.i18n as any)?.minimalBrowser || {},
    }
  }

  private unmountPanel() {
    if (this.app) {
      this.app.unmount()
      this.app = null
    }
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }

  /**
   * 打开极简浏览器：
   * 1. openTab 在主窗口创建自定义页签（文档化 API，custom.id = 插件名 + tab.type）
   * 2. openWindow({tab}) 将页签移入独立窗口；失败时页签保留在主窗口（降级可用）
   */
  public async open() {
    try {
      const title = (this.plugin.i18n as any)?.minimalBrowser?.title || "极简浏览器"
      const tab = await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${TAB_TYPE}`,
          icon: "iconEarth",
          title,
        },
        position: "right",
      })
      try {
        openWindow({
          width: 1100,
          height: 760,
          tab,
        })
      } catch (error) {
        console.error("[MinimalBrowser] openWindow failed, tab stays in main window:", error)
      }
    } catch (error) {
      console.error("[MinimalBrowser] openTab failed:", error)
    }
  }

  public destroy() {
    window.removeEventListener("openMinimalBrowser", this.boundOpenHandler)
    this.unmountPanel()
  }
}

let _instance: BrowserManager | null = null

/** 公共 API：打开极简浏览器窗口 */
export function showMinimalBrowser(plugin?: Plugin) {
  const mounted = plugin
    ? (plugin as any).__minimalBrowser as BrowserManager | undefined
    : undefined
  if (mounted) {
    void mounted.open()
    return
  }
  if (!_instance && plugin) {
    _instance = new BrowserManager(plugin)
  }
  void _instance?.open()
}
