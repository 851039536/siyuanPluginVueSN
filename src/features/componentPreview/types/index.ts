/**
 * 组件预览 — 类型定义 + PreviewManager 类 + 公开 API
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
import type { Component } from "vue"
import type { App } from "vue"
import type { VNode } from "vue"
import {
  createApp,
  h,
} from "vue"
import ComponentPreviewPanel from "../index.vue"

// 组件尺寸档位类型与常量独立成文件（无 vue/plugin 依赖），此处统一转出保持对外入口一致
export type {
  ComponentSize,
  SizeOption,
} from "./size"
export {
  COMPONENT_SIZES,
  DEFAULT_COMPONENT_SIZE,
  isComponentSize,
} from "./size"

/** 组件预览功能面板用到的 i18n 键（值来自 plugin.i18n.componentPreview） */
export interface I18n {
  title?: string
  subtitle?: string
  searchPlaceholder?: string
  noMatch?: string
  clearSearch?: string
  copyCode?: string
  copied?: string
  copyFailed?: string
  viewCode?: string
  hideCode?: string
  openFloatingWindow?: string
  preview?: string
  code?: string
  sizeXsmall?: string
  sizeSmall?: string
  sizeMedium?: string
  sizeLarge?: string
  /** 档位切换分组的无障碍名称（role="group" 的 aria-label） */
  sizeLabel?: string
}

/** 单个用法示例（props 组合 + 默认插槽文本 + 对应可复制代码） */
export interface PreviewExample {
  /** 示例标题（数据文件内中文文案） */
  title: string
  /** 透传给组件的 props 组合 */
  props?: Record<string, any>
  /** 默认插槽文本（无插槽需求的组件省略） */
  slotText?: string
  /**
   * 复合示例的自定义插槽渲染（入参为注入全局档位后的实际渲染 props）。
   * 存在时优先于 slotText，用于 InputGroup 这类默认插槽需放多个子组件的示例。
   */
  render?: (props: Record<string, any>) => VNode | VNode[]
  /**
   * 具名 / 作用域插槽渲染：键为插槽名，值为接收该插槽作用域参数的 VNode 工厂。
   * 工厂可能被多次调用（如列表类组件每个事件一次），因此必须在工厂内部新建 VNode，不可复用同一实例。
   * 第二个入参是**注入全局档位后的实际渲染 props** —— 插槽里放了共享控件（Button / Input 等）时，
   * 用它把同档 `size` 透传给这些控件，避免容器档位与内部控件脱节（Toolbar 即此用法）。
   */
  slots?: Record<string, (
    slotProps: Record<string, any>,
    exampleProps: Record<string, any>,
  ) => VNode | VNode[]>
  /** 与该示例等价的可复制 Vue 模板代码 */
  code: string
}

/** 组件预览分组：一个共享组件一个分组 */
export interface PreviewGroup {
  /** 分组 id（锚点用，如 "button"） */
  id: string
  /** 组件引用 */
  component: Component
  /** 组件显示名（如 "Button"） */
  name: string
  /** 中文说明（数据文件内文案） */
  summary: string
  /** 该组件的 import 代码（分区头部展示，可复制） */
  importCode: string
  /** 该组件是否支持 size 档位（支持时，未显式指定 size 的示例会注入全局尺寸档位） */
  sizeable?: boolean
  /** 用法示例列表 */
  examples: PreviewExample[]
}

export const TAB_TYPE = "component-preview-tab"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：插件在每个渲染进程 onload 一次，多窗口场景下每个窗口只注册一次 */
let tabRegistered = false

/** Manager：管理自定义 Tab 模型与独立窗口生命周期 */
export class PreviewManager {
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
    // 监听超级面板 action 派发的全局打开事件，destroy 时移除
    window.addEventListener("openComponentPreview", this.boundOpenHandler)
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
      setup: () => () => h(ComponentPreviewPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      plugin: this.plugin,
      i18n: (this.plugin.i18n as any)?.componentPreview || {},
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
   * 打开组件预览（主窗口 tab）：openTab 创建/聚焦自定义页签（文档化 API，
   * custom.id = 插件名 + tab.type）。页签已打开时思源会直接聚焦它。
   */
  public async open() {
    await this.openTabInMainWindow()
  }

  /** 打开组件预览（独立浮动窗口）：先创建/聚焦主窗口页签，再移入浮动窗口 */
  public async openFloating() {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 1160,
        height: 780,
        tab,
      })
    } catch (error) {
      console.error("[ComponentPreview] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = (this.plugin.i18n as any)?.componentPreview?.title || "组件预览"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${TAB_TYPE}`,
          icon: "iconComponentPreview",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[ComponentPreview] openTab failed:", error)
      return null
    }
  }

  public destroy() {
    window.removeEventListener("openComponentPreview", this.boundOpenHandler)
    this.unmountPanel()
  }
}

let _instance: PreviewManager | null = null

/** 公共 API：打开组件预览窗口 */
export function showComponentPreview(plugin?: Plugin) {
  const mounted = plugin
    ? (plugin as any).__componentPreview as PreviewManager | undefined
    : undefined
  if (mounted) {
    void mounted.open()
    return
  }
  if (!_instance && plugin) {
    _instance = new PreviewManager(plugin)
  }
  void _instance?.open()
}
