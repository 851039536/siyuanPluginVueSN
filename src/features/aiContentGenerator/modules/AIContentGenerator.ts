/**
 * AI内容生成类
 * 仅负责 Dock 注册和 UI 编排，API 调用使用 @/utils/aiApi 统一模块
 */
import type {
  GenerateOptions,
  ReviewRating,
  ReviewResult,
  SkillItem,
} from "@/types/ai"
import type { AiApiConfig } from "@/utils/aiApi"
import type { ScanSkillsFn } from "../types"
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
 * 仅支持完整 JSON（callAI 非流式返回完整响应体，无截断场景），
 * 删除旧版"截断 JSON 修复"分支（该分支在完整 JSON 下不可达）。
 */
function extractJsonFromText(text: string): string | null {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\n?```/)
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

  return null
}

function validateRating(rating: unknown): ReviewRating {
  const valid: ReviewRating[] = ["优秀", "良好", "需改进"]
  if (typeof rating === "string" && (valid as string[]).includes(rating)) {
    return rating as ReviewRating
  }
  return "良好"
}

/** 思考截断重试时的输出预算上限 */
const RETRY_MAX_TOKENS_CAP = 65536

export class AIContentGenerator {
  private plugin: Plugin
  private scanSkills: ScanSkillsFn | null

  constructor(plugin: Plugin, options?: { scanSkills?: ScanSkillsFn }) {
    this.plugin = plugin
    this.scanSkills = options?.scanSkills ?? null
  }

  private getApiConfig(): AiApiConfig {
    return getApiConfigFromPlugin(this.plugin)
  }

  public init() {
    this.registerIcons()
    this.addDock()
  }

  /** 注册模块自定义 SVG symbol：对比图标（#iconColumns）非思源内置，需自行注入，避免 Tab 图标空白 */
  private registerIcons() {
    this.plugin.addIcons(
      `<symbol id="iconColumns" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="18" rx="1"/><rect x="13.5" y="3" width="7.5" height="18" rx="1"/></symbol>`,
    )
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
        ...(this.scanSkills ? { scanSkills: this.scanSkills } : {}),
      },
    })
  }

  /** 单次生成执行：跟踪思考是否产生输出，返回正文与思考标记 */
  private async runOnce(
    fullPrompt: string,
    apiConfig: AiApiConfig,
    options: GenerateOptions,
    maxTokens: number,
  ): Promise<{ result: string, hasReasoning: boolean }> {
    // 区分"完全无输出"与"仅思考无正文"
    // （思考模式流正常结束但无 content，是思考耗尽 max_tokens 预算的典型表现）
    let hasReasoning = false

    const result = await callAISmart(fullPrompt, apiConfig, {
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      maxTokens,
      signal: options.signal,
      onChunk: options.onChunk,
      onReasoningChunk: (chunk) => {
        hasReasoning = true
        options.onReasoningChunk?.(chunk)
      },
      webSearch: options.webSearch,
      searchQuery: options.searchQuery,
      onSearchStart: options.onSearchStart,
      onSearchResults: options.onSearchResults,
      onSearchError: options.onSearchError,
      enableThinking: options.enableThinking,
      reasoningEffort: options.reasoningEffort,
    })

    return { result, hasReasoning }
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

      const first = await this.runOnce(fullPrompt, apiConfig, options, options.maxTokens)
      if (first.result) {
        return first.result
      }

      // 有思考但无正文：思考耗尽输出预算，自动加倍预算重试一次
      if (first.hasReasoning) {
        options.onTruncationRetry?.()
        showMessage("思考被截断，正在以更大输出预算自动重试...", 3000, "info")
        // 重试前替换已可能被中止的 signal：复用已 abort 的 signal 会让重试立即失败
        if (options.signal?.aborted) {
          options.signal = undefined
        }
        const retryTokens = Math.min(options.maxTokens * 2, RETRY_MAX_TOKENS_CAP)
        const retry = await this.runOnce(fullPrompt, apiConfig, options, retryTokens)
        if (retry.result) {
          return retry.result
        }
        if (retry.hasReasoning) {
          showMessage("已扩大输出预算重试但仍被截断，请降低思考强度", 5000, "error")
          return ""
        }
      }

      showMessage("生成失败，请重试", 3000, "error")
      return ""
    } catch (error) {
      const errorMsg = (error as Error).message || "未知错误"
      showMessage(`生成失败: ${errorMsg}`, 5000, "error")
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
      "你是专业的代码/文档审核专家，请以 GitHub PR Review 的严谨风格审核以下AI生成的Markdown文档，并以JSON格式输出。",
      "请参考 Reviewer 的审查习惯，按三段式结构组织审查意见：",
      "",
      "## Summary（总体评价）",
      "类似 PR 顶部的总结评论：用 1-2 句话概括文档整体质量，给出评级。",
      "",
      "## Review Comments（逐条审查意见）",
      "类似行内评论：逐条指出发现的问题，每条必须标注严重程度（severity）并给出具体可定位的描述。",
      "",
      "## Suggestions（改进建议）",
      "给出可操作的改进方向与具体修改建议。",
      "",
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
      "6. 标题质量（titleQuality）— 标题是否准确概括内容、是否具有吸引力与信息量",

      "## 标题质量专项评估（titleQuality 评分依据）",
      "- 检查文档标题是否准确反映内容主题，是否存在标题与正文偏离",
      "- 评估标题的吸引力与信息量：是否过于宽泛、过于冗长或缺乏关键信息",
      "- 若标题不理想，必须在 suggestions 中给出更好的标题建议",

      "## 输出格式（严格JSON，禁止任何额外文字）",
      `{`,
      `  "rating":"优秀|良好|需改进",`,
      `  "summary":"总体评价（1-2句话）",`,
      `  "issues":[{"description":"具体问题描述","severity":"高|中|低"}],`,
      `  "suggestions":["可操作改进建议"],`,
      `  "detailedScore":{"accuracy":8,"structure":7,"quality":9,"format":8,"coverage":7,"titleQuality":8}`,
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
        maxTokens: 2500,
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
}
