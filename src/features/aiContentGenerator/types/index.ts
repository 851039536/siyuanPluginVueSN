import type {
  GenerateOptions,
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
   * 销毁功能
   */
  public destroy() {}
}

// 重新导出类型，保持向后兼容

