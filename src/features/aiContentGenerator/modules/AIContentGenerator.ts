/**
 * AI内容生成类
 * 仅负责 Dock 注册和 UI 编排，API 调用使用 @/utils/aiApi 统一模块
 */
import type {
  GenerateOptions,
  IssueSeverity,
  ReviewRating,
  ReviewResult,
  SkillItem,
} from "@/types/ai"
import type { AiApiConfig } from "@/utils/aiApi"
import { RATING_NEEDS_FIX, RATING_VALUES, SEVERITY_LEVELS } from "../types"
import { DEEPSEEK_V4_PRO } from "@/config/aiModels"
import {
  Plugin,
  showMessage,
} from "siyuan"
import { isAbortError } from "@/utils/abortSignal"
import {
  callAI,
  callAISmart,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { createVueDockApp } from "@/utils/vueAppHelper"
import AIContentGeneratorPanel from "../index.vue"
import { localize } from "../utils"

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

function validateRating(rating: unknown): ReviewRating | undefined {
  if (typeof rating === "string" && (RATING_VALUES as readonly string[]).includes(rating)) {
    return rating as ReviewRating
  }
  return undefined
}

/** 审核输入正文预算（字符）：超出后按 head+tail 采样，避免长文塞满上下文 */
const REVIEW_CONTENT_MAX_CHARS = 8_000
/** head 采样占比：标题/背景/整体结构通常集中在开头 */
const REVIEW_HEAD_RATIO = 0.7
/** 审核输出 token 上限：JSON + 多条 issue/suggestion，过低会截断 JSON 导致解析失败 */
const REVIEW_MAX_TOKENS = 4_000

interface ReviewContentSlice {
  /** 实际送入审核的正文 */
  text: string
  /** 生成内容总字符数 */
  totalChars: number
  /** 实际审核的字符数 */
  reviewedChars: number
  truncated: boolean
}

/**
 * 超长正文按 head+tail 采样：保留开头（背景/结构）与结尾（结论），
 * 中间以显式标记省略，避免模型误以为内容不完整而凭空补全
 */
function sliceContentForReview(content: string): ReviewContentSlice {
  if (content.length <= REVIEW_CONTENT_MAX_CHARS) {
    return {
      text: content,
      totalChars: content.length,
      reviewedChars: content.length,
      truncated: false,
    }
  }

  const headChars = Math.floor(REVIEW_CONTENT_MAX_CHARS * REVIEW_HEAD_RATIO)
  const tailChars = REVIEW_CONTENT_MAX_CHARS - headChars
  const omittedChars = content.length - REVIEW_CONTENT_MAX_CHARS
  const text = [
    content.slice(0, headChars),
    "",
    `[……中间省略 ${omittedChars} 字，仅审核首尾内容……]`,
    "",
    content.slice(-tailChars),
  ].join("\n")

  return {
    text,
    totalChars: content.length,
    reviewedChars: REVIEW_CONTENT_MAX_CHARS,
    truncated: true,
  }
}

function validateSeverity(value: unknown): IssueSeverity {
  if (typeof value === "string" && (SEVERITY_LEVELS as readonly string[]).includes(value)) {
    return value as IssueSeverity
  }
  // 模型漏写/写错严重度时按"中"归类，避免 UI 出现 undefined 分类与空白样式
  return "中"
}

function validateIssues(value: unknown): ReviewResult["issues"] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item: any) => item && typeof item === "object")
    .map((item: any) => ({
      description: typeof item.description === "string" ? item.description.trim() : "",
      severity: validateSeverity(item.severity),
    }))
    .filter((issue) => issue.description)
}

function validateSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
}

/** 单项评分校验：非数字/非有限值视为无效，越界分数收敛到 1-10 */
function normalizeScore(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return Math.min(10, Math.max(1, Math.round(value)))
}

/**
 * 分项评分校验：五个必填维度任一缺失/非法则整组丢弃（宁可不展示，也不展示半张图），
 * titleQuality 为可选维度
 */
function validateDetailedScore(value: unknown): ReviewResult["detailedScore"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>

  const accuracy = normalizeScore(raw.accuracy)
  const structure = normalizeScore(raw.structure)
  const quality = normalizeScore(raw.quality)
  const format = normalizeScore(raw.format)
  const coverage = normalizeScore(raw.coverage)
  if (
    accuracy === undefined
    || structure === undefined
    || quality === undefined
    || format === undefined
    || coverage === undefined
  ) {
    return undefined
  }

  const titleQuality = normalizeScore(raw.titleQuality)
  return {
    accuracy,
    structure,
    quality,
    format,
    coverage,
    ...(titleQuality !== undefined ? { titleQuality } : {}),
  }
}

/** 思考截断重试时的输出预算上限 */
const RETRY_MAX_TOKENS_CAP = 65536

export class AIContentGenerator {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  private getApiConfig(): AiApiConfig {
    return getApiConfigFromPlugin(this.plugin)
  }

  /** 运行时文案取值（缺失 key 回退为 key 本身，不写中文兜底） */
  private t(key: string, params?: Record<string, string | number>): string {
    return localize(
      (this.plugin.i18n ?? {}) as unknown as Record<string, string>,
      key,
      params,
    )
  }

  public init() {
    this.addDock()
  }

  private addDock() {
    createVueDockApp(this.plugin, AIContentGeneratorPanel, {
      position: "RightTop",
      width: 400,
      icon: "iconSparkles",
      title: this.plugin.i18n.aiContentGenerator,
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
          signal?: AbortSignal,
        ): Promise<ReviewResult> => {
          return await this.reviewContent(userRequest, generatedContent, skill, signal)
        },
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
      showMessage(this.t("msgInputContent"), 3000, "error")
      return ""
    }

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
      // 用户已停止：按取消返回，不再发起重试；signal 保持原样，重试仍可被停止
      if (options.signal?.aborted) return ""
      options.onTruncationRetry?.()
      showMessage(this.t("msgTruncationRetry"), 3000, "info")
      const retryTokens = Math.min(options.maxTokens * 2, RETRY_MAX_TOKENS_CAP)
      const retry = await this.runOnce(fullPrompt, apiConfig, options, retryTokens)
      if (retry.result) {
        return retry.result
      }
      if (retry.hasReasoning) {
        // 抛错交由调用方转为行内错误提示，避免 toast + 行内双通道重复
        throw new Error(this.t("msgTruncationRetryFailed"))
      }
    }

    // 用户已停止：安静返回，交由调用方按取消处理，不产出"生成失败"错误
    if (options.signal?.aborted) return ""
    throw new Error(this.t("msgGenerationFailedRetry"))
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

  public async reviewContent(
    userRequest: string,
    generatedContent: string,
    skill?: SkillItem,
    signal?: AbortSignal,
  ): Promise<ReviewResult> {
    const skillRubric = skill ? this.buildSkillRubric(skill) : ""
    const contentSlice = sliceContentForReview(generatedContent)
    const reviewCoverage: NonNullable<ReviewResult["reviewCoverage"]> = {
      reviewedChars: contentSlice.reviewedChars,
      totalChars: contentSlice.totalChars,
      strategy: "head-tail",
    }

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
      contentSlice.text,
      ...(contentSlice.truncated
        ? [`（注：原文共 ${contentSlice.totalChars} 字，以上为开头与结尾节选，请仅基于节选内容审核）`]
        : []),

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
      `  "rating":"${RATING_VALUES.join("|")}",`,
      `  "summary":"总体评价（1-2句话）",`,
      `  "issues":[{"description":"具体问题描述","severity":"${SEVERITY_LEVELS.join("|")}"}],`,
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
      apiConfig.model = DEEPSEEK_V4_PRO
    }

    try {
      const result = await callAI(reviewPrompt, apiConfig, {
        systemPrompt: "你只输出JSON，禁止任何解释或前缀文字。",
        temperature: 0.1,
        maxTokens: REVIEW_MAX_TOKENS,
        responseFormat: { type: "json_object" },
        signal,
      })

      const json = extractJsonFromText(result)
      if (!json) {
        return this.buildReviewError(
          this.t("reviewErrorNoJson"),
          apiConfig,
          reviewCoverage,
        )
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        return this.buildReviewError(
          this.t("reviewErrorInvalidJson"),
          apiConfig,
          reviewCoverage,
        )
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return this.buildReviewError(
          this.t("reviewErrorNotObject"),
          apiConfig,
          reviewCoverage,
        )
      }

      const record = parsed as Partial<ReviewResult>
      const rating = validateRating(record.rating)
      if (!rating) {
        return this.buildReviewError(
          this.t("reviewErrorNoRating"),
          apiConfig,
          reviewCoverage,
        )
      }

      const detailedScore = validateDetailedScore(record.detailedScore)
      return {
        rating,
        summary: typeof record.summary === "string" && record.summary.trim()
          ? record.summary.trim()
          : this.t("reviewSummaryCompleted"),
        issues: validateIssues(record.issues),
        suggestions: validateSuggestions(record.suggestions),
        reviewModel: apiConfig.model,
        reviewedAt: Date.now(),
        reviewCoverage,
        ...(detailedScore ? { detailedScore } : {}),
      }
    } catch (error) {
      // 用户取消审核：向上抛出，交由审核侧按取消处理，不产出"审核异常"结果
      if (isAbortError(error)) throw error
      console.error("审核失败:", error)
      return this.buildReviewError(
        this.t("reviewErrorException", { error: (error as Error).message }),
        apiConfig,
        reviewCoverage,
      )
    }
  }

  /**
   * 构造审核错误态结果：error 存在时 UI 不展示评级/评分/问题清单，
   * 仅展示错误信息与重试入口
   */
  private buildReviewError(
    message: string,
    apiConfig: AiApiConfig,
    reviewCoverage: NonNullable<ReviewResult["reviewCoverage"]>,
  ): ReviewResult {
    return {
      rating: RATING_NEEDS_FIX,
      summary: "",
      issues: [],
      suggestions: [],
      reviewModel: apiConfig.model || DEEPSEEK_V4_PRO,
      reviewedAt: Date.now(),
      error: message,
      reviewCoverage,
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
