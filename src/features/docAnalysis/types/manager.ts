/**
 * 文档分析 — 独立窗口 Manager 类
 *
 * 承载方案（纯官方 API，双形态）：
 * 1. Dock 侧边栏：index.ts 经 createVueDockApp 挂载。
 * 2. 独立窗口：plugin.addTab 注册自定义 Tab 模型 → openTab 创建页签 → openWindow 移入浮动窗口。
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
import DocAnalysisPanel from "../index.vue"

/** 文档分析自定义页签类型 */
export const DOC_ANALYSIS_TAB_TYPE = "doc-analysis-tab"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：多窗口场景下每个渲染进程只注册一次 */
let tabRegistered = false

/**
 * Manager：管理文档分析自定义页签与独立窗口生命周期。
 * 打开独立窗口：先创建/聚焦主窗口页签（openTab），再移入浮动窗口（openWindow），
 * 关闭浮动窗口时思源会自动把页签移回主窗口，无需反向操作。
 */
export class DocAnalysisManager {
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
      type: DOC_ANALYSIS_TAB_TYPE,
      init: init as () => void,
      destroy,
    })
  }

  /** 挂载 Vue 面板到 Tab 容器（容器补全局基准字号类 + 全高） */
  private mountPanel(element: HTMLElement) {
    this.unmountPanel()
    const container = document.createElement("div")
    container.classList.add("vp-dock-root")
    container.style.height = "100%"
    container.style.overflow = "hidden"
    this.container = container
    element.appendChild(container)
    this.app = createApp({
      setup: () => () => h(DocAnalysisPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      plugin: this.plugin,
      i18n: (this.plugin.i18n as any)?.docAnalysis || {},
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

  /** 打开文档分析（独立浮动窗口）：先创建/聚焦主窗口页签，再移入浮动窗口 */
  public async openFloating() {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 1280,
        height: 800,
        tab,
      })
    } catch (error) {
      console.error("[DocAnalysis] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦文档分析页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = (this.plugin.i18n as any)?.docAnalysis?.title || "文档分析"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${DOC_ANALYSIS_TAB_TYPE}`,
          icon: "iconDocAnalysis",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[DocAnalysis] openTab failed:", error)
      return null
    }
  }

  public destroy() {
    this.unmountPanel()
  }
}
