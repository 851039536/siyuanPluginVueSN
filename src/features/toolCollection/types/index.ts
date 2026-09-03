/**
 * 工具合集 - 类型定义 + 独立窗口 Manager 类
 *
 * 承载方案（纯官方 API，双形态）：
 * 1. 底部面板：index.ts 挂载到 document.body，模块级 ref 控制显隐。
 * 2. 独立窗口：plugin.addTab 注册自定义 Tab 模型 → openTab 创建页签 → openWindow 移入浮动窗口。
 */
import type { Plugin } from "siyuan"
import {
  openTab,
  openWindow,
} from "siyuan"
import type { App, Component } from "vue"
import {
  createApp,
  h,
} from "vue"
import ToolCollectionPanel from "../index.vue"

/** 工具 Tab 元数据 */
export interface ToolMeta {
  /** 工具唯一标识 */
  id: string
  /** 显示标签（回退文本） */
  label: string
  /** 工具组件（可选，用于动态渲染） */
  component?: Component
}

/** 工具合集自定义页签类型 */
export const TOOL_COLLECTION_TAB_TYPE = "tool-collection-tab"

/** 面板可调维度 */
export type PanelDimension = "width" | "height"

/**
 * 面板尺寸边界与样式常量
 * 共用于三处：index.vue 头部调整按钮组、usePanelResize 持久化校验、useDragResize 拖拽钳制
 */
export const PANEL_WIDTH_MIN = 500
export const PANEL_WIDTH_MAX = 1600
/** 单位 vh */
export const PANEL_HEIGHT_MIN = 30
/** 单位 vh */
export const PANEL_HEIGHT_MAX = 100
/** overlay 模式面板最大高度（避让状态栏与底部留白）；styles/index.scss 中同值需保持一致 */
export const PANEL_MAX_HEIGHT = "calc(88vh - 36px)"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：多窗口场景下每个渲染进程只注册一次 */
let tabRegistered = false

/**
 * Manager：管理工具合集自定义页签与独立窗口生命周期。
 * 打开独立窗口：先创建/聚焦主窗口页签（openTab），再移入浮动窗口（openWindow），
 * 关闭浮动窗口时思源会自动把页签移回主窗口，无需反向操作。
 */
export class ToolCollectionManager {
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
      type: TOOL_COLLECTION_TAB_TYPE,
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
      setup: () => () => h(ToolCollectionPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      plugin: this.plugin,
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

  /** 打开工具合集（独立浮动窗口）：先创建/聚焦主窗口页签，再移入浮动窗口 */
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
      console.error("[ToolCollection] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦工具合集页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = (this.plugin.i18n as any)?.toolCollection || "工具合集"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${TOOL_COLLECTION_TAB_TYPE}`,
          icon: "iconToolCollection",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[ToolCollection] openTab failed:", error)
      return null
    }
  }

  public destroy() {
    this.unmountPanel()
  }
}
