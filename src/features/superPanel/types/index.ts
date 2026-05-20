import type { App as VueApp } from "vue"
import type { IconKey } from "@/config/icons"
import type { PluginSettings } from "@/config/settings"
import type { FeatureAction } from "@/features/config"
/**
 * 超级面板 - 类型定义
 */
import {
  Plugin,
  showMessage,
} from "siyuan"
import {
  createApp,
  reactive,

} from "vue"
import { FEATURE_ICONS } from "@/config/icons"
import { emitCustomEvent } from "@/utils/eventBus"
import { replaceTopBarIcon } from "@/utils/iconHelper"
// @ts-ignore
import SuperPanelPanel from "../index.vue"

export type { FeatureAction }

/**
 * 功能配置
 */
export interface Feature {
  /** 功能ID */
  id: string
  /** 图标键名 */
  iconKey: IconKey
  /** 功能标题 */
  title: string
  /** 功能描述 */
  desc: string
  /** 操作列表 */
  actions: FeatureAction[]
}

/**
 * AI设置
 */
export interface AiSettings {
  provider: string
  model: string
  customModel: string
  apiKey: string
  customEndpoint: string
  enableThinking: boolean
  /** 搜索引擎供应商 */
  searchProvider: string
  /** 博查 API Key */
  searchBochaApiKey: string
  /** SearXNG 实例地址 */
  searchSearxngUrl: string
}

let vueApp: VueApp | null = null
let panelContainer: HTMLElement | null = null
let reactiveSettings: PluginSettings | null = null

/**
 * 统一 action 映射表：action -> 事件配置
 */
const ACTION_EVENT_MAP: Record<
  string,
  { event: string, detail?: any }
> = {
  openCompressor: { event: "openImageCompressor" },
  openVideoManager: { event: "openVideoManager" },
  openEverythingSearch: { event: "openEverythingSearch" },
  openFlashcardReading: { event: "openFlashcardReading" },
  openStatistics: { event: "openStatistics" },
  openDocAnalysis: {
    event: "dock-click",
    detail: { dockId: "doc-analysis-dock" },
  },
  openBase64Image: { event: "openBase64Image" },
  openFormatAssistant: { event: "openFormatAssistant" },
}

/**
 * 超级面板管理器
 */
export class SuperPanelManager {
  private plugin: Plugin
  private boundToggleHandler: () => void

  constructor(plugin: Plugin) {
    this.plugin = plugin
    // 绑定事件处理器，确保 add/remove 使用同一引用
    this.boundToggleHandler = this.toggle.bind(this)
  }

  public init() {
    this.addTopBar()
    this.addCommand()
    this.addEventListeners()
  }

  private addTopBar() {
    const topBarElement = this.plugin.addTopBar({
      icon: "iconMenu",
      title: (this.plugin.i18n as any).superPanel?.title || "超级面板",
      position: "right",
      callback: () => {
        this.toggle()
      },
    })

    // 替换为 Iconify 图标
    const superPanelIcon = FEATURE_ICONS.superPanel
    replaceTopBarIcon(topBarElement, superPanelIcon.icon, superPanelIcon.color)
  }

  private addCommand() {
    this.plugin.addCommand({
      langKey: "toggleSuperPanel",
      hotkey: "⌃⌥P",
      callback: () => {
        this.toggle()
      },
    })
  }

  private addEventListeners() {
    window.addEventListener("toggleSuperPanel", this.boundToggleHandler)
  }

  private toggle() {
    if (vueApp && panelContainer) {
      this.close()
    } else {
      this.open()
    }
  }

  private open() {
    // 创建容器
    panelContainer = document.createElement("div")
    panelContainer.id = "super-panel-vue-container"
    document.body.appendChild(panelContainer)

    // 创建响应式 settings 对象
    reactiveSettings = reactive<PluginSettings>((this.plugin as any).settings)

    // 创建 Vue 应用
    vueApp = createApp(SuperPanelPanel, {
      visible: true,
      settings: reactiveSettings,
      i18n: (this.plugin.i18n as any).superPanel || {},
      onClose: () => {
        this.close()
      },
      onAction: (action: string) => {
        this.handleFeatureAction(action)
      },
      onRefresh: async () => {
        await this.handleRefresh()
      },
      onUpdateAiSettings: async (aiSettings: AiSettings) => {
        await this.handleUpdateAiSettings(aiSettings)
      },
    })

    vueApp.mount(panelContainer)
  }

  private close() {
    if (vueApp && panelContainer) {
      vueApp.unmount()
      panelContainer.remove()
      vueApp = null
      panelContainer = null
      reactiveSettings = null
    }
  }

  private async handleRefresh() {
    try {
      showMessage(
        (this.plugin.i18n as any).superPanel?.refreshing || "正在刷新...",
        1000,
        "info",
      )
      this.close()
      await new Promise((resolve) => setTimeout(resolve, 100))
      this.open()
      showMessage(
        (this.plugin.i18n as any).superPanel?.refreshSuccess || "已刷新",
        1500,
        "info",
      )
    } catch (error) {
      console.error("刷新失败:", error)
      showMessage("刷新失败", 2000, "error")
    }
  }

  private handleFeatureAction(action: string) {
    // 处理统一 action 映射
    const actionConfig = ACTION_EVENT_MAP[action]
    if (actionConfig) {
      emitCustomEvent(actionConfig.event, actionConfig.detail)
      this.close()
      return
    }

    // 特殊处理：文本对比（直接调用 manager，不走事件）
    if (action === "openTextDiff") {
      (this.plugin as any).__textDiff?.toggle?.()
      this.close()
      return
    }

    showMessage("功能开发中...", 2000, "info")
  }

  private async handleUpdateAiSettings(aiSettings: AiSettings) {
    const pluginSample = this.plugin as any

    const aiSettingFields: Record<string, any> = {
      aiApiProvider: aiSettings.provider,
      aiModel: aiSettings.model,
      aiCustomModel: aiSettings.customModel,
      aiApiKey: aiSettings.apiKey,
      aiCustomEndpoint: aiSettings.customEndpoint,
      aiEnableThinking: aiSettings.enableThinking,
      searchProvider: aiSettings.searchProvider || "jina",
      searchBochaApiKey: aiSettings.searchBochaApiKey || "",
      searchSearxngUrl: aiSettings.searchSearxngUrl || "",
    }

    const newSettings = {
      ...pluginSample.settings,
      ...aiSettingFields,
    }

    const success = await pluginSample.updateSettings(newSettings)
    if (success) {
      // 更新响应式 settings 对象
      if (reactiveSettings) {
        Object.assign(reactiveSettings, aiSettingFields)
      }
      showMessage("AI配置已保存", 2000, "info")
    } else {
      showMessage(
        (this.plugin.i18n as any).saveFailed || "保存失败",
        3000,
        "error",
      )
    }
  }

  public destroy() {
    this.close()
    window.removeEventListener("toggleSuperPanel", this.boundToggleHandler)
  }
}
