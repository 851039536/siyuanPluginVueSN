import type {
  AutomationTask,
  SavedPrompt,
} from "@/types/ai"
/**
 * AI内容生成器数据存储管理
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export type { SavedPrompt }

export interface AISettings {
  systemPrompt: string
  temperature: number
  maxTokens: number
  model: string
  customModel: string
  enableThinking: boolean
}

const DEFAULT_AI_SETTINGS: AISettings = {
  systemPrompt: "",
  temperature: 0.7,
  maxTokens: 10000,
  model: "",
  customModel: "",
  enableThinking: false,
}

/**
 * AI内容生成器存储管理器
 */
export class AIGeneratorStorage {
  readonly settings: TypedStorage<AISettings>
  readonly prompts: TypedStorage<SavedPrompt[]>
  readonly currentPrompt: TypedStorage<string>
  readonly automationTasks: TypedStorage<AutomationTask[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "ai-content-generator-settings", DEFAULT_AI_SETTINGS)
    this.prompts = new TypedStorage(storage, "ai-content-generator-prompts", [])
    this.currentPrompt = new TypedStorage(storage, "ai-content-generator-current-prompt")
    this.automationTasks = new TypedStorage(storage, "ai-content-generator-automation-tasks", [])
  }

  async init(): Promise<void> {
    try {
      const settings = await this.settings.load()
      if (!settings) {
        await this.settings.save(DEFAULT_AI_SETTINGS)
      }

      const prompts = await this.prompts.load()
      if (!prompts) {
        await this.prompts.save([])
      }

      const tasks = await this.automationTasks.load()
      if (!tasks) {
        await this.automationTasks.save([])
      }
    } catch (error) {
      console.error("初始化AI生成器存储失败:", error)
    }
  }
}
