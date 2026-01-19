<template>
  <div v-if="visible" class="pronunciation-overlay" @click.self="closeDialog">
    <div class="pronunciation-dialog">
      <!-- 对话框头部 -->
      <div class="dialog-header">
        <div class="dialog-title">
          <svg class="dialog-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12.87,15.07L10.33,12.56L13.06,11.14C13.06,11.14 13.11,10.89 13.11,10.67C13.11,9.82 12.53,9.12 11.72,9.03C11.5,9 10.89,9 10.5,9.12C9.5,9.37 8.69,10.21 8.69,11.25C8.69,11.45 8.75,11.64 8.84,11.81L7.15,12.94C6.91,12.5 6.77,12 6.77,11.5C6.77,9.57 8.3,8 10.23,8C11.77,8 13.08,9 13.5,10.37C13.75,11.17 13.75,12 13.5,12.81C13.39,13.16 13.19,13.5 12.87,13.73L12.87,15.07M12,20C8.13,20 5,16.87 5,13C5,10.36 6.5,7.95 8.77,6.77L8.77,5.5C8.77,4.12 9.89,3 11.27,3C12.65,3 13.77,4.12 13.77,5.5L13.77,6.77C16.04,7.95 17.54,10.36 17.54,13C17.54,16.87 14.41,20 10.54,20H12M10,1L9,8L11,8L10,1M15,1L14,8L16,8L15,1M2,11L3,13L5,13L4,11L2,11Z"/>
          </svg>
          <span>{{ i18n.pronunciationHelp || '谐音翻译' }}</span>
        </div>
        <button class="close-btn" @click="closeDialog" :title="i18n.close || '关闭'">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-body">
        <!-- 输入单词 -->
        <div class="input-section">
          <label class="input-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
            输入内容
          </label>
          <div class="input-wrapper">
            <input
              v-model="inputWord"
              class="word-input"
              placeholder="输入中文或英文..."
              @keyup.enter="generatePronunciation"
            />
            <button
              class="btn-generate-small"
              @click="generatePronunciation"
              :disabled="!inputWord || isGenerating"
              :title="isGenerating ? '生成中...' : '生成谐音'"
            >
              <svg class="btn-icon" v-if="!isGenerating"><use xlink:href="#iconRefresh"></use></svg>
              <span v-if="isGenerating">...</span>
            </button>
          </div>
        </div>


        <!-- 结果展示 -->
        <div class="result-section" v-if="generatedResult">
          <div class="result-header">
            <div class="result-title">
              <label class="result-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
              谐音记忆
            </label>
              <!-- 来源标识 -->
              <span class="source-badge" :class="{ local: isInFlashcard }">
                {{ isInFlashcard ? '📚 来自单词本' : '🤖 AI生成' }}
              </span>
            </div>
            <div class="result-actions">
              <!-- 添加到单词本按钮（仅API生成的结果显示） -->
              <button
                v-if="!isInFlashcard"
                class="btn-add-card"
                @click="openAddToCardDialog"
                title="添加到单词本"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                添加到单词本
              </button>
              <button class="btn-copy-result" @click="copyResult" :disabled="!generatedResult" title="复制结果">
                <svg class="btn-icon"><use xlink:href="#iconCopy"></use></svg>
              </button>
            </div>
          </div>
          <div class="result-content" v-html="formatResult(generatedResult)"></div>
        </div>

        <!-- 空状态 -->
        <div class="empty-state" v-else-if="!isGenerating">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <p class="empty-text">输入单词或短语以生成谐音记忆</p>
        </div>

        <!-- 加载状态 -->
        <div class="loading-state" v-if="isGenerating">
          <div class="spinner-container">
            <div class="spinner"></div>
            <svg class="spinner-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
          </div>
          <p class="loading-text">正在生成谐音记忆...</p>
        </div>
      </div>

      <!-- 对话框底部 -->
      <div class="dialog-footer">
        <button class="btn-copy" @click="copyResult" :disabled="!generatedResult">
          <svg class="btn-icon"><use xlink:href="#iconCopy"></use></svg>
          <span>复制结果</span>
        </button>
        <button class="btn-close" @click="closeDialog">
          关闭
        </button>
      </div>
    </div>

    <!-- 添加到单词本对话框 -->
    <div class="dialog-overlay add-card-overlay" v-if="showAddToCardDialog" @click.self="showAddToCardDialog = false">
      <div class="add-card-dialog" @click.stop>
        <div class="add-card-header">
          <h4>添加到单词本</h4>
          <button class="close-btn" @click="showAddToCardDialog = false">
            <svg class="icon"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="add-card-body">
          <div class="add-card-info">
            <div class="info-item">
              <span class="info-label">单词:</span>
              <span class="info-value">{{ inputWord }}</span>
            </div>
          </div>
          <div class="form-group">
            <label>选择类别</label>
            <select v-model="selectedCategory">
              <option value="">请选择类别</option>
              <option v-for="cat in availableCategories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>
        </div>
        <div class="add-card-footer">
          <button class="btn-secondary" @click="showAddToCardDialog = false">取消</button>
          <button class="btn-primary" @click="addToFlashcard" :disabled="!selectedCategory">
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { showMessage } from 'siyuan'
import type PluginSample from '@/index'
import { FlashcardStorage } from '@/features/flashcardReading/storage'
import type { Flashcard } from '@/features/flashcardReading/types'

interface Props {
  visible: boolean
  content?: string
  plugin?: PluginSample
  i18n?: Record<string, any>
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

const emit = defineEmits<Emits>()

// 状态
const inputWord = ref(props.content || '')
const isGenerating = ref(false)
const generatedResult = ref('')
const resultSource = ref<'local' | 'api' | ''>('')
const matchedCard = ref<Flashcard | null>(null)
const showAddToCardDialog = ref(false)
const selectedCategory = ref('')
const availableCategories = ref<string[]>(['C#', '编程单词', 'JavaScript', 'Python', 'TypeScript', 'Vue', 'React', 'Go', 'Rust', 'Java'])

// 初始化 FlashcardStorage
const flashcardStorage = props.plugin ? new FlashcardStorage(props.plugin) : null

// 检查结果是否已在单词本中
const isInFlashcard = computed(() => resultSource.value === 'local')

// 监听props变化，自动触发翻译
watch(() => props.content, async (newContent) => {
  if (newContent) {
    inputWord.value = newContent
    generatedResult.value = ''
    // 自动触发翻译
    await nextTick()
    await generatePronunciation()
  }
})

// 监听visible变化，弹窗打开时自动触发翻译
watch(() => props.visible, async (newVisible) => {
  if (newVisible && inputWord.value) {
    await nextTick()
    await generatePronunciation()
  }
})


// 检测是否为中文
function isChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

// 获取API配置（从超级面板的统一配置中读取）
function getApiConfig() {
  const settings = (props.plugin as any)?.settings || {}
  return {
    provider: settings.aiApiProvider || 'tongyi',
    model: settings.aiModel || 'qwen-plus',
    apiKey: settings.aiApiKey || '',
    customEndpoint: settings.aiCustomEndpoint || ''
  }
}


// 构建提示词（根据输入语言自动选择）
function buildPrompt(text: string): string {
  // 检测是否为中文，如果是中文则翻译成英文并生成谐音
  if (isChinese(text)) {
    return `请将中文词语 "${text}" 翻译成英文，并为英文翻译生成谐音记忆，要求：

1. 提供准确的英文翻译
2. 提供英式音标
3. 为英文翻译生成中文谐音记忆
4. 谐音使用带声调的拼音标注
5. 严格按照以下格式输出：

中文：${text}
英文：[英文翻译]
音标：[英式音标]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]
发音：[发音要点说明]

注意事项：
- 提供最常用的英文翻译
- 音标使用英式标准
- 谐音要贴近实际发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 只输出格式化内容，不要有其他说明文字`
  }

  // 英文单词生成谐音记忆
  return `请为英文单词 "${text}" 生成谐音记忆，要求：

1. 使用英式标准发音
2. 谐音使用带声调的拼音标注
3. 严格按照以下格式输出：

单词：${text}
音标：[英式音标]
释义：[中文释义]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]
发音：[发音要点说明]

注意事项：
- 音标必须是英式音标
- 谐音要贴近实际发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 只输出格式化内容，不要有其他说明文字`
}

// 生成谐音翻译/中文翻译
async function generatePronunciation() {
  if (!inputWord.value) {
    showMessage('请输入内容', 3000, 'error')
    return
  }

  isGenerating.value = true
  generatedResult.value = ''
  resultSource.value = ''
  matchedCard.value = null

  try {
    // 优先从本地 FlashcardStorage 查询
    if (flashcardStorage) {
      const localResult = await queryFromLocalStorage(inputWord.value)
      if (localResult) {
        generatedResult.value = localResult.content
        resultSource.value = 'local'
        matchedCard.value = localResult
        showMessage('📚 从单词本加载', 2000, 'info')
        isGenerating.value = false
        return
      }
    }

    // 本地未找到，调用 API 生成
    const prompt = buildPrompt(inputWord.value)
    const config = getApiConfig()

    let result = ''

    switch (config.provider) {
      case 'tongyi':
        result = await callTongyiAPI(prompt, config)
        break
      case 'openai':
        result = await callOpenAIAPI(prompt, config)
        break
      case 'deepseek':
        result = await callDeepSeekAPI(prompt, config)
        break
      case 'custom':
        result = await callCustomAPI(prompt, config)
        break
      default:
        throw new Error(`不支持的API供应商: ${config.provider}`)
    }

    if (result) {
      generatedResult.value = result
      resultSource.value = 'api'
      showMessage('✓ 谐音记忆已生成', 2000, 'info')
    } else {
      showMessage('生成失败，请重试', 3000, 'error')
    }
  } catch (error) {
    console.error('Pronunciation generation error:', error)
    const errorMsg = (error as Error).message || '未知错误'
    showMessage('🚫 生成失败: ' + errorMsg, 5000, 'error')
  } finally {
    isGenerating.value = false
  }
}

/**
 * 从本地 FlashcardStorage 查询单词
 * 优先按标题精确匹配，其次按内容包含匹配
 */
async function queryFromLocalStorage(word: string): Promise<Flashcard | null> {
  if (!flashcardStorage) return null

  try {
    const allCards = await flashcardStorage.getAllCards()

    // 优先精确匹配标题
    const exactMatch = allCards.find(card =>
      card.title.toLowerCase() === word.toLowerCase()
    )
    if (exactMatch) {
      return exactMatch
    }

    // 其次模糊匹配标题
    const fuzzyMatch = allCards.find(card =>
      card.title.toLowerCase().includes(word.toLowerCase()) ||
      word.toLowerCase().includes(card.title.toLowerCase())
    )
    if (fuzzyMatch) {
      return fuzzyMatch
    }

    return null
  } catch (error) {
    console.error('Query from local storage error:', error)
    return null
  }
}

/**
 * 打开添加到单词本对话框
 */
function openAddToCardDialog() {
  // 加载现有类别
  loadCategories()
  selectedCategory.value = '编程单词'
  showAddToCardDialog.value = true
}

/**
 * 加载单词本中的类别
 */
async function loadCategories() {
  if (!flashcardStorage) return

  try {
    const categories = await flashcardStorage.getCategories()
    availableCategories.value = ['C#', '编程单词', 'JavaScript', 'Python', 'TypeScript', 'Vue', 'React', 'Go', 'Rust', 'Java', ...categories]
    // 去重
    availableCategories.value = Array.from(new Set(availableCategories.value)).sort()
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

/**
 * 添加到单词本
 */
async function addToFlashcard() {
  if (!flashcardStorage || !inputWord.value || !generatedResult.value) {
    showMessage('数据不完整', 2000, 'error')
    return
  }

  if (!selectedCategory.value) {
    showMessage('请选择类别', 2000, 'error')
    return
  }

  try {
    await flashcardStorage.createCard({
      title: inputWord.value,
      content: generatedResult.value,
      category: selectedCategory.value
    })

    resultSource.value = 'local'
    showAddToCardDialog.value = false
    showMessage('✓ 已添加到单词本', 2000, 'info')

    // 通知其他组件刷新数据
    window.dispatchEvent(new CustomEvent('flashcardDataChanged'))
  } catch (error: any) {
    if (error.message === 'Title already exists') {
      showMessage('该单词已存在于单词本中', 3000, 'error')
    } else {
      showMessage('添加失败: ' + (error.message || '未知错误'), 3000, 'error')
    }
  }
}




// 调用通义千问API
async function callTongyiAPI(prompt: string, config: any): Promise<string> {
  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  const apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

  const requestBody = {
    model: config.model || 'qwen-plus',
    input: {
      messages: [
        {
          role: 'system',
          content: '你是一个专业的英语教学助手，擅长用中文谐音帮助学习者记忆英语单词发音，也能准确翻译中文词语为英文。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    parameters: {
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 800
    }
  }

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

  if (data.output && data.output.text) {
    return data.output.text
  } else if (data.output && data.output.choices && data.output.choices.length > 0) {
    return data.output.choices[0].message.content
  } else if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content
  } else if (data.text) {
    return data.text
  } else if (data.content) {
    return data.content
  } else {
    throw new Error(`API返回数据格式错误，响应结构: ${JSON.stringify(Object.keys(data))}`)
  }
}

// 调用OpenAI API
async function callOpenAIAPI(prompt: string, config: any): Promise<string> {
  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  const apiUrl = 'https://api.openai.com/v1/chat/completions'

  const requestBody = {
    model: config.model || 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: '你是一个专业的英语教学助手，擅长用中文谐音帮助学习者记忆英语单词发音，也能准确翻译中文词语为英文。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800
  }

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
    throw new Error(`OpenAI API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content
  } else {
    throw new Error('OpenAI API返回数据格式错误')
  }
}

// 调用DeepSeek API
async function callDeepSeekAPI(prompt: string, config: any): Promise<string> {
  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  const apiUrl = 'https://api.deepseek.com/v1/chat/completions'

  const requestBody = {
    model: config.model || 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: '你是一个专业的英语教学助手，擅长用中文谐音帮助学习者记忆英语单词发音，也能准确翻译中文词语为英文。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800
  }

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
    throw new Error(`DeepSeek API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content
  } else {
    throw new Error('DeepSeek API返回数据格式错误')
  }
}

// 调用自定义API
async function callCustomAPI(prompt: string, config: any): Promise<string> {
  if (!config.apiKey) {
    throw new Error('请先在超级面板中配置API密钥')
  }

  if (!config.customEndpoint) {
    throw new Error('请先在超级面板中配置自定义API端点')
  }

  const requestBody = {
    model: config.model || 'default',
    messages: [
      {
        role: 'system',
        content: '你是一个专业的英语教学助手，擅长用中文谐音帮助学习者记忆英语单词发音，也能准确翻译中文词语为英文。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 800
  }

  const response = await fetch(config.customEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`自定义API请求失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()

  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content
  } else if (data.output && data.output.text) {
    return data.output.text
  } else if (data.text) {
    return data.text
  } else if (data.content) {
    return data.content
  } else {
    throw new Error('自定义API返回数据格式错误')
  }
}

// 格式化结果显示
function formatResult(result: string): string {
  // 将markdown格式转换为HTML，移除标题行
  return result
    .replace(/####\s+(.+)\n*/g, '') // 移除标题行
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

// 复制结果到剪贴板
async function copyResult() {
  if (!generatedResult.value) return

  try {
    await navigator.clipboard.writeText(generatedResult.value)
    showMessage('📋 已复制到剪贴板', 2000, 'info')
  } catch (error) {
    console.error('复制失败:', error)
    showMessage('复制失败', 3000, 'error')
  }
}

// 关闭对话框
function closeDialog() {
  emit('update:visible', false)
  emit('close')
}
</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
