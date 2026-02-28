<template>
  <div class="code-image-panel">
    <!-- 头部 -->
    <PanelHeader :title="i18n.codeImageGenerator || '代码图片生成'" />

    <!-- 内容区 -->
    <div class="panel-body">
      <!-- 代码输入区 -->
      <ContentInput
        v-model="codeContent"
        :content-type="contentType"
        :code-label="i18nPanel.codeContent || '代码内容'"
        :text-label="i18nPanel.textContent || '文字内容'"
        :code-placeholder="i18nPanel.codeContentPlaceholder || '请输入代码...'"
        :text-placeholder="i18nPanel.textContentPlaceholder || '请输入文字内容...'"
      />

      <!-- 设置区 -->
      <SettingsSection
        v-model:content-type="contentType"
        v-model:selected-language="selectedLanguage"
        v-model:selected-style="selectedStyle"
        v-model:selected-theme="selectedTheme"
        v-model:font-size="fontSize"
        :content-type-label="i18nPanel.contentType || '内容类型'"
        :language-label="i18nPanel.codeLanguage || '语言'"
        :style-label="i18nPanel.codeStyle || '风格'"
        :theme-label="i18nPanel.codeTheme || '主题'"
        :font-size-label="i18nPanel.fontSize || '字体大小'"
        :content-type-options="contentTypeOptions"
        :language-options="languageOptions"
        :style-options="currentStyleOptions"
        :theme-options="themeOptions"
      >
        <template #decorations>
          <DecorationSettings
            :expanded="showDecorations"
            @toggle="showDecorations = !showDecorations"
            :title="i18nPanel.decorations || '装饰选项'"
            :metadata-title="i18nPanel.metadataOptions || '信息标签'"
            :advanced-style-title="i18nPanel.advancedStyle || '高级样式'"
            v-model:enable-watermark="enableWatermark"
            v-model:watermark-text="watermarkText"
            v-model:enable-author="enableAuthor"
            v-model:author-name="authorName"
            v-model:enable-timestamp="enableTimestamp"
            v-model:border-width="borderWidth"
            v-model:border-radius="borderRadius"
            v-model:padding-size="paddingSize"
            v-model:background-opacity="backgroundOpacity"
            v-model:shadow-intensity="shadowIntensity"
            :watermark-label="i18nPanel.enableWatermark || '显示水印'"
            :watermark-placeholder="i18nPanel.watermarkPlaceholder || '水印文字'"
            :author-label="i18nPanel.enableAuthor || '显示作者'"
            :author-placeholder="i18nPanel.authorPlaceholder || '作者名称'"
            :timestamp-label="i18nPanel.enableTimestamp || '显示时间'"
            :border-width-label="i18nPanel.borderWidth || '边框宽度'"
            :border-radius-label="i18nPanel.borderRadius || '圆角大小'"
            :padding-label="i18nPanel.paddingSize || '内边距'"
            :opacity-label="i18nPanel.backgroundOpacity || '背景透明度'"
            :shadow-label="i18nPanel.shadowIntensity || '阴影强度'"
          />
        </template>
      </SettingsSection>

      <!-- 预览区 -->
      <PreviewArea
        v-model:preview-ref="codePreview"
        :content-type="contentType"
        :selected-style="selectedStyle"
        :selected-theme="selectedTheme"
        :font-size="fontSize"
        :custom-style="previewCustomStyle"
        :highlighted-code="highlightedCode"
        :language-display="getLanguageDisplay()"
        :content="codeContent"
        :default-text="i18nPanel.textContentPlaceholder || '在这里输入文字...'"
        :current-time="currentTime"
        :show-decorations="enableWatermark || enableAuthor || enableTimestamp"
        :enable-watermark="enableWatermark"
        :watermark-text="watermarkText"
        :enable-author="enableAuthor"
        :author-name="authorName"
        :enable-timestamp="enableTimestamp"
        :preview-label="i18nPanel.preview || '预览'"
      />
    </div>

    <!-- 底部操作 -->
    <div class="panel-footer">
      <Button variant="secondary" @click="copyImage" :disabled="!codeContent" icon="contentCopy">
        {{ i18nPanel.copyImage || '复制图片' }}
      </Button>
      <Button variant="primary" @click="downloadImage" :disabled="!codeContent" icon="download">
        {{ i18nPanel.downloadImage || '下载图片' }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { showMessage } from 'siyuan'
import html2canvas from 'html2canvas'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'
import Button from '@/components/Button.vue'
import type { SelectOption } from '@/components/Select.vue'
import PanelHeader from './components/PanelHeader.vue'
import ContentInput from './components/ContentInput.vue'
import SettingsSection from './components/SettingsSection.vue'
import DecorationSettings from './components/DecorationSettings.vue'
import PreviewArea from './components/PreviewArea.vue'

// 错误消息工具函数
const getErrorMsg = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// 语言配置（统一管理，避免重复）
const LANGUAGE_MAP = Object.freeze({
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  sql: 'SQL',
  bash: 'Bash'
} as const)

// Select 组件选项数据（从语言配置生成）
const contentTypeOptions: SelectOption[] = [
  { value: 'code', label: '代码' },
  { value: 'text', label: '文字' }
]

const languageOptions: SelectOption[] = Object.entries(LANGUAGE_MAP).map(([value, label]) => ({ value, label }))

const codeStyleOptions: SelectOption[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'mac', label: 'Mac' },
  { value: 'cartoon', label: '卡通' },
  { value: 'wave', label: '波浪渐变' },
  { value: 'glass', label: '玻璃拟态' },
  { value: 'neon', label: '霓虹灯' },
  { value: '3d', label: '3D立体' }
]

const textStyleOptions: SelectOption[] = [
  { value: 'quote', label: '名人名言' },
  { value: 'poetry', label: '诗词意境' },
  { value: 'note', label: '手写便签' },
  { value: 'poster', label: '激励海报' },
  { value: 'card', label: '引用卡片' },
  { value: 'newspaper', label: '复古报纸' },
  { value: 'gradient', label: '渐变文字' }
]

const themeOptions: SelectOption[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]

interface I18nPanelKeys {
  contentType?: string
  codeContent?: string
  textContent?: string
  codeContentPlaceholder?: string
  textContentPlaceholder?: string
  codeLanguage?: string
  codeStyle?: string
  codeTheme?: string
  lightTheme?: string
  darkTheme?: string
  fontSize?: string
  decorations?: string
  metadataOptions?: string
  advancedStyle?: string
  enableWatermark?: string
  watermarkPlaceholder?: string
  enableAuthor?: string
  authorPlaceholder?: string
  enableTimestamp?: string
  borderWidth?: string
  borderRadius?: string
  paddingSize?: string
  backgroundOpacity?: string
  shadowIntensity?: string
  preview?: string
  copyImage?: string
  downloadImage?: string
  imageCopied?: string
  imageDownloaded?: string
  generateFailed?: string
  copyFailed?: string
  downloadFailed?: string
}

interface I18nKeys {
  codeImageGenerator?: string
  codeImageGeneratorPanel?: I18nPanelKeys
}

interface Props {
  content?: string
  i18n?: I18nKeys
  plugin?: any
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  i18n: () => ({}),
  plugin: undefined
})

// 计算属性：简化 i18n 访问
const i18nPanel = computed<I18nPanelKeys>(() => props.i18n?.codeImageGeneratorPanel || {})

// 计算属性：根据内容类型返回对应的风格选项
const currentStyleOptions = computed<SelectOption[]>(() => {
  return contentType.value === 'code' ? codeStyleOptions : textStyleOptions
})

// 常量定义
const DEFAULTS = Object.freeze({
  fontSize: 14,
  borderWidth: 1,
  borderRadius: 8,
  paddingSize: 16,
  backgroundOpacity: 100,
  shadowIntensity: 50,
  watermarkText: 'SiYuan Notes',
  selectedLanguage: 'javascript' as const,
  selectedStyle: 'github' as const,
  selectedTheme: 'light' as const,
  scaleMultiplier: 3,
  messageDuration: 3000
})

// 状态
const contentType = ref<'code' | 'text'>('code')
const codeContent = ref<string>(props.content || '')
const selectedLanguage = ref<string>(DEFAULTS.selectedLanguage)
const selectedStyle = ref<string>(DEFAULTS.selectedStyle)
const selectedTheme = ref<string>(DEFAULTS.selectedTheme)
const fontSize = ref<number>(DEFAULTS.fontSize)
const codePreview = ref<HTMLDivElement>()

// 装饰选项
const showDecorations = ref<boolean>(false)
const enableWatermark = ref<boolean>(false)
const watermarkText = ref<string>(DEFAULTS.watermarkText)
const enableAuthor = ref<boolean>(false)
const authorName = ref<string>('')
const enableTimestamp = ref<boolean>(false)

// 高级装饰选项
const borderWidth = ref<number>(DEFAULTS.borderWidth)
const borderRadius = ref<number>(DEFAULTS.borderRadius)
const paddingSize = ref<number>(DEFAULTS.paddingSize)
const backgroundOpacity = ref<number>(DEFAULTS.backgroundOpacity)
const shadowIntensity = ref<number>(DEFAULTS.shadowIntensity)

// 监听props变化
watch(() => props.content, (newContent) => {
  if (newContent) {
    codeContent.value = newContent
  }
})

// 高亮代码
const highlightedCode = computed<string>(() => {
  if (!codeContent.value) {
    return '<span style="color: #999;">在这里输入代码...</span>'
  }

  try {
    const result = hljs.highlight(codeContent.value, { language: selectedLanguage.value })
    return result.value
  } catch (error) {
    console.error('代码高亮失败:', getErrorMsg(error))
    return codeContent.value
  }
})

// 获取语言显示名称
const getLanguageDisplay = (): string =>
  LANGUAGE_MAP[selectedLanguage.value as keyof typeof LANGUAGE_MAP] ?? selectedLanguage.value

// 当前时间
const currentTime = computed<string>(() => {
  const now = new Date()
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

// 预览自定义样式
const previewCustomStyle = computed<CSSProperties>(() => ({
  borderRadius: `${borderRadius.value}px`,
  padding: `${paddingSize.value}px`,
  opacity: backgroundOpacity.value / 100,
  boxShadow: `0 ${4 + shadowIntensity.value / 10}px ${12 + shadowIntensity.value / 5}px rgba(0, 0, 0, ${0.1 + shadowIntensity.value * 0.003})`,
  borderWidth: borderWidth.value > 0 ? `${borderWidth.value}px` : '0',
  borderStyle: borderWidth.value > 0 ? 'solid' : 'none'
}))

// 生成画布的公共方法
const generateCanvas = async (): Promise<HTMLCanvasElement> => {
  if (!codePreview.value) {
    throw new Error('Preview element not found')
  }

  const dpr = window.devicePixelRatio ?? 1
  const scale = Math.max(dpr, DEFAULTS.scaleMultiplier)
  const computedStyle = window.getComputedStyle(codePreview.value)
  const bgColor = computedStyle.backgroundColor ?? 'transparent'

  return await html2canvas(codePreview.value, {
    backgroundColor: bgColor,
    scale,
    logging: false,
    useCORS: true,
    allowTaint: true,
    width: codePreview.value.scrollWidth,
    height: codePreview.value.scrollHeight,
    windowWidth: codePreview.value.scrollWidth,
    windowHeight: codePreview.value.scrollHeight,
    imageTimeout: 0,
    removeContainer: true
  })
}

// 生成文件名
const createFilename = (): string =>
  `${contentType.value === 'code' ? `code-${selectedLanguage.value}` : 'text'}-${Date.now()}.png`

// 复制图片到剪贴板
const copyImage = async (): Promise<void> => {
  if (!codeContent.value) return

  try {
    const canvas = await generateCanvas()

    canvas.toBlob(async (blob) => {
      if (!blob) {
        showMessage(props.i18n?.codeImageGeneratorPanel?.copyFailed || '复制失败', DEFAULTS.messageDuration, 'error')
        return
      }

      try {
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        showMessage(props.i18n?.codeImageGeneratorPanel?.imageCopied || '图片已复制到剪贴板', DEFAULTS.messageDuration, 'info')
      } catch (err) {
        console.error('复制失败:', getErrorMsg(err))
        showMessage(props.i18n?.codeImageGeneratorPanel?.copyFailed || '复制失败', DEFAULTS.messageDuration, 'error')
      }
    }, 'image/png', 1.0)
  } catch (error) {
    console.error('生成图片失败:', getErrorMsg(error))
    showMessage(props.i18n?.codeImageGeneratorPanel?.generateFailed || '生成图片失败', DEFAULTS.messageDuration, 'error')
  }
}

// 下载图片
const downloadImage = async (): Promise<void> => {
  if (!codeContent.value) return

  try {
    const canvas = await generateCanvas()
    const link = document.createElement('a')
    link.download = createFilename()
    link.href = canvas.toDataURL('image/png', 1.0)
    link.click()

    showMessage(props.i18n?.codeImageGeneratorPanel?.imageDownloaded || '图片已下载', DEFAULTS.messageDuration, 'info')
  } catch (error) {
    console.error('下载失败:', getErrorMsg(error))
    showMessage(props.i18n?.codeImageGeneratorPanel?.downloadFailed || '下载失败', DEFAULTS.messageDuration, 'error')
  }
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
