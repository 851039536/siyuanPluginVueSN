import type { IconKey } from "@/config/icons"
import type { PluginSettings } from "@/config/settings"
import type { FeatureAction } from "@/features/config"
import type { AiProfileConfig } from "@/types/ai"
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
import {
  DEFAULT_SETTINGS,
  featureIdToSettingKey,
} from "@/config/settings"
import { isThemeColorSchemeId } from "@/features/themeColor"
import { emitCustomEvent } from "@/utils/eventBus"
import { replaceTopBarIcon } from "@/utils/iconHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import AiSettingsPanel from "../components/AiSettingsPanel.vue"
import SuperPanelPanel from "../index.vue"

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
}

/**
 * 统一 action 映射表：action -> 事件配置
 * 仅收录 FEATURE_CONFIG 中实际声明的 action key（无对应卡片的条目属于死配置，禁止预留）。
 * ⚠️ "dock-click" 事件当前全仓库无监听者，新增 dock 类 action 前需先在 App.vue 补监听。
 */
const ACTION_EVENT_MAP: Record<
  string,
  { event: string, detail?: any }
> = {
  openVideoManager: { event: "openVideoManager" },
  openEverythingSearch: { event: "openEverythingSearch" },
  openFormatAssistant: { event: "openFormatAssistant" },
  openBookmarkMarker: { event: "openBookmarkMarker" },
  openS3FileManager: { event: "openS3FileManager" },
  openGlobalRelations: { event: "toggleGlobalRelations" },
  openMinimalBrowser: { event: "openMinimalBrowser" },
  openComponentPreview: { event: "openComponentPreview" },
  openIdeaGenerator: { event: "openIdeaGenerator" },
}

/**
 * 超级面板管理器
 */
export class SuperPanelManager {
  private plugin: Plugin
  private boundToggleHandler: () => void
  private panel: ModalAppInstance
  private aiSettingsModal: ModalAppInstance
  private reactiveSettings: PluginSettings | null = null
  /** 顶栏图标元素（destroy 时移除，避免插件禁用/重载后残留幽灵图标） */
  private topBarElement: HTMLElement | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.boundToggleHandler = this.toggle.bind(this)

    this.panel = createModalVueApp(SuperPanelPanel, {
      maskId: "super-panel-mask",
      width: "860px",
      height: "80vh",
      getCloseHandler: () => this.close.bind(this),
      buildProps: () => ({
        settings: this.reactiveSettings!,
        // 传全根 i18n：FEATURE_CONFIG 的 titleI18nKey/descI18nKey 是全根路径
        //（如 "statusBar.title"），传命名空间切片会全部解析失败而回退中文（P1-2）。
        // 主面板自身文案通过 i18n.superPanel 命名空间访问（见 index.vue 的 panelI18n）。
        i18n: (this.plugin.i18n as any) || {},
        themeColorI18n: (this.plugin.i18n as any).themeColor || {},
        onClose: () => {
          this.close()
        },
        onAction: (action: string) => {
          this.handleFeatureAction(action)
        },
        onToggleFeature: async (featureId: string, enabled: boolean) => {
          await this.handleToggleFeature(featureId, enabled)
        },
        onToggleSubFeature: async (featureId: string) => {
          const settingKey = featureIdToSettingKey(featureId)
          // 默认值与显示端 getFeatureEnabled 的 ?? true 保持一致，避免"显示开、点第一下无效果"
          const current = (this.reactiveSettings as any)?.[settingKey] ?? true
          await this.handleToggleFeature(featureId, !current)
        },
        onSelectFeature: async (featureId: string, value: string) => {
          await this.handleSelectFeature(featureId, value)
        },
        onColorChange: async (featureId: string, value: string) => {
          await this.handleColorChange(featureId, value)
        },
        onOpenAiSettings: () => {
          this.openAiSettings()
        },
      }),
    })

    this.aiSettingsModal = createModalVueApp(AiSettingsPanel, {
      maskId: "super-panel-ai-settings-mask",
      width: "520px",
      // 固定高度：Tab 内容量不同会导致 auto 高度切换时跳变
      height: "560px",
      // 从超级面板之上弹出的二级弹窗：透明遮罩避免两层全屏遮罩叠加压暗
      maskBackground: "rgba(0, 0, 0, 0)",
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
    this.topBarElement = topBarElement

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

  private open() {
    const source = (this.plugin as any).settings as PluginSettings | undefined
    // 兜底：loadAndApplySettings 完成前通过热键打开面板时，避免 reactive(undefined) 导致渲染抛错
    this.reactiveSettings = reactive<PluginSettings>(source ?? { ...DEFAULT_SETTINGS })
    this.panel.open()
  }

  private close() {
    this.panel.close()
    this.reactiveSettings = null
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

    showMessage(
      (this.plugin.i18n as any).superPanel?.featureInDev || "功能开发中...",
      2000,
      "info",
    )
  }

  private async handleUpdateAiProfiles(profiles: AiProfileConfig[]) {
    // 档案列表整体持久化（内部敏感字段由 settings.ts 的加密链路统一处理）
    const current = (this.plugin as any).settings?.aiProfiles || []
    const message = profiles.length < current.length
      ? (this.plugin.i18n as any).superPanel?.profileDeletedMsg || "AI配置档案已删除"
      : (this.plugin.i18n as any).superPanel?.profileSavedMsg || "AI配置档案已保存"
    await this._updatePluginSettings(
      {
        aiProfiles: profiles,
      },
      message,
    )
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
      },
      (this.plugin.i18n as any).superPanel?.aiSettingsSavedMsg || "AI配置已保存",
    )
  }

  private async handleToggleFeature(featureId: string, enabled: boolean) {
    const settingKey = featureIdToSettingKey(featureId)
    await this._updatePluginSettings({
      [settingKey]: enabled,
    } as Partial<PluginSettings>)
  }

  private async handleSelectFeature(featureId: string, value: string) {
    if (featureId === "themeColor" && isThemeColorSchemeId(value)) {
      await this._updatePluginSettings({
        themeColorScheme: value,
      })
    }
  }

  private async handleColorChange(featureId: string, value: string) {
    if (featureId === "themeColor" && /^#[\da-f]{6}$/i.test(value)) {
      await this._updatePluginSettings({
        themeColorScheme: "custom",
        customThemeColor: value.toLowerCase(),
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
      "settings": {
        provider: s.aiApiProvider || "tongyi",
        model: s.aiModel || "qwen-plus",
        customModel: s.aiCustomModel || "",
        apiKey: (s.aiApiKeys?.[s.aiApiProvider || "tongyi"]) || "",
        apiKeys: s.aiApiKeys || {},
        customEndpoint: s.aiCustomEndpoint || "",
        enableThinking: s.aiEnableThinking ?? false,
      },
      "profiles": s.aiProfiles || [],
      "i18n": (this.plugin.i18n as any).superPanel || {},
      "onClose": () => {
        this.closeAiSettings()
      },
      'onUpdate:settings': async (aiSettings: AiSettings) => {
        await this.handleUpdateAiSettings(aiSettings)
      },
      'onUpdate:profiles': async (profiles: AiProfileConfig[]) => {
        await this.handleUpdateAiProfiles(profiles)
      },
    }
  }

  public destroy() {
    this.panel.destroy()
    this.closeAiSettings()
    window.removeEventListener("toggleSuperPanel", this.boundToggleHandler)
    this.topBarElement?.remove()
    this.topBarElement = null
  }
}
