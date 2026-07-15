/**
 * AI内容生成器数据存储管理
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export interface AISettings {
  model: string
  customModel: string
  enableThinking: boolean
  webSearch: boolean
}

const DEFAULT_AI_SETTINGS: AISettings = {
  model: "",
  customModel: "",
  enableThinking: false,
  webSearch: false,
}

/**
 * AI内容生成器存储管理器
 */
export class AIGeneratorStorage {
  readonly settings: TypedStorage<AISettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "ai-content-generator-settings", DEFAULT_AI_SETTINGS)
  }

  async init(): Promise<void> {
    try {
      const settings = await this.settings.load()
      if (!settings) {
        await this.settings.save(DEFAULT_AI_SETTINGS)
      }
    } catch (error) {
      console.error("初始化AI生成器存储失败:", error)
    }
  }
}
