/**
 * AI 内容生成管道 Composable
 * 封装流式生成、RAF 缓冲、对话历史、构建选项、执行封装
 */
import { ref, computed, type Ref, type ComputedRef } from "vue"
import { showMessage } from "siyuan"
import type { Plugin } from "siyuan"
import type { GenerateOptions, SkillItem, TargetDoc } from "@/types/ai"
import { AI_MODELS_CONFIG } from "../config/models"

// ============ 类型定义 ============

interface ConversationTurn {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

interface UseGenerationOptions {
  systemPrompt: Ref<string>
  temperature: Ref<number>
  maxTokens: Ref<number>
  enableThinking: Ref<boolean>
  webSearch: Ref<boolean>
  selectedModel: Ref<string>
  customModel: Ref<string>
  resolvedModel: ComputedRef<string>
  currentSkill: Ref<SkillItem | null>
  editTargetDoc: Ref<TargetDoc | null>
  editCustomInput: Ref<string>
  plugin: Plugin
  onGenerate: (options: GenerateOptions) => Promise<string>
  /** 生成完成后的审核回调 */
  onAfterGenerate?: () => void
}

// ============ 公共工具函数 ============

/**
 * 提取公共的 skill system prompt 构建逻辑，消除 4 处重复
 */
export function buildSkillSystemPrompt(
  skill: SkillItem | null,
  fallback: string,
): string {
  if (skill) {
    return `${skill.content}\n\n${fallback}`
  }
  return fallback
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

  // ===== 推理内容 =====
  const reasoningContent = ref("")
  const showReasoning = ref(false)
  let reasoningBuffer = ""

  // ===== 搜索 =====
  const searchStatus = ref("")
  const searchResults = ref<Array<{ title: string; url: string; content: string; score?: number }>>([])
  const showSearchResults = ref(false)

  // ===== 多轮对话 =====
  const conversationHistory = ref<ConversationTurn[]>([])
  const MAX_CONVERSATION_TURNS = 20

  // ===== 模型 =====
  const currentProvider = computed(() =>
    (opts.plugin as any)?.settings?.aiApiProvider || "tongyi",
  )
  const availableModels = computed(() => {
    return AI_MODELS_CONFIG[currentProvider.value] || { common: [], all: [] }
  })
  const supportsThinking = computed(() =>
    currentProvider.value === "deepseek"
    && (opts.selectedModel.value === "deepseek-reasoner"
      || opts.selectedModel.value.startsWith("deepseek-v4-")),
  )

  // ===== 搜索稳定回调（避免每次 buildGenerateOptions 重新创建闭包） =====
  const stableSearchStart = () => {
    searchStatus.value = "正在搜索网络..."
  }
  const stableSearchResults = (results: Array<{ title: string; url: string; content: string; score?: number }>) => {
    searchResults.value = results
    showSearchResults.value = true
    searchStatus.value = `已获取 ${results.length} 条搜索结果`
  }
  const stableSearchError = (error: string) => {
    searchStatus.value = `搜索失败: ${error}`
    showMessage(`联网搜索失败: ${error}`, 3000, "info")
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
    showReasoning.value = false
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
    showSearchResults.value = false
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
    generatedContent.value += chunk
    chunkBuffer += chunk
    if (!rafId) {
      rafId = requestAnimationFrame(flushChunkBuffer)
    }
  }

  /** 思考过程回调 */
  const defaultOnReasoningChunk = (chunk: string) => {
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
    temperature: opts.temperature.value,
    maxTokens: opts.maxTokens.value,
    signal: abortController.value?.signal,
    onChunk: defaultOnChunk,
    ...(opts.enableThinking.value ? { onReasoningChunk: defaultOnReasoningChunk } : {}),
    model: opts.resolvedModel.value || undefined,
    enableThinking: opts.enableThinking.value,
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
    skipReview = false,
  ) => {
    startGeneration()
    try {
      const options = buildOptions()
      const userInput = options.userInput
      await opts.onGenerate(options)
      addConversationTurns(userInput)
      onSuccess?.()
    } catch (error) {
      if (handleGenerationError(error as Error, context)) return
    } finally {
      resetAllGenerationStates()
      recordGenerationElapsed()
      if (!skipReview) {
        opts.onAfterGenerate?.()
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
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
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
    showSearchResults,
    conversationHistory,
    abortController,
    // computed
    currentProvider,
    availableModels,
    supportsThinking,
    // 函数
    startGeneration,
    resetAllGenerationStates,
    handleStop,
    cleanupRaf,
    buildGenerateOptions,
    executeGeneration,
    clearConversation,
    buildConversationContext,
  }
}
