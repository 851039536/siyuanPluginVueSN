/**
 * 浮动工具栏 - 翻译替换功能模块
 * 将选中的英文翻译成中文并自动替换当前内容
 */
import { Plugin } from 'siyuan'
import { ToolbarAction } from '../actions'

/**
 * AI 配置接口
 */
interface AiConfig {
  provider: string
  model: string
  apiKey: string
  customEndpoint: string
}

/**
 * API 提供商配置
 */
const API_PROVIDERS = {
  tongyi: {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    defaultModel: 'qwen-plus',
    formatRequest: (model: string, messages: any[]) => ({
      model,
      input: { messages },
      parameters: { temperature: 0.3, top_p: 0.8, max_tokens: 2000 }
    })
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    formatRequest: (model: string, messages: any[]) => ({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000
    })
  },
  custom: {
    url: '',
    defaultModel: 'default',
    formatRequest: (model: string, messages: any[]) => ({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000
    })
  }
}

/**
 * 创建翻译替换功能
 * @param plugin 插件实例
 * @returns 翻译替换工具栏功能
 */
export function createTranslateAction(plugin: Plugin): ToolbarAction {
  return {
    id: 'translate',
    name: (plugin.i18n as any).floatingToolbar?.translate || '英译中替换',
    icon: `<svg viewBox="0 0 24 24" width="14" height="14">
      <path fill="currentColor" d="M12.87,15.07L10.33,12.56L13.06,11.14C13.06,11.14 13.11,10.89 13.11,10.67C13.11,9.82 12.53,9.12 11.72,9.03C11.5,9 10.89,9 10.5,9.12C9.5,9.37 8.69,10.21 8.69,11.25C8.69,11.45 8.75,11.64 8.84,11.81L7.15,12.94C6.91,12.5 6.77,12 6.77,11.5C6.77,9.57 8.3,8 10.23,8C11.77,8 13.08,9 13.5,10.37C13.75,11.17 13.75,12 13.5,12.81C13.39,13.16 13.19,13.5 12.87,13.73L12.87,15.07M12,20C8.13,20 5,16.87 5,13C5,10.36 6.5,7.95 8.77,6.77L8.77,5.5C8.77,4.12 9.89,3 11.27,3C12.65,3 13.77,4.12 13.77,5.5L13.77,6.77C16.04,7.95 17.54,10.36 17.54,13C17.54,16.87 14.41,20 10.54,20H12M10,1L9,8L11,8L10,1M15,1L14,8L16,8L15,1M2,11L3,13L5,13L4,11L2,11Z M12.5,2C12.5,2 12.5,2 12.5,2C13.33,2 14,2.67 14,3.5V8.5C14,9.33 13.33,10 12.5,10C11.67,10 11,9.33 11,8.5V3.5C11,2.67 11.67,2 12.5,2Z M8.5,5H7V3.5C7,2.67 7.67,2 8.5,2C9.33,2 10,2.67 10,3.5V8.5C10,9.33 9.33,10 8.5,10C7.67,10 7,9.33 7,8.5V5H8.5Z"/>
    </svg>`,
    handler: async (selectedText: string) => {
      await translateAndReplace(plugin, selectedText)
    }
  }
}

/**
 * 翻译并替换选中的文本
 * @param plugin 插件实例
 * @param text 选中的文本
 */
async function translateAndReplace(plugin: Plugin, text: string) {
  if (!text.trim()) {
    showMessage(plugin, (plugin.i18n as any).floatingToolbar?.noTextSelected || '未选中文本')
    return
  }

  // 检查是否为英文
  if (!isEnglishText(text)) {
    showMessage(plugin, '请选择英文文本进行翻译')
    return
  }

  try {
    showMessage(plugin, '正在翻译...', 2000)

    // 获取 AI 配置
    const aiConfig = getAiConfig(plugin)

    // 调用翻译 API
    const translatedText = await callTranslateAPI(text, aiConfig)

    if (translatedText) {
      // 获取当前选中的块 ID
      const blockId = getSelectedBlockId()
      if (blockId) {
        // 使用思源 API 更新块内容
        await updateBlockContent(blockId, translatedText)
        showMessage(plugin, '翻译完成', 2000)
      } else {
        showMessage(plugin, '无法获取当前块ID', 3000)
      }
    } else {
      showMessage(plugin, '翻译失败，请重试', 3000)
    }
  } catch (error) {
    console.error('Translation error:', error)
    const errorMsg = (error as Error).message || '未知错误'
    showMessage(plugin, '翻译失败: ' + errorMsg, 5000)
  }
}

/**
 * 检测是否为英文文本
 */
function isEnglishText(text: string): boolean {
  // 检查是否主要包含英文字母和常见英文标点
  const englishChars = text.match(/[a-zA-Z]/g)
  const totalChars = text.replace(/\s/g, '').length
  return englishChars !== null && englishChars.length > totalChars * 0.5
}

/**
 * 获取 AI 配置
 */
function getAiConfig(plugin: Plugin): AiConfig {
  const settings = (plugin as any).settings || {}
  return {
    provider: settings.aiApiProvider || 'tongyi',
    model: settings.aiModel || 'qwen-plus',
    apiKey: settings.aiApiKey || '',
    customEndpoint: settings.aiCustomEndpoint || ''
  }
}

/**
 * 获取当前选中的块 ID
 */
function getSelectedBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector('.protyle-wysiwyg--select')
  if (selectedBlock) {
    return selectedBlock.getAttribute('data-node-id')
  }

  // 方法2: 获取光标所在的块（聚焦的块）
  const focusedBlock = document.querySelector('.protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus')
  if (focusedBlock) {
    return focusedBlock.getAttribute('data-node-id')
  }

  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    let node: Node | null = range.startContainer

    // 向上查找直到找到带有 data-node-id 和 data-type 的元素
    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute('data-node-id')
        const dataType = node.getAttribute('data-type')

        // 必须同时有 data-node-id 和 data-type 才是有效的块
        if (nodeId && dataType) {
          return nodeId
        }
      }
      node = node.parentNode
    }
  }

  return null
}

/**
 * 使用思源 API 更新块内容
 */
async function updateBlockContent(blockId: string, content: string): Promise<void> {
  const response = await fetch('/api/block/updateBlock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dataType: 'markdown',
      data: content,
      id: blockId
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`更新块失败: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(`更新块失败: ${result.msg || '未知错误'}`)
  }
}

/**
 * 调用翻译 API
 */
async function callTranslateAPI(text: string, config: AiConfig): Promise<string> {
  const prompt = `请将以下英文文本翻译成中文，只输出翻译结果，不要有任何解释或说明：

${text}`

  const provider = API_PROVIDERS[config.provider as keyof typeof API_PROVIDERS]
  if (!provider) {
    throw new Error(`不支持的API供应商: ${config.provider}`)
  }

  const apiUrl = config.provider === 'custom' ? config.customEndpoint : provider.url
  if (!apiUrl) {
    throw new Error('自定义API端点未设置')
  }

  const model = config.model || provider.defaultModel
  const messages = [
    {
      role: 'system',
      content: '你是一个专业的翻译助手，擅长将英文翻译成流畅的中文。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  const requestBody = provider.formatRequest(model, messages)

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
  return extractTextFromResponse(data)
}

/**
 * 从 API 响应中提取文本内容
 */
function extractTextFromResponse(data: any): string {
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content.trim()
  } else if (data.output?.text) {
    return data.output.text.trim()
  } else if (data.output?.choices?.[0]?.message?.content) {
    return data.output.choices[0].message.content.trim()
  } else if (data.text) {
    return data.text.trim()
  }
  throw new Error('API返回数据格式错误')
}

/**
 * 显示消息
 */
function showMessage(plugin: Plugin, message: string, timeout: number = 3000) {
  fetch('/api/notification/pushMsg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msg: message,
      timeout: timeout
    })
  })
}
