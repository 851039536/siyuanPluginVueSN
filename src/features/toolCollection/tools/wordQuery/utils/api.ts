// 单词查询 API 封装与共享工具函数
import type { AiApiConfig } from "@/types/ai"
import { callAI } from "@/utils/aiApi"
import { LANGUAGE_MAP } from "../types"

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

/** 判断输入是否为纯英文单词 */
export function isEnglishWord(text: string): boolean {
  return /^[a-z\s-]+$/i.test(text)
}

/** 构造单词查询 prompt（从 WordQueryManager 提取） */
export function buildQueryPrompt(word: string): string {
  const isEnglish = isEnglishWord(word)

  return `请为${isEnglish ? "英文单词" : "中文词语"} "${word}" 生成详细信息，要求：

1. 使用英式标准发音${isEnglish ? "" : "（如果是英文）"}
2. 谐音使用带声调的拼音标注
3. 严格按照以下格式输出：

#### ${word}

${
  isEnglish
    ? `单词：${word}
音标：[英式音标]
释义：[中文释义]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]`
    : `词语：${word}
拼音：[标准拼音]
英文：[英文翻译]
释义：[中文释义]
谐音：[英文谐音，便于记忆，如:桑普(sǎmpǔ)]`
}
发音：[发音要点说明]
例句：[${isEnglish ? "英文例句及中文翻译" : "中文例句及英文翻译"}]

注意事项：
- ${isEnglish ? "音标必须是英式音标" : "英文翻译要准确自然"}
- 谐音要贴近实际发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 提供常用例句
- 只输出格式化内容，不要有其他说明文字`
}

/** 构造翻译 prompt（从 WordQueryManager 提取） */
export function buildTranslatePrompt(
  text: string,
  sourceLang: string,
  targetLang: string,
): string {
  const sourceName = LANGUAGE_MAP[sourceLang] || sourceLang
  const targetName = LANGUAGE_MAP[targetLang] || targetLang

  return sourceLang === "auto"
    ? `请将以下文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：\n\n${text}`
    : `请将以下${sourceName}文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：\n\n${text}`
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
