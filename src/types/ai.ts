/**
 * AI 相关的统一类型定义
 * 消除项目中多处重复的接口定义
 */

/** API 供应商类型 */
export type AiProvider = "tongyi" | "openai" | "deepseek" | "custom"

/** AI API 配置接口（统一） */
export interface AiApiConfig {
  provider: AiProvider
  model: string
  apiKey: string
  customEndpoint: string
  enableThinking?: boolean
}

/** DeepSeek 思考强度 */
export type DeepSeekReasoningEffort = "high" | "max"

/** AI API 调用选项 */
export interface AiCallOptions {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  onReasoningChunk?: (chunk: string) => void
  enableThinking?: boolean
  reasoningEffort?: DeepSeekReasoningEffort
  /** DeepSeek 联网搜索 */
  webSearch?: boolean
}

/** AI 生成选项接口（用于 AIContentGenerator） */
export interface GenerateOptions {
  userInput: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  context?: string
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  /** DeepSeek 联网搜索 */
  webSearch?: boolean
}

/** 目标文档接口 */
export interface TargetDoc {
  id: string
  title: string
  content: string
  isBlock?: boolean
}

/** AI 提示词配置接口 */
export interface SavedPrompt {
  id: string
  name: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  createdAt: number
}

// ============ 技能问答相关类型 ============

/** 聊天消息 */
export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
  isStreaming?: boolean // 正在流式输出中的消息
}

/** 聊天选项（用于 AIContentGenerator.sendChatMessage） */
export interface ChatOptions {
  temperature: number
  maxTokens: number
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
}

/** AI 技能展示类型（统一，消除多处重复定义） */
export interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  tool: string
}

// ============ 自动化任务相关类型 ============

/** 执行频率类型 */
export type AutomationFrequency = "hourly" | "daily" | "weekly" | "monthly" | "custom"

/** 自动化任务接口 */
export interface AutomationTask {
  id: string
  name: string
  /** 自定义提示词 */
  prompt: string
  /** 系统提示词 */
  systemPrompt: string
  /** 执行频率 */
  frequency: AutomationFrequency
  /** 自定义 cron 表达式（frequency 为 custom 时使用） */
  customCron?: string
  /** 间隔分钟数（frequency 为 hourly 时使用，默认 60） */
  intervalMinutes?: number
  /** 每周几执行（frequency 为 weekly 时使用，0=周日，1=周一...6=周六） */
  weekDay?: number
  /** 每月几号执行（frequency 为 monthly 时使用，1-31） */
  monthDay?: number
  /** 执行时间（小时:分钟，如 "09:30"） */
  executeTime?: string
  /** 是否启用 */
  enabled: boolean
  /** 目标文档ID（可选，指定后结果写入该文档） */
  targetDocId?: string
  /** 创建时间 */
  createdAt: number
  /** 最后执行时间 */
  lastExecutedAt?: number
  /** 温度参数 */
  temperature: number
  /** 最大 token 数 */
  maxTokens: number
  /** 是否启用联网搜索（仅 DeepSeek） */
  webSearch?: boolean
}
