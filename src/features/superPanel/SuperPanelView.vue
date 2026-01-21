<template>
  <!-- 遮罩层 -->
  <Transition name="overlay">
    <div
      v-if="visible"
      class="super-panel-overlay"
      @click="handleClose"
    />
  </Transition>

  <!-- 面板容器 -->
  <Transition name="panel">
    <div v-if="visible" class="super-panel-container">
      <!-- 头部 -->
      <div class="super-panel-header">
        <div class="super-panel-title">
          <IconWrapper name="superPanel" :size="20" />
          <span>{{ i18n.title || '超级面板' }}</span>
        </div>
        <div class="header-actions">
          <button
            class="header-action-btn enable-all-btn"
            :title="i18n.enableAll || '全部开启'"
            @click="handleToggleAll(true)"
          >
            <IconWrapper name="success" :size="14" />
          </button>
          <button
            class="header-action-btn disable-all-btn"
            :title="i18n.disableAll || '全部关闭'"
            @click="handleToggleAll(false)"
          >
            <IconWrapper name="close" :size="14" />
          </button>
          <button
            class="super-panel-settings"
            :title="i18n.aiSettings || 'AI配置'"
            @click="toggleAiSettings"
          >
            <IconWrapper name="settings" :size="16" />
          </button>
          <button
            class="super-panel-refresh"
            :title="i18n.refresh || '刷新'"
            :disabled="isRefreshing"
            @click="handleRefresh"
          >
            <svg class="refresh-icon" :class="{ spinning: isRefreshing }" viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
          <button class="super-panel-close" :title="i18n.close || '关闭'" @click="handleClose">
            <IconWrapper name="close" :size="16" />
          </button>
        </div>
      </div>

      <!-- AI配置区域 -->
      <div class="ai-settings-panel" v-if="showAiSettings">
        <div class="ai-settings-header">
          <span>🤖 {{ i18n.aiSettings || 'AI大模型配置' }}</span>
          <button class="settings-close-btn" @click="toggleAiSettings">
            <IconWrapper name="close" :size="14" />
          </button>
        </div>
        <div class="ai-settings-content">
          <!-- API供应商选择 -->
          <div class="setting-group">
            <label class="setting-label">{{ i18n.apiProvider || 'API供应商' }}</label>
            <select v-model="localAiProvider" class="setting-select" @change="handleProviderChange">
              <option value="tongyi">{{ i18n.tongyiQianwen || '通义千问' }}</option>
              <option value="openai">{{ i18n.openAI || 'OpenAI' }}</option>
              <option value="deepseek">{{ i18n.deepSeek || 'DeepSeek' }}</option>
              <option value="custom">{{ i18n.customApi || '自定义API' }}</option>
            </select>
          </div>

          <!-- 模型选择 -->
          <div class="setting-group" v-if="localAiProvider !== 'custom'">
            <label class="setting-label">{{ i18n.aiModel || '模型' }}</label>
            <select v-model="localAiModel" class="setting-select" @change="handleModelChange">
              <optgroup v-if="getAvailableModels().common.length > 0" :label="i18n.commonModels || '常用模型'">
                <option v-for="model in getAvailableModels().common" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </optgroup>
              <optgroup v-if="getAvailableModels().all.length > 0" :label="i18n.allModels || '全部模型'">
                <option v-for="model in getAvailableModels().all" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </optgroup>
              <option value="custom">{{ i18n.customModel || '自定义模型' }}</option>
            </select>
          </div>

          <!-- 自定义模型名称 -->
          <div class="setting-group" v-if="localAiModel === 'custom' && localAiProvider !== 'custom'">
            <label class="setting-label">{{ i18n.customModelName || '自定义模型名称' }}</label>
            <input
              v-model="localAiCustomModel"
              type="text"
              class="setting-input"
              :placeholder="i18n.customModelPlaceholder || '输入模型名称，如: gpt-4'"
              @input="handleCustomModelChange"
            />
            <div class="setting-desc">{{ i18n.customModelDesc || '输入API支持的模型名称' }}</div>
          </div>

          <!-- API密钥输入 -->
          <div class="setting-group">
            <label class="setting-label">{{ i18n.apiKey || 'API密钥' }}</label>
            <div class="setting-input-wrapper">
              <input
                v-model="localAiApiKey"
                :type="apiKeyVisible ? 'text' : 'password'"
                class="setting-input"
                :placeholder="getApiKeyPlaceholder()"
                @input="handleApiKeyChange"
              />
              <button class="toggle-visibility-btn" @click="apiKeyVisible = !apiKeyVisible">
                <IconWrapper :name="apiKeyVisible ? 'eye' : 'eyeOff'" :size="14" />
              </button>
            </div>
            <div class="setting-desc">{{ getApiKeyDescription() }}</div>
          </div>

          <!-- 自定义API端点 -->
          <div class="setting-group" v-if="localAiProvider === 'custom'">
            <label class="setting-label">{{ i18n.customEndpoint || 'API端点' }}</label>
            <input
              v-model="localAiCustomEndpoint"
              type="text"
              class="setting-input"
              placeholder="https://api.example.com/v1/chat/completions"
              @input="handleEndpointChange"
            />
            <div class="setting-desc">自定义API端点URL，用于连接自定义API服务</div>
          </div>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="super-panel-content">
        <FeatureCard
          v-for="feature in features"
          :key="feature.id"
          :feature="feature"
          :i18n="i18n"
          @action="handleFeatureAction"
          @toggle="handleFeatureToggle"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import FeatureCard from './components/FeatureCard.vue'
import type { PluginSettings } from '@/config/settings'
import { showMessage } from 'siyuan'

// AI 模型配置常量
const AI_MODELS_CONFIG = {
  tongyi: {
    common: [
      { value: 'qwen-plus', label: 'Qwen Plus (推荐)' },
      { value: 'qwen-turbo', label: 'Qwen Turbo (快速)' },
      { value: 'qwen-max', label: 'Qwen Max (最强)' }
    ],
    all: [
      { value: 'qwen-long', label: 'Qwen Long (长文本)' },
      { value: 'qwen-vl-plus', label: 'Qwen VL Plus (视觉)' },
      { value: 'qwen-vl-max', label: 'Qwen VL Max (视觉最强)' }
    ]
  },
  openai: {
    common: [
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (推荐)' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
    ],
    all: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
    ]
  },
  deepseek: {
    common: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat (推荐)' },
      { value: 'deepseek-coder', label: 'DeepSeek Coder (代码)' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (思考)' },
    ],
    all: []
  },
  custom: {
    common: [],
    all: []
  }
} as const

// 默认模型配置
const DEFAULT_MODELS = {
  tongyi: 'qwen-plus',
  openai: 'gpt-3.5-turbo',
  deepseek: 'deepseek-chat',
  custom: ''
} as const

// API 占位符配置
const API_PLACEHOLDERS = {
  tongyi: '请输入通义千问API密钥',
  openai: '请输入OpenAI API密钥',
  deepseek: '请输入DeepSeek API密钥',
  custom: '请输入自定义API密钥'
} as const

// AI 设置接口
interface AiSettings {
  provider: string
  model: string
  apiKey: string
  customEndpoint: string
}



// 国际化接口
interface I18n {
  title?: string
  enableAll?: string
  disableAll?: string
  aiSettings?: string
  refresh?: string
  close?: string
  apiProvider?: string
  tongyiQianwen?: string
  openAI?: string
  deepSeek?: string
  customApi?: string
  aiModel?: string
  commonModels?: string
  allModels?: string
  customModel?: string
  customModelName?: string
  customModelPlaceholder?: string
  customModelDesc?: string
  apiKey?: string
  tongyiQianwenPlaceholder?: string
  openAIPlaceholder?: string
  deepSeekPlaceholder?: string
  customApiPlaceholder?: string
  customEndpoint?: string
  // ... 其他 i18n 键
  [key: string]: any // 允许访问其他可能的键
}

interface Props {
  visible: boolean
  settings: PluginSettings
  i18n: I18n
}

interface Emits {
  (e: 'close'): void
  (e: 'action', action: string): void
  (e: 'toggleFeature', featureId: string, enabled: boolean): void
  (e: 'toggleAllFeatures', enabled: boolean): void
  (e: 'refresh'): Promise<void>
  (e: 'updateAiSettings', settings: AiSettings): Promise<void>
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 刷新加载状态
const isRefreshing = ref(false)

// AI配置状态
const showAiSettings = ref(false)
const apiKeyVisible = ref(false)
const localAiProvider = ref(props.settings.aiApiProvider || 'tongyi')
const localAiModel = ref(props.settings.aiModel || 'qwen-plus')
const localAiCustomModel = ref(props.settings.aiCustomModel || '')
const localAiApiKey = ref(props.settings.aiApiKey || '')
const localAiCustomEndpoint = ref(props.settings.aiCustomEndpoint || '')

// 切换AI配置面板
const toggleAiSettings = () => {
  showAiSettings.value = !showAiSettings.value
}

// 获取可用模型列表
const getAvailableModels = () => {
  return AI_MODELS_CONFIG[localAiProvider.value as keyof typeof AI_MODELS_CONFIG] || { common: [], all: [] }
}

// 获取API密钥占位符
const getApiKeyPlaceholder = () => {
  const defaultPlaceholder = API_PLACEHOLDERS[localAiProvider.value as keyof typeof API_PLACEHOLDERS] || '请输入API密钥'

  // 优先使用 i18n 中的占位符，如果没有则使用默认值
  const i18nPlaceholders: Record<string, string | undefined> = {
    tongyi: props.i18n.tongyiQianwenPlaceholder,
    openai: props.i18n.openAIPlaceholder,
    deepseek: props.i18n.deepSeekPlaceholder,
    custom: props.i18n.customApiPlaceholder
  }

  return i18nPlaceholders[localAiProvider.value] || defaultPlaceholder
}

// 获取API密钥描述
const getApiKeyDescription = () => {
  const descriptions: Record<string, string> = {
    tongyi: `${props.i18n.tongyiQianwen || '通义千问'} API密钥，用于所有AI功能`,
    openai: `${props.i18n.openAI || 'OpenAI'} API密钥，用于所有AI功能`,
    deepseek: `${props.i18n.deepSeek || 'DeepSeek'} API密钥，用于所有AI功能`,
    custom: `${props.i18n.customApi || '自定义API'} 密钥，用于所有AI功能`
  }
  return descriptions[localAiProvider.value] || 'API密钥，用于所有AI功能'
}

// 处理供应商变更
const handleProviderChange = async () => {
  // 切换供应商时，自动选择该供应商的默认模型
  localAiModel.value = DEFAULT_MODELS[localAiProvider.value as keyof typeof DEFAULT_MODELS] || ''
  await saveAiSettings()
  showMessage('供应商已更新', 2000, 'info')
}

// 处理模型变更
const handleModelChange = async () => {
  await saveAiSettings()
}

// 处理自定义模型变更
const handleCustomModelChange = async () => {
  await saveAiSettings()
}

// 处理API密钥变更
const handleApiKeyChange = async () => {
  await saveAiSettings()
}

// 处理端点变更
const handleEndpointChange = async () => {
  await saveAiSettings()
}

// 保存AI配置
const saveAiSettings = async () => {
  await emit('updateAiSettings', {
    provider: localAiProvider.value,
    model: localAiModel.value === 'custom' ? localAiCustomModel.value : localAiModel.value,
    apiKey: localAiApiKey.value,
    customEndpoint: localAiCustomEndpoint.value
  })
}

// 监听settings变化，同步本地状态
watch(() => props.settings, (newSettings) => {
  localAiProvider.value = newSettings.aiApiProvider || 'tongyi'
  localAiModel.value = newSettings.aiModel || 'qwen-plus'
  localAiCustomModel.value = newSettings.aiCustomModel || ''
  localAiApiKey.value = newSettings.aiApiKey || ''
  localAiCustomEndpoint.value = newSettings.aiCustomEndpoint || ''
}, { deep: true })

// 功能列表配置
const features = computed(() => [
  {
    id: 'tableOfContents',
    iconKey: 'tableOfContents',
    title: props.i18n.tableOfContents || '目录索引',
    desc: props.i18n.tableOfContentsDesc || '快速生成文档目录和大纲',
    enabled: props.settings.enableTableOfContents,
    actions: [
    ]
  },
  {
    id: 'imageCompressor',
    iconKey: 'imageCompressor',
    title: props.i18n.imageCompressor || '图片压缩',
    desc: props.i18n.imageCompressorDesc || '批量压缩文档中的图片',
    enabled: props.settings.enableImageCompressor,
    actions: [
      { key: 'openCompressor', label: '打开压缩器', hotkey: 'Ctrl+Alt+C' }
    ]
  },
  {
    id: 'docNavigation',
    iconKey: 'docNavigation',
    title: props.i18n.docNavigation || '文档导航',
    desc: props.i18n.docNavigationDesc || '显示父子文档导航链接',
    enabled: props.settings.enableDocNavigation,
    actions: []
  },
  {
    id: 'pageLock',
    iconKey: 'pageLock',
    title: props.i18n.pageLock || '页面锁定',
    desc: props.i18n.pageLockDesc || '锁定页面防止误编辑',
    enabled: props.settings.enablePageLock,
    actions: []
  },
  {
    id: 'wordQuery',
    iconKey: 'wordQuery',
    title: props.i18n.wordQuery || '单词查询',
    desc: props.i18n.wordQueryDesc || '快速查询单词释义',
    enabled: props.settings.enableWordQuery,
    actions: []
  },
  {
    id: 'generalSettings',
    iconKey: 'generalSettings',
    title: props.i18n.generalSettings || '通用设置',
    desc: props.i18n.generalSettingsDesc || '字体、标题、代码块等通用配置',
    enabled: props.settings.enableGeneralSettings,
    actions: []
  },
  {
    id: 'qrCode',
    iconKey: 'qrCode',
    title: props.i18n.qrCode || '二维码生成',
    desc: props.i18n.qrCodeDesc || '生成文本或链接的二维码',
    enabled: props.settings.enableQRCode,
    actions: []
  },
  {
    id: 'unitConverter',
    iconKey: 'unitConverter',
    title: props.i18n.unitConverter || '单位转换',
    desc: props.i18n.unitConverterDesc || '快速转换各种单位',
    enabled: props.settings.enableUnitConverter,
    actions: []
  },
  {
    id: 'shortcuts',
    iconKey: 'shortcuts',
    title: props.i18n.shortcuts || '快捷键面板',
    desc: props.i18n.shortcutsDesc || '查看和管理快捷键',
    enabled: props.settings.enableShortcuts,
    actions: []
  },
  {
    id: 'diskBrowser',
    iconKey: 'diskBrowser',
    title: props.i18n.diskBrowser || '本地磁盘',
    desc: props.i18n.diskBrowserDesc || '浏览本地磁盘和文件夹',
    enabled: props.settings.enableDiskBrowser,
    actions: []
  },
  {
    id: 'codeImageGenerator',
    iconKey: 'codeImageGenerator',
    title: props.i18n.codeImageGenerator || '代码图片生成',
    desc: props.i18n.enableCodeImageGeneratorDesc || '生成代码截图，支持GitHub、Mac、卡通风格',
    enabled: props.settings.enableCodeImageGenerator,
    actions: []
  },
  {
    id: 'aiContentGenerator',
    iconKey: 'aiContentGenerator',
    title: props.i18n.aiContentGenerator || 'AI信息生成',
    desc: props.i18n.aiContentGeneratorDesc || '使用AI生成Markdown格式内容，支持自定义对话和上下文',
    enabled: props.settings.enableAIContentGenerator,
    actions: []
  },
  {
    id: 'statistics',
    iconKey: 'statistics',
    title: '数据统计',
    desc: '显示笔记数据统计和分析',
    enabled: props.settings.enableStatistics,
    actions: [
      {
        key: 'openStatistics',
        label: '打开统计面板',
        hotkey: ''
      }
    ]
  },
  {
    id: 'pronunciation',
    iconKey: 'pronunciation',
    title: props.i18n.pronunciationHelp || '谐音翻译',
    desc: props.i18n.pronunciationDesc || '英文单词生成谐音记忆，中文词语翻译成英文后生成谐音',
    enabled: props.settings.enablePronunciation,
    actions: []
  },
  {
    id: 'encryption',
    iconKey: 'encryption',
    title: props.i18n.encryption || '内容加密',
    desc: props.i18n.enableEncryptionDesc || '使用 AES-256-GCM 算法对选中文本进行加密和解密',
    enabled: props.settings.enableEncryption,
    actions: []
  },
  {
    id: 'video',
    iconKey: 'video',
    title: props.i18n.videoManager || '视频管理器',
    desc: props.i18n.videoManagerDesc || '管理和播放文档中的视频文件',
    enabled: props.settings.enableVideo,
    actions: [
      { key: 'openVideoManager', label: '打开管理器', hotkey: 'Ctrl+Alt+V' }
    ]
  },
  {
    id: 'everythingSearch',
    iconKey: 'everythingSearch',
    title: props.i18n.everythingSearch || 'Everything搜索',
    desc: props.i18n.everythingSearchDesc || '本地文件快速搜索工具',
    enabled: props.settings.enableEverythingSearch,
    actions: [
      { key: 'openEverythingSearch', label: '打开搜索', hotkey: 'Ctrl+Alt+E' }
    ]
  },
  {
    id: 'systemMonitor',
    iconKey: 'systemMonitor',
    title: props.i18n.systemMonitor?.title || '系统监控',
    desc: props.i18n.systemMonitor?.description || '在状态栏显示 CPU 和内存使用情况',
    enabled: props.settings.enableSystemMonitor,
    actions: []
  },
  {
    id: 'apiReference',
    iconKey: 'apiReference',
    title: props.i18n.apiReference?.title || 'API参考',
    desc: props.i18n.enableApiReferenceDesc || '多API使用方式参考，支持思源、OpenAI、GitHub等',
    enabled: props.settings.enableApiReference,
    actions: [
      { key: 'openApiReference', label: '打开API参考', hotkey: 'Ctrl+Alt+A' }
    ]
  },
  {
    id: 'floatingToolbar',
    iconKey: 'floatingToolbar',
    title: props.i18n.floatingToolbar?.title || '浮动工具栏',
    desc: props.i18n.floatingToolbarDescription || '选中文字时显示包含多种操作的工具栏',
    enabled: props.settings.enableFloatingToolbar,
    actions: []
  },
  {
    id: 'floatingBox',
    iconKey: 'floatingBox',
    title: props.i18n.floatingBox?.title || '悬浮框',
    desc: props.i18n.floatingBox?.description || '页面右侧显示可展开的功能悬浮框',
    enabled: props.settings.enableFloatingBox,
    actions: []
  },
  {
    id: 'textDiff',
    iconKey: 'textDiff',
    title: props.i18n.textDiff?.title || '文本对比',
    desc: props.i18n.enableTextDiffDesc || '提供文本差异对比功能，支持字符、词语、行和补丁模式对比',
    enabled: props.settings.enableTextDiff,
    actions: [
      { key: 'openTextDiff', label: '打开文本对比', hotkey: '' }
    ]
  },
  {
    id: 'base64Image',
    iconKey: 'base64Image',
    title: props.i18n.base64Image || 'Base64图片转换',
    desc: props.i18n.base64ImageDesc || '图片与Base64编码相互转换',
    enabled: props.settings.enableBase64Image,
    actions: []
  },
  {
    id: 'skills',
    iconKey: 'skills',
    title: props.i18n.skills?.title || '技能库',
    desc: props.i18n.skills?.description || '管理常用的Claude技能和模板',
    enabled: props.settings.enableSkills,
    actions: []
  },
  {
    id: 'flashcardReading',
    iconKey: 'flashcardReading',
    title: props.i18n.flashcardReading?.title || '单词阅读',
    desc: props.i18n.flashcardReading?.description || '闪卡式阅读工具，支持分类和翻转',
    enabled: props.settings.enableFlashcardReading,
    actions: []
  },
  {
    id: 'flashcardQuery',
    iconKey: 'flashcardQuery',
    title: props.i18n.floatingToolbar?.queryFlashcard || '查询单词',
    desc: '在浮动工具栏中快速查询单词卡片',
    enabled: props.settings.enableFlashcardQuery,
    actions: []
  },
  {
    id: 'translate',
    iconKey: 'translate',
    title: props.i18n.floatingToolbar?.translate || '英译中替换',
    desc: '在浮动工具栏中快速翻译英文并替换',
    enabled: props.settings.enableTranslate,
    actions: []
  }
])

const handleClose = () => {
  emit('close')
}

const handleRefresh = async () => {
  if (isRefreshing.value) return

  isRefreshing.value = true
  try {
    await emit('refresh')
  } finally {
    // 注意:由于刷新会关闭并重新创建组件,这里的 finally 可能不会执行
    // 但为了安全起见,仍然保留
    isRefreshing.value = false
  }
}

const handleFeatureAction = (action: string) => {
  emit('action', action)
}

const handleFeatureToggle = (featureId: string, enabled: boolean) => {
  emit('toggleFeature', featureId, enabled)
}

const handleToggleAll = (enabled: boolean) => {
  emit('toggleAllFeatures', enabled)
}
</script>

<style scoped lang="scss">
// 引入模块样式
@use './styles/index.scss';
</style>
