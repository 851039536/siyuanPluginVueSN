import { showMessage } from 'siyuan'

export interface ApiConfig {
  provider: string
  model: string
  apiKey: string
  customEndpoint: string
}

const API_PROVIDERS = {
  tongyi: {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    buildRequest: (model: string, messages: any[]) => ({
      model,
      input: { messages },
      parameters: { temperature: 0.7, top_p: 0.8, max_tokens: 800 }
    })
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    buildRequest: (model: string, messages: any[]) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 800
    })
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    buildRequest: (model: string, messages: any[]) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 800
    })
  }
}

function extractResponseText(data: any): string {
  const possiblePaths = [
    () => data.output?.text,
    () => data.output?.choices?.[0]?.message?.content,
    () => data.choices?.[0]?.message?.content,
    () => data.text,
    () => data.content
  ]

  for (const getText of possiblePaths) {
    const text = getText()
    if (text) return text
  }

  throw new Error(`API返回数据格式错误`)
}

export async function callWordQueryAPI(prompt: string, config: ApiConfig): Promise<string> {
  const provider = config.provider === 'custom' ? 'openai' : config.provider
  const providerConfig = API_PROVIDERS[provider as keyof typeof API_PROVIDERS]

  if (!providerConfig) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = config.provider === 'custom' ? config.customEndpoint : providerConfig.url
  if (!apiUrl) {
    throw new Error('API端点未设置')
  }

  const model = config.model || (config.provider === 'tongyi' ? 'qwen-plus' : 'gpt-3.5-turbo')
  const messages = [
    {
      role: 'system',
      content: '你是一个专业的多语言教学助手，擅长提供单词的详细释义、音标、谐音和例句。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  const requestBody = providerConfig.buildRequest(model, messages)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return extractResponseText(data)
}
