/**
 * AI内容生成类
 * 仅负责 Dock 注册和 UI 编排，API 调用使用 @/utils/aiApi 统一模块
 */
import type { AiApiConfig } from "@/utils/aiApi"
import type {
  GenerateOptions,
  ReviewResult,
  SkillItem,
} from "@/types/ai"
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
 */
function extractJsonFromText(text: string): string | null {
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlock) {
    const inner = codeBlock[1].trim()
    if (inner.startsWith("{")) return inner
  }

  const trimmed = text.trim()
  const firstBrace = trimmed.indexOf("{")
  if (firstBrace === -1) return null

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

  if (depth > 0) {
    let partial = trimmed.slice(firstBrace)
    if (inString) partial += '"'
    partial = partial.replace(/,\s*"[^"]*$/, "")
    for (let d = depth; d > 0; d--) partial += "}"
    try {
      JSON.parse(partial)
      return partial
    } catch {
    }
  }

  return null
}

function validateRating(rating: unknown): "优秀" | "良好" | "需改进" {
  const valid = ["优秀", "良好", "需改进"]
  if (typeof rating === "string" && valid.includes(rating)) return rating as any
  return "良好"
}

export class AIContentGenerator {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  private getApiConfig(): AiApiConfig {
    return getApiConfigFromPlugin(this.plugin)
  }

  public init() {
    this.addDock()
  }

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

  public async generateContent(options: GenerateOptions): Promise<string> {
    if (!options.userInput) {
      showMessage("请输入内容", 3000, "error")
      return ""
    }

    try {
      const fullPrompt = this.buildFullPrompt(options)
      const apiConfig = this.getApiConfig()

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

  private buildFullPrompt(options: GenerateOptions): string {
    if (options.context) {
      return `${options.context}

---

用户要求:
${options.userInput}`
    }
    return options.userInput
  }

  public async reviewContent(userRequest: string, generatedContent: string, skill?: SkillItem): Promise<ReviewResult> {
    const skillRubric = skill ? this.buildSkillRubric(skill) : ""

    const reviewPrompt = [
      "你是专业的文档质量审核专家。请严格按以下维度审核AI生成的Markdown文档，并以JSON格式输出。",

      "## 用户需求",
      userRequest.slice(0, 500),

      "## 生成内容",
      generatedContent.slice(0, 3000),

      ...(skillRubric ? [skillRubric] : []),

      "## 评分维度（逐项打分 1-10）",
      "1. 内容准确性（accuracy）— 事实正确性、与用户需求一致",
      "2. 结构完整性（structure）— 标题层级、章节划分、逻辑流畅",
      "3. 语言质量（quality）— 清晰度、简洁度、语气一致",
      "4. 格式规范（format）— Markdown语法正确、无原始HTML、标准格式",
      "5. 覆盖完整性（coverage）— 所有必要方面已涵盖",

      "## 输出格式（严格JSON，禁止任何额外文字）",
      `{`,
      `  "rating":"优秀|良好|需改进",`,
      `  "summary":"总体评价（1-2句话）",`,
      `  "issues":[{"description":"具体问题描述","severity":"高|中|低"}],`,
      `  "suggestions":["可操作改进建议"],`,
      `  "detailedScore":{"accuracy":8,"structure":7,"quality":9,"format":8,"coverage":7}`,
      `}`,

      "规则：",
      "- 无问题时 \"issues\" 数组必须为空，\"rating\" 为\"优秀\"",
      "- 对每个问题明确标出严重程度",
      "- 只输出合法JSON，禁止markdown包裹或解释文字\n",
    ].join("\n")

    const apiConfig = this.getApiConfig()
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
          detailedScore: parsed.detailedScore,
        }
      }

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

  private buildSkillRubric(skill: SkillItem): string {
    const sections: string[] = [
      "## 技能审核标准（Rubric）",
      `技能名称: ${skill.name}`,
      `技能描述: ${skill.description}`,
      "",
      "### 逐项审核标准",
    ]

    const lines = skill.content.split("\n")
    let hasCriteria = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^#{2,3}\s/.test(trimmed)) {
        sections.push(`\n【${trimmed.replace(/^#+\s*/, "")}】`)
        hasCriteria = true
      }
      else if (/^[-*\d.]/.test(trimmed) && trimmed.length > 10) {
        sections.push(`- ${trimmed.replace(/^[-*\d.]+\s*/, "")}`)
        hasCriteria = true
      }
    }

    if (!hasCriteria) {
      sections.push("- 遵循技能核心方法论和输出格式要求")
    }

    sections.push(
      "",
      "评估要求：对以上每条标准，检查生成内容是否满足。",
      "任何未满足的标准必须列为 issue。",
    )

    return sections.join("\n")
  }

  public destroy() {}
}
