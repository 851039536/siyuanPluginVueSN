<template>
  <div v-if="visible" class="pronunciation-overlay" @click.self="closeDialog">
    <div class="pronunciation-dialog">
      <!-- 对话框头部 -->
      <div class="dialog-header">
        <div class="dialog-title">
          <svg class="dialog-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8,12 6,14 6,16.5C6,19 8,21 10.5,21C13,21 15,19 15,16.5V6H19V3H12Z"/>
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
          <label class="input-label">输入内容</label>
          <input
            v-model="inputWord"
            class="word-input"
            placeholder="输入中文或英文..."
            @keyup.enter="manualGenerate"
          />
        </div>

        <!-- 显示当前使用的API配置（只读） -->
        <div class="api-info-section">
          <div class="api-info-label">当前API配置</div>
          <div class="api-info-content">
            <span class="api-provider-badge">{{ getProviderDisplayName() }}</span>
            <span class="api-model-text">{{ getCurrentModel() }}</span>
          </div>
          <div class="api-info-hint">在超级面板中配置 AI 设置</div>
        </div>

        <!-- 生成按钮 -->
        <div class="action-section">
          <button
            class="btn-generate"
            @click="manualGenerate"
            :disabled="!inputWord || isGenerating"
          >
            <svg class="btn-icon" v-if="!isGenerating"><use xlink:href="#iconRefresh"></use></svg>
            <span v-if="isGenerating">生成中...</span>
            <span v-else>生成谐音</span>
          </button>
        </div>

        <!-- 结果展示 -->
        <div class="result-section" v-if="generatedResult">
          <label class="result-label">谐音记忆</label>
          <div class="result-content" v-html="formatResult(generatedResult)"></div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { showMessage } from 'siyuan'
import type PluginSample from '@/index'

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

// 获取供应商显示名称
function getProviderDisplayName(): string {
  const config = getApiConfig()
  const nameMap: Record<string, string> = {
    'tongyi': '通义千问',
    'openai': 'OpenAI',
    'deepseek': 'DeepSeek',
    'custom': '自定义API'
  }
  return nameMap[config.provider] || '未配置'
}

// 获取当前模型
function getCurrentModel(): string {
  const config = getApiConfig()
  return config.model || '默认模型'
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

#### ${text}

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

#### ${text}

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

  try {
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



// 旧的生成函数保留用于手动触发
async function manualGenerate() {
  if (!inputWord.value) {
    showMessage('请输入内容', 3000, 'error')
    return
  }

  isGenerating.value = true
  generatedResult.value = ''

  try {
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
  // 将markdown格式转换为HTML
  return result
    .replace(/####\s+(.+)/g, '<h4>$1</h4>')
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
.pronunciation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  pointer-events: auto;
}

.pronunciation-dialog {
  background: var(--b3-theme-background);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--b3-theme-surface);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.dialog-icon {
  width: 20px;
  height: 20px;
  color: var(--b3-theme-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-background);
  }
}

.close-btn .icon {
  width: 18px;
  height: 18px;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label,
.setting-label,
.result-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.word-input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 3px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.api-info-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  border: 1px solid var(--b3-theme-surface-lighter);
}

.api-info-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 2px;
}

.api-info-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-provider-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.api-model-text {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  font-family: monospace;
}

.api-info-hint {
  font-size: 10px;
  color: var(--b3-theme-on-surface-variant);
  font-style: italic;
  margin-top: 2px;
}

.action-section {
  display: flex;
  justify-content: center;
}

.btn-generate {
  padding: 8px 16px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 3px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--b3-theme-surface);
  border-radius: 3px;
}

.result-content {
  font-size: 12px;
  line-height: 1.6;
  color: var(--b3-theme-on-background);
  white-space: pre-wrap;
  word-break: break-word;

  :deep(h4) {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--b3-theme-primary);
  }

  :deep(strong) {
    color: var(--b3-theme-on-background);
    font-weight: 600;
  }
}

.dialog-footer {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--b3-theme-surface);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.btn-copy,
.btn-close {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 3px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-icon {
  width: 12px;
  height: 12px;
}

.btn-close {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);

  &:hover {
    opacity: 0.9;
  }
}

.dialog-body::-webkit-scrollbar {
  width: 5px;
}

.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-body::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;

  &:hover {
    background: var(--b3-theme-on-surface-variant);
  }
}
</style>
