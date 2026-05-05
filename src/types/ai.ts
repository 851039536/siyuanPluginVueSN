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

// ============ 智能体问答相关类型 ============

/** 聊天消息 */
export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
  isStreaming?: boolean // 正在流式输出中的消息
}

/** 智能体角色定义 */
export interface AgentRole {
  id: string
  name: string
  avatar: string // svg icon name
  description: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  greeting: string // 首次对话欢迎语
}

/** 对话记录 */
export interface Conversation {
  id: string
  title: string
  agentId: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

/** 聊天选项（用于 AIContentGenerator.sendChatMessage） */
export interface ChatOptions {
  temperature: number
  maxTokens: number
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
}
