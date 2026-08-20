import type { Plugin } from "siyuan"
import type { App } from "vue"
/**
 * Everything本地搜索功能 - 类型定义 + 独立窗口 Manager
 * 承载方案（纯官方 API，双形态）：overlay 弹窗（index.vue Teleport）+ 独立窗口（addTab + openWindow）
 */
import type { EverythingSearchResult } from "../api"
import {
  openTab,
  openWindow,
} from "siyuan"
import {
  createApp,
  h,
} from "vue"
import EverythingSearchPanel from "../index.vue"

export type {
  /** Everything 服务连接配置 */
  EverythingConfig,
  /** Everything 搜索结果项 */
  EverythingSearchResult,
} from "../api"

/** 搜索选项 */
export interface SearchOptions {
  /** 区分大小写 */
  matchCase: boolean
  /** 全词匹配 */
  matchWholeWord: boolean
  /** 匹配路径 */
  matchPath: boolean
  /** 正则表达式 */
  regex: boolean
  /** 最大结果数 */
  maxResults: number
  /** 防抖延迟（毫秒） */
  debounceDelay: number
  /** 排序字段 */
  sort: "name" | "path" | "size" | "date_modified"
  /** 升序 */
  ascending: boolean
  /** 高级搜索模式（显示语法帮助面板） */
  advancedMode: boolean
  /** 最小文件大小过滤值（0=禁用） */
  minSize: number
  /** 最小文件大小单位 */
  minSizeUnit: 'KB' | 'MB' | 'GB'
  /** 最大文件大小过滤值（0=禁用） */
  maxSize: number
  /** 最大文件大小单位 */
  maxSizeUnit: 'KB' | 'MB' | 'GB'
  /** 常用关键字列表 */
  frequentKeywords: string[]
  /** 仅搜索路径列表（每项一个路径，走 Everything path: 语法，AND 关系） */
  includePaths: string[]
  /** 排除路径列表（每项一个路径，走 Everything !path: 语法） */
  excludePaths: string[]
}

/** 搜索结果状态 */
export type SearchStatus = "idle" | "loading" | "success" | "error" | "empty"

/** 搜索结果状态数据 */
export interface SearchState {
  /** 状态 */
  status: SearchStatus
  /** 结果列表 */
  results: EverythingSearchResult[]
  /** 错误信息 */
  errorMessage: string
}

/** Everything 搜索自定义页签类型 */
export const EVERYTHING_SEARCH_TAB_TYPE = "everything-search-tab"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：多窗口场景下每个渲染进程只注册一次 */
let tabRegistered = false

/**
 * Manager：管理 Everything 搜索自定义页签与独立窗口生命周期。
 * 打开独立窗口：先创建/聚焦主窗口页签（openTab），再移入浮动窗口（openWindow），
 * 关闭浮动窗口时思源会自动把页签移回主窗口，无需反向操作。
 */
export class EverythingSearchManager {
  private plugin: Plugin
  private app: App | null = null
  private container: HTMLElement | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.registerTabModel()
  }

  /** 注册自定义 Tab 模型（init 的 this 指向 Custom 实例，this.element 为挂载点） */
  private registerTabModel() {
    if (tabRegistered) return
    tabRegistered = true

    const init = (custom: TabCustom) => {
      if (custom.element) {
        this.mountPanel(custom.element as HTMLElement)
      }
    }
    const destroy = () => {
      this.unmountPanel()
    }

    this.plugin.addTab({
      type: EVERYTHING_SEARCH_TAB_TYPE,
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
      setup: () => () => h(EverythingSearchPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      visible: true,
      mode: "tab",
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

  /** 打开 Everything 搜索（独立浮动窗口）：先创建/聚焦主窗口页签，再移入浮动窗口 */
  public async openFloating() {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 1080,
        height: 760,
        tab,
      })
    } catch (error) {
      console.error("[EverythingSearch] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦 Everything 搜索页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = (this.plugin.i18n as any)?.everythingSearch?.title || "Everything搜索"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${EVERYTHING_SEARCH_TAB_TYPE}`,
          icon: "iconEverythingSearch",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[EverythingSearch] openTab failed:", error)
      return null
    }
  }

  public destroy() {
    this.unmountPanel()
  }
}
