/**
 * AI 内容生成管道 Composable
 * 封装流式生成、RAF 缓冲、对话历史、构建选项、执行封装
 */
import { ref, computed, type Ref, type ComputedRef } from "vue"
import { showMessage } from "siyuan"
import type { Plugin } from "siyuan"
import type { DeepSeekReasoningEffort, GenerateOptions, SearchResult, SkillItem, TargetDoc } from "@/types/ai"
import { PROVIDER_MODELS, DEEPSEEK_V4_MODEL_PREFIX } from "@/config/aiModels"

// ============ 类型定义 ============

interface ConversationTurn {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

/** 硬编码的默认生成参数 */
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 10000
/**
 * 思考模式专用输出预算：思考 token 与正文 token 共用 max_tokens，
 * 思考强度 high/max 时 10000 预算会被思考耗尽导致无正文。
 * 仅思考模式使用（思考开关限 deepseek-v4-*，该系列支持大预算，不影响其他供应商）
 */
const THINKING_MAX_TOKENS = 32000

interface UseGenerationOptions {
  enableThinking: Ref<boolean>
  reasoningEffort: Ref<DeepSeekReasoningEffort>
  webSearch: Ref<boolean>
  selectedModel: Ref<string>
  customModel: Ref<string>
  resolvedModel: ComputedRef<string>
  currentSkill: Ref<SkillItem | null>
  editTargetDoc: Ref<TargetDoc | null>
  editCustomInput: Ref<string>
  plugin: Plugin
  onGenerate: (options: GenerateOptions) => Promise<string>
  /** 生成完成后的审核回调（携带本次用户真实指令，供审核阶段理解需求） */
  onAfterGenerate?: (reviewUserRequest?: string) => void
}

/** executeGeneration 附加选项 */
export interface ExecuteGenerationOptions {
  /** 跳过自动审核（如自动修复内部循环） */
  skipReview?: boolean
  /** 本次用户真实指令（审核阶段优先使用，避免被 onSuccess 清空的输入兜底） */
  reviewUserRequest?: string
}

// ============ Composable ============

export function useGeneration(opts: UseGenerationOptions) {
  // ===== 生成状态 =====
  const generatedContent = ref("")   // 实时完整内容（逐 chunk 即时更新）
  const displayedContent = ref("")   // 打字机效果缓存（RAF 节流更新，用于渲染）
  const isGenerating = ref(false)
  const errorMessage = ref("")
  const generationElapsed = ref("")
  const generationTip = ref("")
  let generationStartTime: number | null = null
  const abortController = ref<AbortController | null>(null)

  // ===== 流式缓冲 =====
  let chunkBuffer = ""
  let rafId: number | null = null
  let streamingInCodeBlock = false
  let headingCount = 0
  /** 组件卸载后禁止再调度 RAF（cleanupRaf 与 handleStop 竞态时防回调重新排队） */
  let disposed = false

  // ===== 推理内容 =====
  const reasoningContent = ref("")
  const showReasoning = ref(false)
  let reasoningBuffer = ""

  // ===== 搜索 =====
  const searchStatus = ref("")
  const searchResults = ref<SearchResult[]>([])

  // ===== 多轮对话 =====
  const conversationHistory = ref<ConversationTurn[]>([])
  const MAX_CONVERSATION_TURNS = 20

  // ===== 模型 =====
  // 供应商以 ref 承载：plugin.settings 为非响应式对象，直接 computed 会在首评后永久缓存
  // （settings 异步加载，Dock 挂载时通常未就绪），须由调用方显式调用 refreshProvider() 驱动刷新
  const providerRef = ref<string>("tongyi")
  const refreshProvider = () => {
    providerRef.value = (opts.plugin as any)?.settings?.aiApiProvider || "tongyi"
  }
  const availableModels = computed(() => {
    return PROVIDER_MODELS[providerRef.value] || { common: [], all: [] }
  })
  const supportsThinking = computed(() =>
    providerRef.value === "deepseek"
    && opts.selectedModel.value.startsWith(DEEPSEEK_V4_MODEL_PREFIX),
  )

  // ===== 搜索稳定回调（避免每次 buildGenerateOptions 重新创建闭包） =====
  const stableSearchStart = () => {
    searchStatus.value = "正在搜索网络..."
  }
  const stableSearchResults = (results: SearchResult[]) => {
    searchResults.value = results
    searchStatus.value = `已获取 ${results.length} 条搜索结果`
  }
  const stableSearchError = (error: string) => {
    searchStatus.value = `搜索失败: ${error}`
    showMessage(`联网搜索失败: ${error}`, 3000, "info")
  }

  /** 思考截断自动重试前：清空旧思考展示（重试的思考是全新流，替换展示避免重复堆叠） */
  const stableTruncationRetry = () => {
    reasoningBuffer = ""
    reasoningContent.value = ""
    showReasoning.value = true
  }

  // ===== 内部辅助 =====

  /** 开始生成：初始化状态 */
  const startGeneration = () => {
    generationStartTime = performance.now()
    generationElapsed.value = ""
    abortController.value = new AbortController()
    isGenerating.value = true
    generatedContent.value = ""
    displayedContent.value = ""
    reasoningContent.value = ""
    showReasoning.value = true
    chunkBuffer = ""
    reasoningBuffer = ""
    streamingInCodeBlock = false
    headingCount = 0
    generationTip.value = ""
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    errorMessage.value = ""
    searchStatus.value = ""
    searchResults.value = []
  }

  /** 重置生成相关状态（生成结束后调用） */
  const resetAllGenerationStates = () => {
    isGenerating.value = false
    abortController.value = null
  }

  /** 记录生成耗时并格式化显示 */
  const recordGenerationElapsed = () => {
    if (generationStartTime === null) return
    const elapsed = performance.now() - generationStartTime
    if (elapsed >= 1000) {
      generationElapsed.value = `${(elapsed / 1000).toFixed(1)}s`
    } else {
      generationElapsed.value = `${Math.round(elapsed)}ms`
    }
    generationStartTime = null
  }

  /** 处理生成错误，返回 true 表示用户取消 */
  const handleGenerationError = (
    error: Error,
    context: string,
    skipMessage = false,
  ): boolean => {
    if (error.name === "AbortError") return true
    console.error(`${context}失败:`, error)
    if (!skipMessage) {
      errorMessage.value = error.message || `${context}失败`
    }
    return false
  }

  /** RAF 刷新缓冲区 */
  const flushChunkBuffer = () => {
    if (chunkBuffer) {
      let codeBlockToggle = 0
      for (let i = 0; i < chunkBuffer.length; i++) {
        if (chunkBuffer.slice(i, i + 3) === "```") codeBlockToggle++
      }
      if (codeBlockToggle % 2 !== 0) {
        streamingInCodeBlock = !streamingInCodeBlock
      }
      const headingMatches = chunkBuffer.match(/^#{1,6}\s/gm)
      if (headingMatches) headingCount += headingMatches.length

      if (headingCount >= 2) {
        generationTip.value = `已生成 ${headingCount} 个章节`
      } else if (streamingInCodeBlock) {
        generationTip.value = "正在生成代码块..."
      } else {
        generationTip.value = ""
      }

      displayedContent.value += chunkBuffer
      chunkBuffer = ""
    }
    if (reasoningBuffer) {
      reasoningContent.value += reasoningBuffer
      reasoningBuffer = ""
    }
    rafId = null
  }

  /** 默认流式输出回调（即时更新 generatedContent，RAF 节流更新 displayedContent） */
  const defaultOnChunk = (chunk: string) => {
    if (disposed) return
    generatedContent.value += chunk
    chunkBuffer += chunk
    if (!rafId) {
      rafId = requestAnimationFrame(flushChunkBuffer)
    }
  }

  /** 思考过程回调 */
  const defaultOnReasoningChunk = (chunk: string) => {
    if (disposed) return
    reasoningBuffer += chunk
    if (!rafId) {
      rafId = requestAnimationFrame(flushChunkBuffer)
    }
  }

  // ===== 对话历史 =====

  const buildConversationContext = (): string => {
    if (conversationHistory.value.length === 0) return ""
    return conversationHistory.value
      .map((turn) => `[${turn.role === "user" ? "用户" : "助手"}]: ${turn.content}`)
      .join("\n\n")
  }

  /** 原子化添加对话轮次 */
  const addConversationTurns = (userInput: string) => {
    if (!generatedContent.value) return
    conversationHistory.value.push({
      role: "user",
      content: userInput.length > 500 ? userInput.slice(0, 500) + "..." : userInput,
      timestamp: Date.now(),
    })
    conversationHistory.value.push({
      role: "assistant",
      content: generatedContent.value.length > 300
        ? generatedContent.value.slice(0, 300) + "..."
        : generatedContent.value,
      timestamp: Date.now(),
    })
    if (conversationHistory.value.length > MAX_CONVERSATION_TURNS * 2) {
      conversationHistory.value = conversationHistory.value.slice(-MAX_CONVERSATION_TURNS * 2)
    }
  }

  const clearConversation = () => {
    conversationHistory.value = []
  }

  // ===== 选项构建 =====

  /** 构建 API 调用选项（稳定闭包引用） */
  const buildGenerateOptions = (
    userInput: string,
    systemPrompt: string,
    searchQueryOverride?: string,
  ): GenerateOptions => ({
    userInput,
    systemPrompt,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: opts.enableThinking.value ? THINKING_MAX_TOKENS : DEFAULT_MAX_TOKENS,
    signal: abortController.value?.signal,
    onChunk: defaultOnChunk,
    ...(opts.enableThinking.value
      ? { onReasoningChunk: defaultOnReasoningChunk, onTruncationRetry: stableTruncationRetry }
      : {}),
    model: opts.resolvedModel.value || undefined,
    enableThinking: opts.enableThinking.value,
    reasoningEffort: opts.reasoningEffort.value,
    webSearch: opts.webSearch.value,
    ...(searchQueryOverride ? { searchQuery: searchQueryOverride } : {}),
    onSearchStart: stableSearchStart,
    onSearchResults: stableSearchResults,
    onSearchError: stableSearchError,
    ...(conversationHistory.value.length > 0
      ? { context: buildConversationContext() }
      : {}),
  })

  // ===== 执行封装 =====

  const executeGeneration = async (
    context: string,
    buildOptions: () => GenerateOptions,
    onSuccess?: () => void,
    execOptions: ExecuteGenerationOptions = {},
  ) => {
    // 防重入：生成进行中忽略新的生成请求（Ctrl+Enter/连点快捷操作可绕过按钮禁用）
    if (isGenerating.value) return

    const { skipReview = false, reviewUserRequest } = execOptions
    let failed = false
    startGeneration()
    try {
      const options = buildOptions()
      const userInput = options.userInput
      await opts.onGenerate(options)
      // 用户主动停止（signal 中止）时流可能已返回部分内容：
      // 视为失败，不把半截内容写入对话历史、不触发审核
      if (options.signal?.aborted) {
        failed = true
        return
      }
      addConversationTurns(userInput)
      onSuccess?.()
    } catch (error) {
      // 中止/失败均标记 failed，避免对残缺内容触发审核
      failed = true
      if (handleGenerationError(error as Error, context)) return
    } finally {
      resetAllGenerationStates()
      recordGenerationElapsed()
      if (!failed && !skipReview) {
        opts.onAfterGenerate?.(reviewUserRequest)
      }
    }
  }

  /** 停止生成 */
  const handleStop = () => {
    if (abortController.value) {
      abortController.value.abort()
    }
    resetAllGenerationStates()
    generationElapsed.value = ""
    generationStartTime = null
  }

  /** 清理 RAF（供 onUnmounted 调用） */
  const cleanupRaf = () => {
    disposed = true
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  /** 清除生成展示态（推理/搜索/提示），供"清除"按钮组合调用，避免残留区块渲染 */
  const clearDisplayState = () => {
    reasoningContent.value = ""
    showReasoning.value = false
    searchStatus.value = ""
    searchResults.value = []
    generationTip.value = ""
    reasoningBuffer = ""
  }

  return {
    // 状态
    generatedContent,
    displayedContent,
    isGenerating,
    errorMessage,
    generationElapsed,
    generationTip,
    reasoningContent,
    showReasoning,
    searchStatus,
    searchResults,
    conversationHistory,
    // computed
    availableModels,
    supportsThinking,
    // 函数
    handleStop,
    cleanupRaf,
    buildGenerateOptions,
    executeGeneration,
    clearConversation,
    refreshProvider,
    clearDisplayState,
  }
}
