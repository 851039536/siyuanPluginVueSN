/**
 * AI内容生成器数据存储管理
 */
import { Plugin } from "siyuan"
import type { DeepSeekReasoningEffort } from "@/types/ai"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export interface AISettings {
  model: string
  customModel: string
  enableThinking: boolean
  /** 思考强度（仅 DeepSeek 思考模式生效：low/high/max） */
  reasoningEffort: DeepSeekReasoningEffort
  webSearch: boolean
  /** 生成后使用 V4 Pro 交叉审核 */
  enableReview: boolean
  /** 上次选中的技能 id（空串 = 明确选择"无技能"） */
  skillId: string
}

const DEFAULT_AI_SETTINGS: AISettings = {
  model: "",
  customModel: "",
  enableThinking: false,
  reasoningEffort: "high",
  webSearch: false,
  enableReview: false,
  skillId: "",
}

/**
 * AI内容生成器存储管理器
 * 默认值由 TypedStorage 兜底，无需 init 预写入
 */
export class AIGeneratorStorage {
  readonly settings: TypedStorage<AISettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "ai-content-generator-settings", DEFAULT_AI_SETTINGS)
  }
}
