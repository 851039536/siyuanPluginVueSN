import type { Plugin } from "siyuan"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { createVueDockApp } from "@/utils/vueAppHelper"
import WordQueryPanel from "../index.vue"
import { callWordQueryAPI } from "../utils/api"

export class WordQueryManager {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 动态获取最新的 API 配置，确保用户修改设置后立即生效
   */
  public getApiConfig() {
    return getApiConfigFromPlugin(this.plugin)
  }

  public init() {
    const self = this
    createVueDockApp(this.plugin, WordQueryPanel, {
      icon: "iconLanguage",
      title: (this.plugin.i18n as any).wordQuery?.title || "单词查询",
      type: "wordquery-dock",
      width: 360,
      i18n: (this.plugin.i18n as any).wordQuery || {},
      extraProps: {
        onQuery: async (word: string) => {
          return await self.queryWord(word)
        },
        onTranslate: async (
          text: string,
          sourceLang: string,
          targetLang: string,
        ) => {
          return await self.translateText(text, sourceLang, targetLang)
        },
      },
    })
  }

  private isEnglishWord(text: string): boolean {
    return /^[a-z\s-]+$/i.test(text)
  }

  public async queryWord(word: string): Promise<string> {
    if (!word) return ""

    const prompt = this.buildPrompt(word)
    return await callWordQueryAPI(prompt, this.getApiConfig())
  }

  private buildPrompt(word: string): string {
    const isEnglish = this.isEnglishWord(word)

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

  public async translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    if (!text) return ""

    const langNames: Record<string, string> = {
      auto: "自动检测",
      zh: "中文",
      en: "英文",
      ja: "日文",
      ko: "韩文",
      fr: "法文",
      de: "德文",
      es: "西班牙文",
    }

    const sourceName = langNames[sourceLang] || sourceLang
    const targetName = langNames[targetLang] || targetLang

    const prompt =
      sourceLang === "auto"
        ? `请将以下文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：\n\n${text}`
        : `请将以下${sourceName}文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：\n\n${text}`

    return await callWordQueryAPI(prompt, this.getApiConfig())
  }

  public destroy() {}
}
