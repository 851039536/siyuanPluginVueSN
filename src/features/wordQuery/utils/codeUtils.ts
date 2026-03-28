import { showMessage } from 'siyuan'

export interface ApiConfig {
  provider: string
  model: string
  apiKey: string
  customEndpoint: string
}

// ========== 代码注释生成器 ==========

export interface CommentStyle {
  id: string
  label: string
  description: string
  example: string
}

export const COMMENT_STYLES: CommentStyle[] = [
  { id: 'jsdoc', label: 'JSDoc', description: 'JavaScript 标准文档注释', example: '/** ... */' },
  { id: 'jsingle', label: '单行注释', description: '简洁的单行注释风格', example: '// ...' },
  { id: 'jblock', label: '块注释', description: '多行块注释风格', example: '/* ... */' },
  { id: 'python', label: 'Python 文档', description: 'Python docstring 风格', example: '""" ... """' },
  { id: 'java', label: 'JavaDoc', description: 'Java 标准文档注释', example: '/** ... */' }
]

export interface CodeCommentResult {
  original: string
  commented: string
  style: string
  suggestions: string[]
}

const API_PROVIDERS = {
  tongyi: {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    buildRequest: (model: string, messages: any[]) => ({
      model,
      input: { messages },
      parameters: { temperature: 0.3, top_p: 0.8, max_tokens: 2000 }
    })
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    buildRequest: (model: string, messages: any[]) => ({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000
    })
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    buildRequest: (model: string, messages: any[]) => ({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000
    })
  }
}

function extractTextFromResponse(data: any): string {
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

  throw new Error('API返回数据格式错误')
}

function buildCommentPrompt(code: string, style: CommentStyle): string {
  return `请为以下代码生成${style.label}风格的注释。

要求：
1. 注释风格：${style.description}（${style.example}）
2. 注释要清晰、准确，解释代码的功能和关键逻辑
3. 对于函数，需要说明参数、返回值和用途
4. 注释使用中文
5. 只返回添加了注释的代码，不要有其他说明

代码：
\`\`\`
${code}
\`\`\`
`
}

export async function generateCodeComments(
  code: string,
  style: CommentStyle,
  config: ApiConfig
): Promise<CodeCommentResult> {
  if (!code.trim()) {
    throw new Error('请输入代码内容')
  }

  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  const provider = API_PROVIDERS[config.provider as keyof typeof API_PROVIDERS]
  if (!provider) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = config.provider === 'custom' ? config.customEndpoint : provider.url
  if (!apiUrl) {
    throw new Error('API端点未设置')
  }

  const model = config.model || (config.provider === 'tongyi' ? 'qwen-plus' : 'deepseek-chat')
  const messages = [
    { role: 'system', content: '你是一个专业的代码注释生成助手，擅长为各种编程语言生成清晰、准确的注释。' },
    { role: 'user', content: buildCommentPrompt(code, style) }
  ]

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(provider.buildRequest(model, messages))
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = extractTextFromResponse(data)

  return {
    original: code,
    commented: text,
    style: style.id,
    suggestions: []
  }
}

// ========== 代码解释器 ==========

export interface CodeExplanationResult {
  code: string
  explanation: string
  language: string
  complexity: string
  suggestions: string[]
}

function buildExplanationPrompt(code: string): string {
  return `请详细解释以下代码：

要求：
1. 解释代码的整体功能和目的
2. 分析代码的关键逻辑和算法
3. 说明代码的时间复杂度和空间复杂度
4. 如果有优化空间，提供改进建议
5. 使用中文回答，格式清晰

代码：
\`\`\`
${code}
\`\`\`

请按以下JSON格式返回：
{
  "explanation": "代码的整体功能解释",
  "language": "编程语言",
  "complexity": "时间复杂度分析",
  "suggestions": ["优化建议1", "优化建议2"]
}
`
}

export async function explainCode(
  code: string,
  config: ApiConfig
): Promise<CodeExplanationResult> {
  if (!code.trim()) {
    throw new Error('请输入代码内容')
  }

  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  const provider = API_PROVIDERS[config.provider as keyof typeof API_PROVIDERS]
  if (!provider) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = config.provider === 'custom' ? config.customEndpoint : provider.url
  if (!apiUrl) {
    throw new Error('API端点未设置')
  }

  const model = config.model || (config.provider === 'tongyi' ? 'qwen-plus' : 'deepseek-chat')
  const messages = [
    { role: 'system', content: '你是一个专业的代码分析助手，擅长解释代码、分析复杂度和提供优化建议。' },
    { role: 'user', content: buildExplanationPrompt(code) }
  ]

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(provider.buildRequest(model, messages))
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = extractTextFromResponse(data)

  // 尝试解析 JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        code,
        explanation: parsed.explanation || text,
        language: parsed.language || '未知',
        complexity: parsed.complexity || '未分析',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
      }
    }
  } catch (error) {
    console.error('解析解释结果失败:', error)
  }

  return {
    code,
    explanation: text,
    language: '未知',
    complexity: '未分析',
    suggestions: []
  }
}

// ========== 正则生成器 ==========

export interface RegexExample {
  match: string
  notMatch?: string
}

export interface RegexResult {
  description: string
  regex: string
  examples: string[]
  explanation: string
}

function buildRegexPrompt(description: string, examples: RegexExample[]): string {
  let prompt = `请根据以下描述生成正则表达式：

描述：${description}

`

  if (examples.length > 0) {
    prompt += `示例匹配：
`
    examples.forEach((ex, i) => {
      prompt += `${i + 1}. 匹配: "${ex.match}"`
      if (ex.notMatch) {
        prompt += ` | 不匹配: "${ex.notMatch}"`
      }
      prompt += '\n'
    })
  }

  prompt += `
要求：
1. 生成一个精准匹配的正则表达式
2. 解释正则表达式的各个部分
3. 提供更多的匹配示例
4. 只返回JSON格式，不要有其他文字说明

返回格式：
{
  "regex": "正则表达式",
  "examples": ["匹配示例1", "匹配示例2", "匹配示例3"],
  "explanation": "正则表达式各部分的解释"
}
`

  return prompt
}

export async function generateRegex(
  description: string,
  examples: RegexExample[],
  config: ApiConfig
): Promise<RegexResult> {
  if (!description.trim() && examples.length === 0) {
    throw new Error('请输入正则描述或提供匹配示例')
  }

  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  const provider = API_PROVIDERS[config.provider as keyof typeof API_PROVIDERS]
  if (!provider) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = config.provider === 'custom' ? config.customEndpoint : provider.url
  if (!apiUrl) {
    throw new Error('API端点未设置')
  }

  const model = config.model || (config.provider === 'tongyi' ? 'qwen-plus' : 'deepseek-chat')
  const messages = [
    { role: 'system', content: '你是一个专业的正则表达式生成助手，擅长根据用户描述生成精准的正则表达式。' },
    { role: 'user', content: buildRegexPrompt(description, examples) }
  ]

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(provider.buildRequest(model, messages))
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = extractTextFromResponse(data)

  // 尝试解析 JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        description,
        regex: parsed.regex || '',
        examples: Array.isArray(parsed.examples) ? parsed.examples : [],
        explanation: parsed.explanation || ''
      }
    }
  } catch (error) {
    console.error('解析正则结果失败:', error)
  }

  // 如果解析失败，尝试从文本中提取正则
  const regexMatch = text.match(/\/(.+?)\/[gimsu]*/);
  if (regexMatch) {
    return {
      description,
      regex: regexMatch[1],
      examples: [],
      explanation: text
    }
  }

  return {
    description,
    regex: text,
    examples: [],
    explanation: ''
  }
}

// ========== 测试正则表达式 ==========

export function testRegex(pattern: string, testString: string): {
  matches: string[]
  isValid: boolean
  error?: string
} {
  try {
    const regex = new RegExp(pattern, 'g')
    const matches = testString.match(regex) || []
    return {
      matches,
      isValid: true
    }
  } catch (error) {
    return {
      matches: [],
      isValid: false,
      error: (error as Error).message
    }
  }
}
