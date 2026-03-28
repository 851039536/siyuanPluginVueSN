import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import WordQueryPanel from '../index.vue'
import { callWordQueryAPI } from '../utils/api'

export interface WordQueryOptions {
  provider: string
  model: string
  apiKey: string
  customEndpoint: string
}

export class WordQueryManager {
  private plugin: Plugin
  private currentProvider: string = 'tongyi'
  private currentModel: string = 'qwen-plus'
  private apiKey: string = ''
  private customApiEndpoint: string = ''

  constructor(plugin: Plugin) {
    this.plugin = plugin
    const settings = (plugin as any).settings
    this.currentProvider = settings.aiApiProvider || 'tongyi'
    this.currentModel = settings.aiModel || 'qwen-plus'
    this.apiKey = settings.aiApiKey || ''
    this.customApiEndpoint = settings.aiCustomEndpoint || ''
  }

  public updateApiConfig(provider: string, model: string, apiKey: string, customEndpoint: string) {
    this.currentProvider = provider
    this.currentModel = model
    this.apiKey = apiKey
    this.customApiEndpoint = customEndpoint
  }

  public getApiConfig(): WordQueryOptions {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
      apiKey: this.apiKey,
      customEndpoint: this.customApiEndpoint
    }
  }

  public init() {
    this.addDock()
  }

  private addDock() {
    const self = this
    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 360, height: 0 },
        icon: 'iconLanguage',
        title: (this.plugin.i18n as any).wordQuery?.title || '单词查询',
        show: false,
      },
      data: {},
      type: 'wordquery-dock',
      init: (dock: any) => {
        const container = document.createElement('div')
        container.style.height = '100%'
        container.style.overflow = 'hidden'

        const app = createApp({
          setup() {
            return () => h(WordQueryPanel, {
              i18n: self.plugin.i18n,
              plugin: self.plugin,
              onQuery: async (word: string) => {
                return await self.queryWord(word)
              },
              onTranslate: async (text: string, sourceLang: string, targetLang: string) => {
                return await self.translateText(text, sourceLang, targetLang)
              }
            })
          }
        })

        app.mount(container)
        dock.element?.appendChild(container)

        dock.__app = app
        dock.__container = container
      },
    })
  }

  private isEnglishWord(text: string): boolean {
    return /^[a-zA-Z\s-]+$/.test(text)
  }

  private isChinese(text: string): boolean {
    return /^[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\s\-.,;:!?'"()（）【】《》《""'']+$/.test(text)
  }

  public async queryWord(word: string): Promise<string> {
    if (!word) return ''

    const prompt = this.buildPrompt(word)
    return await callWordQueryAPI(prompt, this.getApiConfig())
  }

  private buildPrompt(word: string): string {
    const isEnglish = this.isEnglishWord(word)

    return `请为${isEnglish ? '英文单词' : '中文词语'} "${word}" 生成详细信息，要求：

1. 使用英式标准发音${isEnglish ? '' : '（如果是英文）'}
2. 谐音使用带声调的拼音标注
3. 严格按照以下格式输出：

#### ${word}

${isEnglish ? `单词：${word}
音标：[英式音标]
释义：[中文释义]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]` : `词语：${word}
拼音：[标准拼音]
英文：[英文翻译]
释义：[中文释义]
谐音：[英文谐音，便于记忆，如:桑普(sǎmpǔ)]`}
发音：[发音要点说明]
例句：[${isEnglish ? '英文例句及中文翻译' : '中文例句及英文翻译'}]

注意事项：
- ${isEnglish ? '音标必须是英式音标' : '英文翻译要准确自然'}
- 谐音要贴近实际发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 提供常用例句
- 只输出格式化内容，不要有其他说明文字`
  }

  public async translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!text) return ''

    const langNames: Record<string, string> = {
      'auto': '自动检测',
      'zh': '中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文'
    }

    const sourceName = langNames[sourceLang] || sourceLang
    const targetName = langNames[targetLang] || targetLang

    const prompt = sourceLang === 'auto'
      ? `请将以下文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：\n\n${text}`
      : `请将以下${sourceName}文本翻译成${targetName}，保持原文的格式和语气，只输出翻译结果，不要有任何解释或说明：\n\n${text}`

    return await callWordQueryAPI(prompt, this.getApiConfig())
  }

  public destroy() {}
}

export function registerWordQuery(plugin: Plugin) {
  const manager = new WordQueryManager(plugin)
  manager.init()
  ;(plugin as any).__wordQuery = manager
  return manager
}
