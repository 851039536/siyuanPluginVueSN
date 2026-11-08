/**
 * AI 内容生成管道 Composable
 * 封装流式生成、RAF 缓冲、对话历史、构建选项、执行封装
 */
import { ref, computed, type Ref, type ComputedRef } from "vue"
import type { Plugin } from "siyuan"
import type { DeepSeekReasoningEffort, GenerateOptions, SearchResult } from "@/types/ai"
import { PROVIDER_MODELS, DEEPSEEK_V4_MODEL_PREFIX } from "@/config/aiModels"
import { localize } from "../utils"

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
  /** 运行时文案（状态/提示）的国际化数据源 */
  i18n: Record<string, string>
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
  /** 生成批次号：停止/新一轮生成会切换，旧批次的回调与 finally 据此失效 */
  let runCounter = 0
  let activeRunId: number | null = null

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

  /**
   * 校验已选模型是否属于当前供应商的合法集合。
   * 供应商切换（含跨会话恢复）后，旧供应商的模型名不得继续用于新供应商，
   * 否则会把 "qwen-plus" 之类的名字发给 DeepSeek 导致请求失败。
   */
  const validateModelForProvider = (provider: string, providerChanged: boolean): void => {
    const model = opts.selectedModel.value
    // 空值 = 使用供应商默认模型
    if (!model) return
    if (model === "custom") {
      // 自填模型名无法做白名单校验：换到已知供应商后回落到默认模型，避免旧供应商的模型名继续被发送
      if (providerChanged && provider !== "custom") opts.selectedModel.value = ""
      return
    }
    const models = PROVIDER_MODELS[provider]
    const allowed = [
      ...(models?.common ?? []),
      ...(models?.all ?? []),
    ]
    if (allowed.some((item) => item.value === model)) return
    // 不在合法集合内：回落到默认模型；custom 供应商没有可选清单，改为自填模式
    opts.selectedModel.value = provider === "custom" ? "custom" : ""
  }

  /** 是否已解析过供应商：首次解析无法判断"是否切换"，不据此重置自填模型 */
  let providerResolved = false
  const refreshProvider = () => {
    const next = (opts.plugin as any)?.settings?.aiApiProvider || "tongyi"
    const changed = providerResolved && next !== providerRef.value
    providerRef.value = next
    providerResolved = true
    validateModelForProvider(next, changed)
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
    searchStatus.value = localize(opts.i18n, "searchStatusSearching")
  }
  const stableSearchResults = (results: SearchResult[]) => {
    searchResults.value = results
    searchStatus.value = localize(opts.i18n, "searchStatusResults", { n: results.length })
  }
  const stableSearchError = (error: string) => {
    // 行内 searchStatus 已展示失败原因，不再额外弹 toast（避免双通道重复提示）
    searchStatus.value = localize(opts.i18n, "searchStatusError", { error })
  }

  /** 思考截断自动重试前：清空旧思考展示（重试的思考是全新流，替换展示避免重复堆叠） */
  const stableTruncationRetry = () => {
    reasoningBuffer = ""
    reasoningContent.value = ""
    showReasoning.value = true
  }

  // ===== 内部辅助 =====

  /** 开始生成：初始化状态并返回本次生成批次号 */
  const startGeneration = (): number => {
    const runId = ++runCounter
    activeRunId = runId
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
    return runId
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
      errorMessage.value = error.message || localize(opts.i18n, "generationFailedLabel", { context })
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
        generationTip.value = localize(opts.i18n, "generationTipChapters", { n: headingCount })
      } else if (streamingInCodeBlock) {
        generationTip.value = localize(opts.i18n, "generationTipCodeBlock")
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
  ): GenerateOptions => {
    // 绑定当前生成批次：旧批次迟到的流式/搜索回调不得写入新一批状态
    const runId = activeRunId
    const isActiveRun = () => runId !== null && runId === activeRunId

    return {
      userInput,
      systemPrompt,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: opts.enableThinking.value ? THINKING_MAX_TOKENS : DEFAULT_MAX_TOKENS,
      signal: abortController.value?.signal,
      onChunk: (chunk) => {
        if (!isActiveRun()) return
        defaultOnChunk(chunk)
      },
      ...(opts.enableThinking.value
        ? {
            onReasoningChunk: (chunk: string) => {
              if (!isActiveRun()) return
              defaultOnReasoningChunk(chunk)
            },
            onTruncationRetry: () => {
              if (!isActiveRun()) return
              stableTruncationRetry()
            },
          }
        : {}),
      model: opts.resolvedModel.value || undefined,
      enableThinking: opts.enableThinking.value,
      reasoningEffort: opts.reasoningEffort.value,
      webSearch: opts.webSearch.value,
      ...(searchQueryOverride ? { searchQuery: searchQueryOverride } : {}),
      onSearchStart: () => {
        if (!isActiveRun()) return
        stableSearchStart()
      },
      onSearchResults: (results) => {
        if (!isActiveRun()) return
        stableSearchResults(results)
      },
      onSearchError: (error) => {
        if (!isActiveRun()) return
        stableSearchError(error)
      },
      ...(conversationHistory.value.length > 0
        ? { context: buildConversationContext() }
        : {}),
    }
  }

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
    const runId = startGeneration()
    const isActiveRun = () => runId === activeRunId
    try {
      const options = buildOptions()
      const userInput = options.userInput
      const result = await opts.onGenerate(options)
      // 已被"停止"或新一轮生成取代：旧请求不得再写入任何共享状态
      if (!isActiveRun()) return
      // 用户主动停止（signal 中止）时流可能已返回部分内容：
      // 视为失败，不把半截内容写入对话历史、不触发审核
      if (options.signal?.aborted) {
        failed = true
        return
      }
      // 空结果视为失败：不触发成功回调（输入不清空）、不写入对话历史、不自动审核
      if (!result.trim()) {
        failed = true
        return
      }
      addConversationTurns(userInput)
      onSuccess?.()
    } catch (error) {
      // 中止/失败均标记 failed，避免对残缺内容触发审核
      failed = true
      // 旧请求的异常不得污染新一轮生成的状态
      if (!isActiveRun()) return
      if (handleGenerationError(error as Error, context)) return
    } finally {
      // 仅当前有效批次可重置共享状态：停止后旧请求的 finally 不得清掉新请求状态
      if (isActiveRun()) {
        activeRunId = null
        resetAllGenerationStates()
        recordGenerationElapsed()
        if (!failed && !skipReview) {
          opts.onAfterGenerate?.(reviewUserRequest)
        }
      }
    }
  }

  /** 停止生成 */
  const handleStop = () => {
    if (abortController.value) {
      abortController.value.abort()
    }
    // 使旧批次立即失效：其后续回调与 finally 不再改动新一轮生成的状态
    activeRunId = null
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
