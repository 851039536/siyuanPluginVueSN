/**
 * 统一 AI API 模块
 * 基于 wordQuery/utils/apiBase.ts 扩展，增加流式输出支持
 * 所有功能模块统一调用此模块，消除重复的 API 调用逻辑
 *
 * 联网搜索采用 RAG 模式：先搜后答
 * 用户开启 webSearch → 调用搜索 API 获取真实数据 → 注入 system prompt → LLM 基于真实数据回答
 */
import type {
  AiApiConfig,
  AiCallOptions,
  AiProvider,
  DeepSeekReasoningEffort,
  SearchApiConfig,
} from "@/types/ai"
import {
  formatSearchResults,
  rerankResults,
  searchWeb,
} from "@/utils/webSearch"

// 重新导出类型，方便外部直接从本模块导入
export type {
  AiApiConfig,
  AiCallOptions,
  DeepSeekReasoningEffort,
  SearchApiConfig,
} from "@/types/ai"

// ============ Provider 配置 ============

interface ProviderConfig {
  url: string
  defaultModel: string
}

const API_PROVIDERS: Record<AiProvider, ProviderConfig> = {
  tongyi: {
    url: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    defaultModel: "qwen-plus",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-3.5-turbo",
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    defaultModel: "deepseek-v4-flash",
  },
  zhipu: {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4-flash",
  },
  xiaomi: {
    url: "https://api.xiaomimimo.com/v1/chat/completions",
    defaultModel: "mimo-v2-flash",
  },
  custom: {
    url: "",
    defaultModel: "default",
  },
}

// ============ 工具函数 ============

/**
 * 从 API 响应中提取文本内容（统一响应解析）
 */
export function extractResponseText(data: any): string {
  const possiblePaths = [
    () => data.output?.text,
    () => data.output?.choices?.[0]?.message?.content,
    () => data.choices?.[0]?.message?.content,
    () => data.text,
    () => data.content,
    // DeepSeek 思考模式：content 可能为空，此时取 reasoning_content
    () => data.choices?.[0]?.message?.reasoning_content,
  ]

  for (const getText of possiblePaths) {
    const text = getText()
    if (text) return text
  }

  throw new Error("API返回数据格式错误")
}

/**
 * 获取解析后的 provider key（custom 映射到 openai 格式）
 */
function resolveProvider(provider: AiProvider): AiProvider {
  return provider === "custom" ? "openai" : provider
}

/**
 * 判断模型是否支持思考模式（V4 系列均支持）
 */
function supportsThinkingMode(model: string): boolean {
  return (
    model === "deepseek-reasoner"
    || model.startsWith("deepseek-v4-")
  )
}

/**
 * 获取 API URL
 */
function getApiUrl(config: AiApiConfig, providerConfig: ProviderConfig): string {
  const url =
    config.provider === "custom" ? config.customEndpoint : providerConfig.url
  if (!url) {
    throw new Error("API端点未设置")
  }
  return url
}

/**
 * 构建请求体（区分通义和 OpenAI 格式）
 */
function buildRequestBody(
  provider: AiProvider,
  model: string,
  messages: Array<{ role: string, content: string }>,
  temperature: number,
  maxTokens: number,
  stream: boolean = false,
  options?: AiCallOptions,
): any {
  const resolvedProvider = resolveProvider(provider)

  if (resolvedProvider === "tongyi") {
    return {
      model,
      input: { messages },
      parameters: {
        temperature,
        top_p: 0.8,
        max_tokens: maxTokens,
        ...(stream
          ? {
              incremental_output: true,
              result_format: "message",
            }
          : {}),
      },
    }
  }

  // DeepSeek 思考模式处理
  const isDeepSeek = resolvedProvider === "deepseek" && supportsThinkingMode(model)

  // OpenAI / DeepSeek / Custom 共用字段
  const common: any = {
    model,
    messages,
    max_tokens: maxTokens,
    ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
    ...(stream ? { stream: true } : {}),
  }

  if (isDeepSeek) {
    if (options?.enableThinking !== false) {
      const reasoningEffort: DeepSeekReasoningEffort =
        (options?.reasoningEffort as DeepSeekReasoningEffort) || "high"
      // 思考模式下 DeepSeek 不接受 temperature，故不传
      return {
        ...common,
        thinking: { type: "enabled" },
        reasoning_effort: reasoningEffort,
      }
    }
    // 思考模式已显式禁用 → 必须传 thinking: disabled，
    // 否则 DeepSeek API 仍默认开启思考（ref: api-docs.deepseek.com）
    return {
      ...common,
      temperature,
      thinking: { type: "disabled" },
    }
  }

  // OpenAI / DeepSeek（非思考模型）/ Custom 格式
  return {
    ...common,
    temperature,
  }
}

/**
 * 构建请求头
 */
function buildHeaders(
  apiKey: string,
  provider: AiProvider,
  stream: boolean = false,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  }

  // 通义千问流式需要 SSE header
  if (stream && resolveProvider(provider) === "tongyi") {
    headers["X-DashScope-SSE"] = "enable"
  }

  return headers
}

// ============ 流式解析 ============

/** 单行 SSE 数据解析后提取出的内容片段 */
interface StreamDelta {
  content?: string
  reasoning?: string
}

/**
 * 通义千问 SSE delta 提取
 */
function extractTongyiDelta(json: any): StreamDelta {
  if (json.output?.choices?.[0]?.message?.content) {
    return { content: json.output.choices[0].message.content }
  }
  if (json.output?.text) {
    return { content: json.output.text }
  }
  return {}
}

/**
 * OpenAI/DeepSeek SSE delta 提取
 */
function extractOpenAIDelta(json: any): StreamDelta {
  const delta = json.choices?.[0]?.delta
  return {
    content: delta?.content,
    reasoning: delta?.reasoning_content,
  }
}

/**
 * 通用 SSE 流解析：逐行迭代脚手架 + provider 特定的 delta 提取
 * - try 仅包住 JSON.parse，解析失败的行忽略；onChunk/onReasoningChunk 回调异常
 *   照常向上抛出，避免正文 chunk 被当作"解析失败"静默丢弃
 * - 提前退出/异常路径先 cancel 底层流，避免未消费的响应体保持连接与缓冲
 */
async function parseSSEStream(
  response: Response,
  extract: (json: any) => StreamDelta,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  onReasoningChunk?: (chunk: string) => void,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法读取响应流")

  const decoder = new TextDecoder("utf-8")
  let fullContent = ""
  let buffer = ""

  const handleLine = (line: string) => {
    if (!line.trim()) return

    let dataStr = line
    if (line.startsWith("data:")) {
      dataStr = line.slice(5).trim()
    }
    if (dataStr === "[DONE]") return

    // try 仅包住 JSON 解析：非 JSON 行（如通义的 event:/id: 行）忽略
    let json: any
    try {
      json = JSON.parse(dataStr)
    } catch {
      return
    }

    const {
      content,
      reasoning,
    } = extract(json)
    if (reasoning) {
      onReasoningChunk?.(reasoning)
    }
    if (content) {
      onChunk(content)
      fullContent += content
    }
  }

  try {
    while (true) {
      if (signal?.aborted) break

      const {
        done,
        value,
      } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        handleLine(line)
      }
    }
    // flush 尾部残留：服务端最后一个事件可能不以换行收尾
    buffer += decoder.decode()
    if (buffer) {
      handleLine(buffer)
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // 忽略 cancel 异常
    }
    reader.releaseLock()
  }

  return fullContent
}

/**
 * 按 provider 选择 delta 提取器并解析流（消除多处重复的分支选择）
 */
function parseStreamByProvider(
  provider: AiProvider,
  response: Response,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  onReasoningChunk?: (chunk: string) => void,
): Promise<string> {
  const extract =
    resolveProvider(provider) === "tongyi"
      ? extractTongyiDelta
      : extractOpenAIDelta
  return parseSSEStream(response, extract, onChunk, signal, onReasoningChunk)
}

/**
 * 统一 POST JSON 请求并校验响应状态
 */
async function postJson(
  apiUrl: string,
  headers: Record<string, string>,
  requestBody: any,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

  return response
}

// ============ 核心调用函数 ============

/**
 * 合并 config 和 options 中的 enableThinking
 * 优先级：单次调用的 options.enableThinking > 全局 config.enableThinking
 * （符合 GenerateOptions “覆盖全局设置”的契约）
 */
function mergeOptions(
  config: AiApiConfig,
  options?: AiCallOptions,
): AiCallOptions | undefined {
  if (options === undefined && config.enableThinking === undefined) {
    return options
  }
  return {
    ...options,
    enableThinking: options?.enableThinking ?? config.enableThinking,
  }
}

/** prepareRequest 返回值 */
interface PreparedRequest {
  apiUrl: string
  model: string
  messages: Array<{ role: string, content: string }>
  temperature: number
  maxTokens: number
  merged: AiCallOptions | undefined
}

/** 基础参数（provider 校验、URL、model、温度、maxTokens） */
interface BaseParams {
  apiUrl: string
  model: string
  temperature: number
  maxTokens: number
}

/**
 * 解析基础调用参数：provider 校验 + apiKey 校验 + 默认值
 * 被 prepareRequest 与 callChatStream 共用，消除重复的前置逻辑
 */
function resolveBaseParams(
  config: AiApiConfig,
  options?: Pick<AiCallOptions, "temperature" | "maxTokens">,
): BaseParams {
  const providerConfig = API_PROVIDERS[config.provider]
  if (!providerConfig) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = getApiUrl(config, providerConfig)

  if (!config.apiKey) {
    throw new Error("请先在超级面板中配置API密钥")
  }

  return {
    apiUrl,
    model: config.model || providerConfig.defaultModel,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 800,
  }
}

/**
 * 公共前置逻辑：校验、参数构建、options 合并
 * 当 options.webSearch 为 true 时，先调用搜索 API 获取真实数据（RAG），
 * 再将搜索结果注入 system prompt，让 LLM 基于真实数据回答
 */
async function prepareRequest(
  prompt: string,
  config: AiApiConfig,
  options?: AiCallOptions,
): Promise<PreparedRequest> {
  const {
    apiUrl,
    model,
    temperature,
    maxTokens,
  } = resolveBaseParams(config, options)

  // ============ RAG 联网搜索：先搜后答 ============
  let searchContext = ""
  if (options?.webSearch && config.searchConfig) {
    options?.onSearchStart?.()
    try {
      const rawQuery = options?.searchQuery || extractSearchQuery(prompt)
      const searchQuery = rawQuery.length <= 50
        ? `"${rawQuery.replace(/"/g, "")}"`
        : rawQuery
      const rawResults = await searchWeb(searchQuery, config.searchConfig)
      // 通知 UI 原始搜索结果
      options?.onSearchResults?.(rawResults)
      // 语义重排序 + 低分截断（Perplexica 同款方案）
      const ranked = await rerankResults(
        searchQuery,
        rawResults,
        config.searchConfig.jinaApiKey,
      )
      searchContext = formatSearchResults(ranked)
    } catch (error) {
      const errorMsg = (error as Error).message
      console.warn("联网搜索失败，将不带搜索结果继续生成:", error)
      options?.onSearchError?.(errorMsg)
      searchContext = `\n[注意：联网搜索失败 - ${errorMsg}，以下回答可能不包含最新信息]`
    }
  }

  // 构建系统提示词
  let systemContent = options?.systemPrompt || "你是一个专业的AI助手。"
  if (searchContext) {
    systemContent += `\n\n${searchContext}`
  }

  const messages = [
    {
      role: "system",
      content: systemContent,
    },
    {
      role: "user",
      content: prompt,
    },
  ]

  const merged = mergeOptions(config, options)

  return {
    apiUrl,
    model,
    messages,
    temperature,
    maxTokens,
    merged,
  }
}

/**
 * 从用户提示词中提取搜索关键词
 * 如果提示词过长，截取关键部分以获得更好的搜索效果
 */
function extractSearchQuery(prompt: string): string {
  // 去掉 markdown 格式内容和过长文本，保留核心意图
  const cleaned = prompt
    .replace(/```[\s\S]*?```/g, "") // 去掉代码块
    .replace(/^#{1,6}\s/gm, "") // 去掉标题标记（仅行首 #，避免误删 C#、F# 等）
    .replace(/\*\*|__/g, "") // 去掉加粗标记
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接只保留文本
    .trim()

  // 搜索 query 不宜过长，截取前 200 字
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
}

/**
 * 统一 AI API 调用（非流式）
 */
export async function callAI(
  prompt: string,
  config: AiApiConfig,
  options?: AiCallOptions,
): Promise<string> {
  const {
    apiUrl,
    model,
    messages,
    temperature,
    maxTokens,
    merged,
  } =
    await prepareRequest(prompt, config, options)

  const requestBody = buildRequestBody(
    config.provider,
    model,
    messages,
    temperature,
    maxTokens,
    false,
    merged,
  )

  const headers = buildHeaders(config.apiKey, config.provider)

  const response = await postJson(apiUrl, headers, requestBody, merged?.signal)

  const data = await response.json()
  return extractResponseText(data)
}

/**
 * 统一 AI API 调用（流式输出）
 */
export async function callAIStream(
  prompt: string,
  config: AiApiConfig,
  onChunk: (chunk: string) => void,
  options?: Omit<AiCallOptions, "onChunk">,
): Promise<string> {
  const {
    apiUrl,
    model,
    messages,
    temperature,
    maxTokens,
    merged,
  } =
    await prepareRequest(prompt, config, options)

  const requestBody = buildRequestBody(
    config.provider,
    model,
    messages,
    temperature,
    maxTokens,
    true, // stream
    merged,
  )

  const headers = buildHeaders(config.apiKey, config.provider, true)

  const response = await postJson(apiUrl, headers, requestBody, merged?.signal)

  return parseStreamByProvider(
    config.provider,
    response,
    onChunk,
    merged?.signal,
    merged?.onReasoningChunk,
  )
}

/**
 * 多轮对话 AI API 调用（接收完整 messages 数组）
 * 适合智能体问答等需要传递对话历史的场景
 * 注：不走 prepareRequest，不支持 webSearch/systemPrompt（已由类型收窄排除）
 */
async function callChatStream(
  messages: Array<{ role: string, content: string }>,
  config: AiApiConfig,
  onChunk?: ((chunk: string) => void) | undefined,
  options?: Omit<AiCallOptions, "onChunk" | "systemPrompt" | "webSearch" | "searchQuery" | "onSearchStart" | "onSearchResults" | "onSearchError">,
): Promise<string> {
  const {
    apiUrl,
    model,
    temperature,
    maxTokens,
  } = resolveBaseParams(config, options)

  const isStream = !!onChunk
  const merged = mergeOptions(config, options)

  const requestBody = buildRequestBody(
    config.provider,
    model,
    messages,
    temperature,
    maxTokens,
    isStream,
    merged,
  )

  const headers = buildHeaders(config.apiKey, config.provider, isStream)

  const response = await postJson(apiUrl, headers, requestBody, merged?.signal)

  if (isStream) {
    return parseStreamByProvider(
      config.provider,
      response,
      onChunk!,
      merged?.signal,
      merged?.onReasoningChunk,
    )
  }

  const data = await response.json()
  return extractResponseText(data)
}

/**
 * 多轮对话 AI API 调用（接收完整 messages 数组）
 * 适合智能体问答等需要传递对话历史的场景
 * 注：systemPrompt 应直接作为 messages[0] 传入；webSearch 系列选项不适用（已由类型排除）
 */
export async function callAIChat(
  messages: Array<{ role: string, content: string }>,
  config: AiApiConfig,
  options?: Omit<AiCallOptions, "systemPrompt" | "webSearch" | "searchQuery" | "onSearchStart" | "onSearchResults" | "onSearchError">,
): Promise<string> {
  if (options?.onChunk) {
    const {
      onChunk,
      ...rest
    } = options
    return callChatStream(messages, config, onChunk, rest)
  }
  return callChatStream(messages, config, undefined, options)
}

/**
 * 智能调用 AI API：有 onChunk 回调时使用流式，否则使用非流式
 */
export async function callAISmart(
  prompt: string,
  config: AiApiConfig,
  options?: AiCallOptions,
): Promise<string> {
  if (options?.onChunk) {
    const {
      onChunk,
      ...streamOptions
    } = options
    return callAIStream(prompt, config, onChunk, streamOptions)
  }
  return callAI(prompt, config, options)
}

/**
 * 从插件实例获取 AI API 配置
 */
export function getApiConfigFromPlugin(plugin: any): AiApiConfig {
  const settings = plugin?.settings || {}
  const rawModel = settings.aiModel || "qwen-plus"
  // 解析实际模型名称：如果选择的是"自定义模型"，使用用户输入的 customModel
  const model =
    rawModel === "custom"
      ? settings.aiCustomModel || "qwen-plus"
      : rawModel

  // 构建搜索配置
  const searchProvider = settings.searchProvider || "jina"
  const searchConfig: SearchApiConfig = {
    searchProvider: searchProvider as SearchApiConfig["searchProvider"],
    bochaApiKey: settings.searchBochaApiKey || "",
    searxngUrl: settings.searchSearxngUrl || "",
    searchLanguage: settings.searchLanguage || "auto",
    searchFreshness: settings.searchFreshness || "noLimit",
    jinaApiKey: settings.searchJinaApiKey || "",
  }

  // 先解析 provider（带默认值），再据此查找 apiKey，
  // 避免 aiApiProvider 未设置时 aiApiKeys[undefined] 取不到已配置的 key
  const provider: AiProvider = settings.aiApiProvider || "tongyi"

  return {
    provider,
    model,
    apiKey: settings.aiApiKeys?.[provider] || settings.aiApiKey || "",
    customEndpoint: settings.aiCustomEndpoint || "",
    enableThinking: settings.aiEnableThinking ?? false,
    searchConfig,
  }
}
