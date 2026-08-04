/**
 * 速记功能 — AI 润色 composable
 * 并发锁 + API Key 校验 + callAISmart 流式调用，新增区/编辑态两处视图复用
 */
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import { ref } from "vue"
import { callAISmart, getApiConfigFromPlugin } from "@/utils/aiApi"

/** 润色错误码：未配置 API Key / 调用失败 */
export type PolishErrorCode = "NO_API_KEY" | "CALL_FAILED"

/** 携带错误码的润色异常（调用方据此选择 i18n 文案与提示方式） */
export class PolishError extends Error {
  readonly code: PolishErrorCode

  constructor(code: PolishErrorCode) {
    super(code)
    this.code = code
  }
}

/** useAiPolish 返回结构 */
export interface AiPolishApi {
  /** 润色进行中（并发锁，供按钮 loading/disabled） */
  polishing: Ref<boolean>
  /** 润色文本；未配置 API Key 抛 NO_API_KEY；onChunk 提供流式增量 */
  polish: (text: string, onChunk?: (chunk: string) => void) => Promise<string>
}

/** 润色系统提示词：保持原意与结构，只输出结果，不添加解释/前后缀 */
const POLISH_SYSTEM_PROMPT =
  "你是一个专业的中文文本润色助手。请优化措辞、修正语病、理顺表达，" +
  "保持原文含义与换行/列表结构不变，只输出润色后的文本，" +
  "不要添加任何解释、前后缀或 Markdown 格式。"
/** 润色温度：文本改写任务，偏低保证输出稳定 */
const POLISH_TEMPERATURE = 0.5
/** 润色最大输出长度：速记为短文本，1000 token 足够 */
const POLISH_MAX_TOKENS = 1000

export function useAiPolish(plugin: Plugin): AiPolishApi {
  const polishing = ref(false)

  const polish = async (
    text: string,
    onChunk?: (chunk: string) => void,
  ): Promise<string> => {
    const trimmed = text.trim()
    // 空文本无需润色；并发锁：润色中再次触发直接返回（按钮 disabled 双保险）
    if (!trimmed || polishing.value) return ""

    const aiConfig = getApiConfigFromPlugin(plugin)
    if (!aiConfig.apiKey) {
      throw new PolishError("NO_API_KEY")
    }

    polishing.value = true
    try {
      return await callAISmart(
        `请润色以下速记文本：\n\n${trimmed}`,
        aiConfig,
        {
          systemPrompt: POLISH_SYSTEM_PROMPT,
          temperature: POLISH_TEMPERATURE,
          maxTokens: POLISH_MAX_TOKENS,
          enableThinking: false,
          onChunk,
        },
      )
    } catch (err) {
      // 透传已分类的 NO_API_KEY；其余网络/解析错误统一归为调用失败
      if (err instanceof PolishError) throw err
      throw new PolishError("CALL_FAILED")
    } finally {
      polishing.value = false
    }
  }

  return { polishing, polish }
}
