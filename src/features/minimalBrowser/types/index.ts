/**
 * 极简浏览器 — 类型定义 + BrowserManager 类 + 公开 API
 *
 * 承载方案（纯官方 API，双形态）：
 * 1. 主窗口 tab：plugin.addTab 注册自定义 Tab 模型 → openTab({custom}) 创建页签。
 * 2. 独立窗口：openWindow({tab}) 把同一页签移入浮动窗口，可随时移回（关闭浮动窗口）。
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
  openFloatingWindow?: string
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

    this.plugin.addTab({
      type: TAB_TYPE,
      init: init as () => void,
      destroy,
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
   * 打开极简浏览器（主窗口 tab）：openTab 创建/聚焦自定义页签（文档化 API，
   * custom.id = 插件名 + tab.type）。页签已打开时思源会直接聚焦它。
   * 若当前已在独立窗口中，会先把页签移回主窗口再聚焦。
   */
  public async open() {
    await this.openTabInMainWindow()
  }

  /** 打开极简浏览器（独立浮动窗口）：先创建/聚焦主窗口页签，再移入浮动窗口 */
  public async openFloating() {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 1100,
        height: 760,
        tab,
      })
    } catch (error) {
      console.error("[MinimalBrowser] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦浏览器页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = (this.plugin.i18n as any)?.minimalBrowser?.title || "极简浏览器"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${TAB_TYPE}`,
          icon: "iconEarth",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[MinimalBrowser] openTab failed:", error)
      return null
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
