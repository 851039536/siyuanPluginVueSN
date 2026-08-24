/**
 * 灵感生成器 — 类型定义 + 预设分类常量 + IdeaGeneratorManager 类
 * 双形态承载（addTab 自定义页签 + openWindow 浮动窗口），生成逻辑由 composable 负责
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
import type { IconKey } from "@/config/icons"
import IdeaGeneratorPanel from "../index.vue"

/** 预设灵感分类（共享常量：供分类选择器 UI 与 prompt 构建复用） */
export interface IdeaCategory {
  id: string
  /** 分类标签 i18n 键（如 ideaGenerator.category.desktopTool） */
  labelKey: string
  /** 已注册图标键（icons.ts COMMON_ICONS） */
  icon: IconKey
}

export const IDEA_CATEGORIES: IdeaCategory[] = [
  { id: "desktop-tool", labelKey: "ideaGenerator.category.desktopTool", icon: "ideaCatDesktop" },
  { id: "cli-script", labelKey: "ideaGenerator.category.cliScript", icon: "ideaCatCli" },
  { id: "siyuan-plugin", labelKey: "ideaGenerator.category.siyuanPlugin", icon: "ideaCatSiyuan" },
  { id: "web-app", labelKey: "ideaGenerator.category.webApp", icon: "ideaCatWeb" },
  { id: "productivity", labelKey: "ideaGenerator.category.productivity", icon: "ideaCatProductivity" },
  { id: "automation", labelKey: "ideaGenerator.category.automation", icon: "ideaCatAutomation" },
]

/** 单条灵感 */
export interface IdeaItem {
  id: string
  title: string
  description: string
}

/** 灵感生成器 i18n 键接口 */
export interface IdeaGeneratorI18n {
  title?: string
  keywordPlaceholder?: string
  categoryLabel?: string
  generate?: string
  generating?: string
  regenerate?: string
  cancel?: string
  empty?: string
  emptyHint?: string
  copy?: string
  copied?: string
  expand?: string
  collapse?: string
  refine?: string
  refineLoading?: string
  refineCancel?: string
  detailTitle?: string
  detailDescription?: string
  detailPlan?: string
  detailPlanEmpty?: string
  copyDetail?: string
  statusDone?: string
  generateError?: string
  refineError?: string
}

export const TAB_TYPE = "idea-generator-tab"

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 模块级重复注册防护：插件在每个渲染进程 onload 一次，多窗口场景下每个窗口只注册一次 */
let tabRegistered = false

/**
 * Manager：管理自定义 Tab 模型与独立窗口生命周期。
 * 数据/生成状态由 index.vue 内 composable 统一负责。
 */
export class IdeaGeneratorManager {
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
    // 监听全局打开事件（来自超级面板/快捷键的跨功能联动），destroy 时移除
    window.addEventListener("openIdeaGenerator", this.boundOpenHandler)
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
      setup: () => () => h(IdeaGeneratorPanel as any, this.buildProps()),
    })
    this.app.mount(container)
  }

  private buildProps(): Record<string, any> {
    return {
      plugin: this.plugin,
      i18n: (this.plugin.i18n as any)?.ideaGenerator || {},
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
   * 打开灵感生成器（主窗口 tab）：openTab 创建/聚焦自定义页签。
   * 页签已打开时思源会直接聚焦它。
   */
  public async open() {
    await this.openTabInMainWindow()
  }

  /** 打开灵感生成器（独立浮动窗口）：先创建/聚焦主窗口页签，再移入浮动窗口 */
  public async openFloating() {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 1000,
        height: 700,
        tab,
      })
    } catch (error) {
      console.error("[IdeaGenerator] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = (this.plugin.i18n as any)?.ideaGenerator?.title || "灵感生成器"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${TAB_TYPE}`,
          icon: "iconLightbulb",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[IdeaGenerator] openTab failed:", error)
      return null
    }
  }

  public destroy() {
    window.removeEventListener("openIdeaGenerator", this.boundOpenHandler)
    this.unmountPanel()
  }
}

let _instance: IdeaGeneratorManager | null = null

/** 公共 API：打开灵感生成器窗口 */
export function showIdeaGenerator(plugin?: Plugin) {
  const mounted = plugin
    ? (plugin as any).__ideaGenerator as IdeaGeneratorManager | undefined
    : undefined
  if (mounted) {
    void mounted.open()
    return
  }
  if (!_instance && plugin) {
    _instance = new IdeaGeneratorManager(plugin)
  }
  void _instance?.open()
}
