import type {
  GenerateOptions,
  ReviewResult,
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
        onReview: async (userRequest: string, generatedContent: string): Promise<ReviewResult> => {
          return await this.reviewContent(userRequest, generatedContent)
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
   */
  public async reviewContent(userRequest: string, generatedContent: string): Promise<ReviewResult> {
    const reviewPrompt = `你是一位严谨的文档质量审核专家。请对以下AI生成的文档进行交叉审核。

## 用户原始需求
${userRequest}

## AI 生成的内容
${generatedContent}

请从以下维度严格审核，并以 JSON 格式返回结果：

{
  "rating": "优秀|良好|需改进",
  "summary": "总体评价（一两句话）",
  "issues": [
    { "description": "问题描述", "severity": "高|中|低" }
  ],
  "suggestions": ["改进建议1", "改进建议2"]
}

审核标准：
1. **内容准确性**：是否准确回应用户需求，无事实错误
2. **结构完整性**：结构清晰、逻辑连贯、层级合理
3. **语言质量**：表达专业流畅、无语法错误
4. **格式规范**：Markdown 格式正确
5. **覆盖完整性**：是否遗漏用户要求的关键内容

要求：
- 如果文档质量良好无问题，issues 返回空数组，rating 为 "优秀"
- 只返回 JSON，不要添加任何解释文字
- 建议要具体、可操作`

    const apiConfig = this.getApiConfig()
    // 审核使用 deepseek-v4-pro 模型（如果 provider 是 deepseek）
    if (apiConfig.provider === "deepseek") {
      apiConfig.model = "deepseek-v4-pro"
    }

    try {
      const result = await callAI(reviewPrompt, apiConfig, {
        systemPrompt: "你是一位严谨的文档质量审核专家，只返回 JSON 格式的审核结果。",
        temperature: 0.3,
        maxTokens: 1000,
      })

      // 解析 JSON 结果
      const parsed = JSON.parse(result.trim()) as ReviewResult
      return {
        rating: parsed.rating || "良好",
        summary: parsed.summary || "审核完成",
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        reviewModel: apiConfig.model,
        reviewedAt: Date.now(),
      }
    } catch (error) {
      console.error("审核失败:", error)
      return {
        rating: "需改进",
        summary: `审核过程出错: ${(error as Error).message}`,
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

