/**
 * 统一 AI API 模块
 * 基于 wordQuery/utils/apiBase.ts 扩展，增加流式输出支持
 * 所有功能模块统一调用此模块，消除重复的 API 调用逻辑
 */
import type {
  AiApiConfig,
  AiCallOptions,
  AiProvider,
  DeepSeekReasoningEffort,
} from "@/types/ai"

// 重新导出类型，方便外部直接从本模块导入
export type {
  AiApiConfig,
  AiCallOptions,
  DeepSeekReasoningEffort,
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
  const deepseekThinking =
    resolvedProvider === "deepseek"
    && supportsThinkingMode(model)
    && options?.enableThinking !== false

  if (deepseekThinking) {
    const reasoningEffort: DeepSeekReasoningEffort =
      (options?.reasoningEffort as DeepSeekReasoningEffort) || "high"
    return {
      model,
      messages,
      max_tokens: maxTokens,
      thinking: { type: "enabled" },
      reasoning_effort: reasoningEffort,
      ...(stream ? { stream: true } : {}),
    }
  }

  // OpenAI / DeepSeek（非思考）/ Custom 格式
  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(stream ? { stream: true } : {}),
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

/**
 * 解析通义千问 SSE 流数据
 */
async function parseTongyiStream(
  response: Response,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法读取响应流")

  const decoder = new TextDecoder("utf-8")
  let fullContent = ""
  let buffer = ""

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
        if (!line.trim() || !line.startsWith("data:")) continue

        const data = line.slice(5).trim()
        if (data === "[DONE]") continue

        try {
          const json = JSON.parse(data)
          let content = ""
          if (json.output?.choices?.[0]?.message?.content) {
            content = json.output.choices[0].message.content
          } else if (json.output?.text) {
            content = json.output.text
          }

          if (content) {
            onChunk(content)
            fullContent += content
          }
        } catch {
          // 忽略解析错误的行
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}

/**
 * 解析 OpenAI/DeepSeek SSE 流数据
 */
async function parseOpenAIStream(
  response: Response,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  onReasoningChunk?: (chunk: string) => void,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法读取响应流")

  const decoder = new TextDecoder("utf-8")
  let fullContent = ""
  let buffer = ""

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
        if (!line.trim()) continue

        let dataStr = line
        if (line.startsWith("data:")) {
          dataStr = line.slice(5).trim()
        }

        if (dataStr === "[DONE]") continue

        try {
          const json = JSON.parse(dataStr)
          const delta = json.choices?.[0]?.delta
          const reasoningContent = delta?.reasoning_content
          const content = delta?.content

          if (reasoningContent) {
            onReasoningChunk?.(reasoningContent)
          }
          if (content) {
            onChunk(content)
            fullContent += content
          }
        } catch {
          // 忽略解析错误的行
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}

// ============ 核心调用函数 ============

/**
 * 合并 config 和 options 中的 enableThinking
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
    enableThinking: config.enableThinking ?? options?.enableThinking,
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

/**
 * 公共前置逻辑：校验、参数构建、options 合并
 */
function prepareRequest(
  prompt: string,
  config: AiApiConfig,
  options?: AiCallOptions,
): PreparedRequest {
  const providerConfig = API_PROVIDERS[config.provider]
  if (!providerConfig) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = getApiUrl(config, providerConfig)

  if (!config.apiKey) {
    throw new Error("请先在超级面板中配置API密钥")
  }

  const model = config.model || providerConfig.defaultModel
  const temperature = options?.temperature ?? 0.7
  const maxTokens = options?.maxTokens ?? 800

  const messages = [
    {
      role: "system",
      content: options?.systemPrompt || "你是一个专业的AI助手。",
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
    prepareRequest(prompt, config, options)

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

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: merged?.signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

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
    prepareRequest(prompt, config, options)

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

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: merged?.signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

  // 根据 provider 类型选择不同的流解析器
  const resolvedProvider = resolveProvider(config.provider)
  if (resolvedProvider === "tongyi") {
    return parseTongyiStream(response, onChunk, merged?.signal)
  }
  return parseOpenAIStream(
    response,
    onChunk,
    merged?.signal,
    merged?.onReasoningChunk,
  )
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
  return {
    provider: settings.aiApiProvider || "tongyi",
    model,
    apiKey: settings.aiApiKey || "",
    customEndpoint: settings.aiCustomEndpoint || "",
    enableThinking: settings.aiEnableThinking ?? false,
  }
}
