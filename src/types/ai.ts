/**
 * AI 相关的统一类型定义
 * 消除项目中多处重复的接口定义
 */

/** API 供应商类型 */
export type AiProvider = "tongyi" | "openai" | "deepseek" | "zhipu" | "xiaomi" | "custom"

/** AI API 配置接口（统一） */
export interface AiApiConfig {
  provider: AiProvider
  model: string
  apiKey: string
  customEndpoint: string
  enableThinking?: boolean
  /** 联网搜索配置（RAG 模式） */
  searchConfig?: SearchApiConfig
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
  /** 联网搜索（RAG 模式：先搜后答，所有 provider 通用） */
  webSearch?: boolean
  /** 显式搜索关键词（优先级高于自动提取） */
  searchQuery?: string
  /** 搜索开始时回调 */
  onSearchStart?: () => void
  /** 搜索结果回调（成功时返回搜索结果列表，带来源链接） */
  onSearchResults?: (results: SearchResult[]) => void
  /** 搜索失败回调（错误信息） */
  onSearchError?: (error: string) => void
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
  /** AI 模型名称（覆盖全局设置） */
  model?: string
  /** 启用思考模式（覆盖全局设置） */
  enableThinking?: boolean
  /** 思考过程回调（DeepSeek reasoning_content） */
  onReasoningChunk?: (chunk: string) => void
  /** 联网搜索（RAG 模式：先搜后答，所有 provider 通用） */
  webSearch?: boolean
  /** 显式搜索关键词（优先级高于自动提取） */
  searchQuery?: string
  /** 搜索开始时回调 */
  onSearchStart?: () => void
  /** 搜索结果回调（成功时返回搜索结果列表，带来源链接） */
  onSearchResults?: (results: SearchResult[]) => void
  /** 搜索失败回调（错误信息） */
  onSearchError?: (error: string) => void
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
  /** AI 模型名称 */
  model?: string
  /** 启用思考模式 */
  enableThinking?: boolean
  createdAt: number
}

// ============ 技能相关类型 ============

/** AI 技能来源信息 */
export interface SkillSource {
  id: string // 该来源的唯一ID（filePath）
  tool: string // 来源工具
  content: string // 该来源的内容
}

/** AI 技能展示类型（统一，消除多处重复定义） */
export interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  tool: string
  /** 去重后的来源列表（同名技能来自多个工具时） */
  sources: SkillSource[]
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
  /** 是否启用联网搜索（RAG 模式：先搜后答，所有 provider 通用） */
  webSearch?: boolean
}

// ============ 联网搜索相关类型 ============

/** 搜索引擎类型（均为国内可用） */
export type SearchProvider = "bocha" | "jina" | "searxng"

/** 搜索结果条目 */
export interface SearchResult {
  title: string
  url: string
  content: string
  score?: number
}

/** 搜索 API 配置 */
export interface SearchApiConfig {
  /** 搜索引擎供应商 */
  searchProvider: SearchProvider
  /** 博查 API Key（searchProvider 为 bocha 时必填，注册 https://open.bochaai.com 获取） */
  bochaApiKey: string
  /** SearXNG 实例地址（searchProvider 为 searxng 时必填，如 http://localhost:8080） */
  searxngUrl: string
  /** 搜索语言偏好，如 "zh-CN"、"en"、"auto"，默认 "auto" 不限制语言 */
  searchLanguage?: string
  /** 博查 freshness 参数，如 "noLimit"(默认)、"oneWeek"、"oneMonth" */
  searchFreshness?: string
  /** Jina API Key（用于 Reranker 重排序，注册 https://jina.ai 获取免费额度） */
  jinaApiKey?: string
}

// ============ 审核相关类型 ============

/** 审核结果 */
export interface ReviewResult {
  /** 质量评级：优秀/良好/需改进 */
  rating: "优秀" | "良好" | "需改进"
  /** 总体评价 */
  summary: string
  /** 问题清单 */
  issues: Array<{
    description: string
    severity: "高" | "中" | "低"
  }>
  /** 改进建议 */
  suggestions: string[]
  /** 审核模型 */
  reviewModel: string
  /** 审核时间 */
  reviewedAt: number
}
