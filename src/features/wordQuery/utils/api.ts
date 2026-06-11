import type { AiApiConfig } from "@/types/ai"
import {
  callAI,
} from "@/utils/aiApi"

/** 本地别名，保持内部代码一致 */
const callAPI = callAI

export type ApiConfig = AiApiConfig

export async function callWordQueryAPI(
  prompt: string,
  config: ApiConfig,
): Promise<string> {
  return callAPI(prompt, config, {
    systemPrompt:
      "你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。",
  })
}
