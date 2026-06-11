import type {
  GenerateOptions,
  ReviewResult,
  SkillItem,
} from "@/types/ai"
import type { AiApiConfig } from "@/utils/aiApi"
/**
 * AI信息生成功能模块
 * 支持自定义对话配置、Markdown格式输出、上下文配置
 * API 调用逻辑已迁移至 @/utils/aiApi 统一模块
 */
import {
  Plugin,
  showMessage,
} from "siyuan"
import {
  callAI,
  callAISmart,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { createVueDockApp } from "@/utils/vueAppHelper"
import AIContentGeneratorPanel from "../index.vue"

/**
 * 从任意文本中提取 JSON 对象。
 * 支持模型返回 `{...}` 纯 JSON、markdown 代码块、或带前缀的文本。
 * 若 JSON 被截断（如 token 耗尽），尝试修复未闭合的字符串和括号。
 */
function extractJsonFromText(text: string): string | null {
  // 1. 尝试提取 markdown 代码块中的 JSON
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlock) {
    const inner = codeBlock[1].trim()
    if (inner.startsWith("{")) return inner
  }

  // 2. 直接查找第一个完整 JSON 对象（从 { 到配对的 }）
  const trimmed = text.trim()
  const firstBrace = trimmed.indexOf("{")
  if (firstBrace === -1) return null

  // 配对括号查找
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = firstBrace; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (escaped) { escaped = false; continue }
    if (ch === "\\") { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{") depth++
    if (ch === "}") {
      depth--
      if (depth === 0) return trimmed.slice(firstBrace, i + 1)
    }
  }

  // 3. JSON 被截断：尝试修复未闭合的结构
  if (depth > 0) {
    let partial = trimmed.slice(firstBrace)
    // 闭合未终止的字符串
    if (inString) partial += '"'
    // 移除末尾可能的截断片段（如半个 key/value）
    partial = partial.replace(/,\s*"[^"]*$/, "")
    // 闭合所有未闭合的括号
    for (let d = depth; d > 0; d--) partial += "}"
    try {
      JSON.parse(partial)
      return partial
    } catch {
      // 修复失败，放弃
    }
  }

  return null
}

/** 校验并规范评级值 */
function validateRating(rating: unknown): "优秀" | "良好" | "需改进" {
  const valid = ["优秀", "良好", "需改进"]
  if (typeof rating === "string" && valid.includes(rating)) return rating as any
  return "良好"
}

/**
 * AI内容生成类
 * 仅负责 Dock 注册和 UI 编排，API 调用使用统一模块
 */
export class AIContentGenerator {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 获取最新的 API 配置（每次调用时动态读取，确保用户修改设置后立即生效）
   */
  private getApiConfig(): AiApiConfig {
    return getApiConfigFromPlugin(this.plugin)
  }

  /**
   * 初始化AI内容生成功能
   */
  public init() {
    this.addDock()
  }

  /**
   * 添加AI内容生成 Dock 到右侧边栏
   */
  private addDock() {
    createVueDockApp(this.plugin, AIContentGeneratorPanel, {
      position: "RightTop",
      width: 400,
      icon: "iconSparkles",
      title: "AI信息生成",
      type: "ai-content-generator-dock",
      i18n: this.plugin.i18n,
      extraProps: {
        onGenerate: async (options: GenerateOptions) => {
          return await this.generateContent(options)
        },
        onReview: async (
          userRequest: string,
          generatedContent: string,
          skill?: SkillItem,
        ): Promise<ReviewResult> => {
          return await this.reviewContent(userRequest, generatedContent, skill)
        },
      },
    })
  }

  /**
   * 生成内容
   */
  public async generateContent(options: GenerateOptions): Promise<string> {
    if (!options.userInput) {
      showMessage("请输入内容", 3000, "error")
      return ""
    }

    try {
      const fullPrompt = this.buildFullPrompt(options)
      const apiConfig = this.getApiConfig()

      // 如果 options 指定了 model，覆盖全局配置
      if (options.model) {
        apiConfig.model = options.model
      }

      const result = await callAISmart(fullPrompt, apiConfig, {
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        signal: options.signal,
        onChunk: options.onChunk,
        onReasoningChunk: options.onReasoningChunk,
        webSearch: options.webSearch,
        searchQuery: options.searchQuery,
        onSearchStart: options.onSearchStart,
        onSearchResults: options.onSearchResults,
        onSearchError: options.onSearchError,
        enableThinking: options.enableThinking,
      })

      if (result) {
        return result
      }
      showMessage("生成失败，请重试", 3000, "error")
      return ""
    } catch (error) {
      const errorMsg = (error as Error).message || "未知错误"
      showMessage(`🚫 生成失败: ${errorMsg}`, 5000, "error")
      throw error
    }
  }

  /**
   * 构建完整的提示词
   */
  private buildFullPrompt(options: GenerateOptions): string {
    if (options.context) {
      return `${options.context}

---

用户要求:
${options.userInput}`
    }
    return options.userInput
  }

  /**
   * 交叉审核：使用 V4 Pro 模型审核生成内容
   * @param userRequest 用户原始请求
   * @param generatedContent AI 生成的内容
   * @param skill 当前选中的技能上下文（用于按技能标准审核）
   */
  public async reviewContent(userRequest: string, generatedContent: string, skill?: SkillItem): Promise<ReviewResult> {
    let reviewPrompt = `你是文档质量审核专家。请审核以下AI生成的文档并输出JSON。

## 用户需求
${userRequest.slice(0, 500)}

## 生成内容
${generatedContent.slice(0, 3000)}
`

    // 如果有选中的技能，将其作为审核标准注入
    if (skill) {
      reviewPrompt += `
## 技能要求（审核参考标准）
技能名称: ${skill.name}
技能描述: ${skill.description}
技能内容:
${skill.content.slice(0, 1000)}

请以上述技能要求作为审核的核心标准，检查生成内容是否符合该技能规范的要求。
`
    }

    reviewPrompt += `
## 输出格式（必须严格JSON，禁止任何额外文字）
{"rating":"优秀|良好|需改进","summary":"总体评价","issues":[{"description":"问题","severity":"高|中|低"}],"suggestions":["建议1"]}

审核维度：内容准确性、结构完整性、语言质量、格式规范、覆盖完整性。
${skill ? '额外维度：技能规范遵守程度。' : ''}
无问题时 issues 为空数组 rating 为优秀。`

    const apiConfig = this.getApiConfig()
    // 审核使用 deepseek-v4-pro 模型（如果 provider 是 deepseek）
    if (apiConfig.provider === "deepseek") {
      apiConfig.model = "deepseek-v4-pro"
    }

    try {
      const result = await callAI(reviewPrompt, apiConfig, {
        systemPrompt: "你只输出JSON，禁止任何解释或前缀文字。",
        temperature: 0.1,
        maxTokens: 2000,
        responseFormat: { type: "json_object" },
      })

      // 尝试从响应中提取 JSON（模型可能包裹在 markdown 或前缀文字中）
      const json = extractJsonFromText(result)
      if (json) {
        const parsed = JSON.parse(json) as Partial<ReviewResult>
        return {
          rating: validateRating(parsed.rating),
          summary: parsed.summary || "审核完成",
          issues: Array.isArray(parsed.issues) ? parsed.issues.filter((i: any) => i?.description) : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s: any) => typeof s === "string") : [],
          reviewModel: apiConfig.model,
          reviewedAt: Date.now(),
        }
      }

      // JSON 提取失败：将原始文本作为审核摘要展示
      return {
        rating: "良好",
        summary: result.trim().slice(0, 300),
        issues: [],
        suggestions: [],
        reviewModel: apiConfig.model,
        reviewedAt: Date.now(),
      }
    } catch (error) {
      console.error("审核失败:", error)
      return {
        rating: "需改进",
        summary: `审核异常: ${(error as Error).message}`,
        issues: [],
        suggestions: [],
        reviewModel: apiConfig.model || "deepseek-v4-pro",
        reviewedAt: Date.now(),
      }
    }
  }

  /**
   * 销毁功能
   */
  public destroy() {}
}

// 重新导出类型，保持向后兼容

