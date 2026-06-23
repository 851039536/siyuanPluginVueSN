import type { IconKey } from "@/config/icons"
import type { PluginSettings } from "@/config/settings"
import type { FeatureAction } from "@/features/config"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
/**
 * 超级面板 - 类型定义
 */
import {
  Plugin,
  showMessage,
} from "siyuan"
import { reactive } from "vue"
import { FEATURE_ICONS } from "@/config/icons"
import { featureIdToSettingKey } from "@/config/settings"
import { FEATURE_CONFIG } from "@/features/config"
import { emitCustomEvent } from "@/utils/eventBus"
import { replaceTopBarIcon } from "@/utils/iconHelper"
import { PluginStorage } from "@/utils/pluginStorage"
import { createModalVueApp } from "@/utils/vueAppHelper"
import AiSettingsPanel from "../components/AiSettingsPanel.vue"
import VersionPanel from "../components/VersionPanel.vue"
import SuperPanelPanel from "../index.vue"
import {
  type VersionManager,
  createVersionManager,
} from "../composables/useVersionManager"

export type { FeatureAction }

export const FEATURE_STATUSES = ["stable", "needsFix", "critical", "minor"] as const
export type FeatureStatus = typeof FEATURE_STATUSES[number] | ""

export const DEFAULT_VERSION = "1.0.0.0"

export interface FeatureVersionEntry {
  version: string
  date: string
  description: string
}

/**
 * 子功能配置
 */
export interface SubFeature {
  /** 子功能ID */
  id: string
  /** 子功能标签 */
  label: string
  /** 图标名 */
  icon: string
  /** 图标颜色 */
  color: string
  /** 是否启用 */
  enabled: boolean
}

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
  /** 状态标识 */
  status: FeatureStatus
  /** 当前版本号 */
  version: string
  /** 子功能列表 */
  subFeatures?: SubFeature[]
}

/**
 * AI设置
 */
export interface AiSettings {
  provider: string
  model: string
  customModel: string
  /** 当前供应商的 API Key */
  apiKey: string
  /** 所有供应商的 API Key 映射（切换供应商时读取对应 Key） */
  apiKeys: Record<string, string>
  customEndpoint: string
  enableThinking: boolean
  /** 搜索引擎供应商 */
  searchProvider: string
  /** 博查 API Key */
  searchBochaApiKey: string
  /** SearXNG 实例地址 */
  searchSearxngUrl: string
}

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
  openBookmarkMarker: { event: "openBookmarkMarker" },
  openTextDiff: { event: "openTextDiff" },
}

/**
 * 超级面板管理器
 */
export class SuperPanelManager {
  private plugin: Plugin
  private boundToggleHandler: () => void
  private panel: ModalAppInstance
  private aiSettingsModal: ModalAppInstance
  private versionModal: ModalAppInstance | null = null
  private versionMgr: VersionManager
  private reactiveSettings: PluginSettings | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.boundToggleHandler = this.toggle.bind(this)
    const dataDir = ((plugin as any).dataDir || (plugin as any).getDataDir?.()) || ""
    const storage = new PluginStorage(plugin)
    this.versionMgr = createVersionManager(storage, dataDir)

    this.panel = createModalVueApp(SuperPanelPanel, {
      maskId: "super-panel-mask",
      width: "860px",
      height: "80vh",
      getCloseHandler: () => this.close.bind(this),
      buildProps: () => ({
        settings: this.reactiveSettings!,
        i18n: (this.plugin.i18n as any).superPanel || {},
        featureVersions: this.versionMgr.featureVersions,
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
        onToggleFeature: async (featureId: string, enabled: boolean) => {
          await this.handleToggleFeature(featureId, enabled)
        },
        onToggleSubFeature: async (featureId: string) => {
          const settingKey = featureIdToSettingKey(featureId)
          const current = (this.reactiveSettings as any)?.[settingKey] ?? false
          await this.handleToggleFeature(featureId, !current)
        },
        onStatusFeature: async (featureId: string, status: string) => {
          await this.handleStatusFeature(featureId, status)
        },
        onSelectFeature: async (featureId: string, value: string) => {
          await this.handleSelectFeature(featureId, value)
        },
        onOpenAiSettings: () => {
          this.openAiSettings()
        },
        onOpenVersions: (featureId: string) => {
          this.openVersions(featureId)
        },
      }),
    })

    this.aiSettingsModal = createModalVueApp(AiSettingsPanel, {
      maskId: "super-panel-ai-settings-mask",
      width: "520px",
      height: "auto",
      getCloseHandler: () => this.closeAiSettings.bind(this),
      buildProps: () => this.buildAiSettingsProps(),
    })
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
    if (this.panel.visible) {
      this.close()
    } else {
      this.open()
    }
  }

  private async open() {
    await this.versionMgr.loadVersions()
    this.reactiveSettings = reactive<PluginSettings>((this.plugin as any).settings)
    this.panel.open()
  }

  private close() {
    this.panel.close()
    this.reactiveSettings = null
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

  private async _updatePluginSettings(
    fields: Partial<PluginSettings>,
    successMsg?: string,
  ): Promise<boolean> {
    const pluginSample = this.plugin as any
    const newSettings = {
      ...pluginSample.settings,
      ...fields,
    }
    const success = await pluginSample.updateSettings(newSettings)
    if (success) {
      if (this.reactiveSettings) {
        Object.assign(this.reactiveSettings, fields)
      }
      if (successMsg) {
        showMessage(successMsg, 2000, "info")
      }
    } else {
      showMessage(
        (this.plugin.i18n as any).saveFailed || "保存失败",
        3000,
        "error",
      )
    }
    return success
  }

  private handleFeatureAction(action: string) {
    // 处理统一 action 映射
    const actionConfig = ACTION_EVENT_MAP[action]
    if (actionConfig) {
      emitCustomEvent(actionConfig.event, actionConfig.detail)
      this.close()
      return
    }

    showMessage("功能开发中...", 2000, "info")
  }

  private async handleUpdateAiSettings(aiSettings: AiSettings) {
    // 将当前供应商的 API Key 存入按供应商隔离的 KeyMap
    const pluginSample = this.plugin as any
    const currentKeys = { ...(pluginSample.settings?.aiApiKeys || {}) }
    if (aiSettings.apiKey) {
      currentKeys[aiSettings.provider] = aiSettings.apiKey
    } else {
      delete currentKeys[aiSettings.provider]
    }
    await this._updatePluginSettings(
      {
        aiApiProvider: aiSettings.provider,
        aiModel: aiSettings.model,
        aiCustomModel: aiSettings.customModel,
        aiApiKeys: currentKeys,
        aiCustomEndpoint: aiSettings.customEndpoint,
        aiEnableThinking: aiSettings.enableThinking,
        searchProvider: aiSettings.searchProvider || "jina",
        searchBochaApiKey: aiSettings.searchBochaApiKey || "",
        searchSearxngUrl: aiSettings.searchSearxngUrl || "",
      },
      "AI配置已保存",
    )
  }

  private async handleToggleFeature(featureId: string, enabled: boolean) {
    const settingKey = featureIdToSettingKey(featureId)
    await this._updatePluginSettings({
      [settingKey]: enabled,
    } as Partial<PluginSettings>)
  }

  private async handleStatusFeature(featureId: string, featureStatus: string) {
    const s = (this.plugin as any).settings || {}
    const currentStatus = { ...(s.featureStatus || {}) }
    currentStatus[featureId] = featureStatus
    await this._updatePluginSettings({
      featureStatus: currentStatus,
    })
  }

  private async handleSelectFeature(featureId: string, value: string) {
    if (featureId === "themeColor") {
      await this._updatePluginSettings({
        themeColorScheme: value,
      })
    }
  }

  public openAiSettings() {
    this.aiSettingsModal.open()
  }

  public closeAiSettings() {
    this.aiSettingsModal.close()
  }

  private buildAiSettingsProps(): Record<string, any> {
    const s = (this.plugin as any).settings || {}
    return {
      "visible": true,
      "settings": {
        provider: s.aiApiProvider || "tongyi",
        model: s.aiModel || "qwen-plus",
        customModel: s.aiCustomModel || "",
        apiKey: (s.aiApiKeys?.[s.aiApiProvider || "tongyi"]) || "",
        apiKeys: s.aiApiKeys || {},
        customEndpoint: s.aiCustomEndpoint || "",
        enableThinking: s.aiEnableThinking ?? false,
        searchProvider: s.searchProvider || "jina",
        searchBochaApiKey: s.searchBochaApiKey || "",
        searchSearxngUrl: s.searchSearxngUrl || "",
      },
      "i18n": (this.plugin.i18n as any).superPanel || {},
      "onClose": () => {
        this.closeAiSettings()
      },
      'onUpdate:settings': async (aiSettings: AiSettings) => {
        await this.handleUpdateAiSettings(aiSettings)
      },
    }
  }

  // ==================== 版本管理 ====================

  public openVersions(featureId: string) {
    const featureMeta = [...FEATURE_CONFIG].find((f: any) => f.id === featureId) as any
    const featureTitle = featureMeta?.defaultTitle || featureId
    const storagePath = this.versionMgr.getStoragePath()

    this.versionModal = createModalVueApp(VersionPanel, {
      maskId: "super-panel-version-mask",
      width: "624px",
      height: "auto",
      getCloseHandler: () => this.closeVersions.bind(this),
      buildProps: () => ({
        featureId,
        featureTitle,
        versions: this.versionMgr.featureVersions[featureId] || [],
        storagePath,
        onAddVersion: async (entry: FeatureVersionEntry) => {
          await this.versionMgr.addVersion(featureId, entry)
          this.refreshVersionModal(featureId)
        },
        onUpdateVersion: async (index: number, entry: FeatureVersionEntry) => {
          await this.versionMgr.updateVersion(featureId, index, entry)
          this.refreshVersionModal(featureId)
        },
        onDeleteVersion: async (index: number) => {
          await this.versionMgr.deleteVersion(featureId, index)
          this.refreshVersionModal(featureId)
        },
        onClose: () => {
          this.closeVersions()
        },
      }),
    })

    this.versionModal.open()
  }

  public closeVersions() {
    this.versionModal?.close()
    this.versionModal = null
  }

  private refreshVersionModal(featureId: string) {
    if (!this.versionModal) return
    this.versionModal.close()
    this.openVersions(featureId)
  }

  public destroy() {
    this.panel.destroy()
    this.closeAiSettings()
    this.closeVersions()
    window.removeEventListener("toggleSuperPanel", this.boundToggleHandler)
  }
}
