// 单词查询 API 封装与共享工具函数
import type { AiApiConfig } from "@/types/ai"
import { callAI } from "@/utils/aiApi"

export type ApiConfig = AiApiConfig

/**
 * 从 AI 返回的文本中提取 JSON 对象
 * 多个子功能（编程翻译、代码解释、正则生成）共享此解析逻辑
 */
export function parseJsonResponse<T = Record<string, unknown>>(text: string): T | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T
    }
  } catch (error) {
    console.error("解析 AI 返回的 JSON 失败:", error)
  }
  return null
}

export async function callWordQueryAPI(
  prompt: string,
  config: ApiConfig,
): Promise<string> {
  return callAI(prompt, config, {
    systemPrompt:
      "你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。",
  })
}
