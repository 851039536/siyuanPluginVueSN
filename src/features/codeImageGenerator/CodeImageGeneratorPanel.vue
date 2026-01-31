<template>
  <div class="code-image-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="panel-title">
        <IconWrapper name="codeImageGenerator" :size="20" class="panel-icon" />
        <span>{{ i18n.codeImageGenerator || '代码图片生成' }}</span>
      </div>
    </div>

      <!-- 内容区 -->
      <div class="panel-body">
        <!-- 代码输入区 -->
        <div class="input-section">
          <label class="section-label">
            {{ contentType === 'code' ? (i18nPanel.codeContent || '代码内容') : (i18nPanel.textContent || '文字内容') }}
          </label>
          <Textarea
            v-model="codeContent"
            :placeholder="contentType === 'code' ? (i18nPanel.codeContentPlaceholder || '请输入代码...') : (i18nPanel.textContentPlaceholder || '请输入文字内容...')"
            :rows="10"
            :spellcheck="false"
          />
        </div>

        <!-- 设置区 -->
        <div class="settings-section">
          <div class="settings-row">
            <!-- 内容类型 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.contentType || '内容类型' }}</label>
              <Select
                v-model="contentType"
                :options="contentTypeOptions"
                size="small"
              />
            </div>

            <!-- 语言选择(代码模式) -->
            <div class="setting-item" v-if="contentType === 'code'">
              <label class="setting-label">{{ i18nPanel.codeLanguage || '语言' }}</label>
              <Select
                v-model="selectedLanguage"
                :options="languageOptions"
                size="small"
              />
            </div>

            <!-- 风格选择 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.codeStyle || '风格' }}</label>
              <Select
                v-model="selectedStyle"
                :options="currentStyleOptions"
                size="small"
              />
            </div>
          </div>

          <div class="settings-row">
            <!-- 主题选择 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.codeTheme || '主题' }}</label>
              <Select
                v-model="selectedTheme"
                :options="themeOptions"
                size="small"
              />
            </div>

            <!-- 字体大小 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.fontSize || '字体大小' }}</label>
              <div class="size-control">
                <input
                  v-model.number="fontSize"
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  class="size-slider"
                />
                <span class="size-value">{{ fontSize }}px</span>
              </div>
            </div>
          </div>

          <!-- 装饰选项 -->
          <div class="decoration-section">
            <div class="decoration-header" @click="showDecorations = !showDecorations">
              <span class="decoration-title">{{ i18nPanel.decorations || '装饰选项' }}</span>
              <IconWrapper
                :name="showDecorations ? 'chevronUp' : 'chevronDown'"
                :size="16"
                class="decoration-toggle"
                :class="{ expanded: showDecorations }"
              />
            </div>
            <div v-if="showDecorations" class="decoration-options">
              <!-- 水印、作者、时间 -->
              <div class="decoration-group">
                <div class="decoration-group-title">{{ i18nPanel.metadataOptions || '信息标签' }}</div>
                <div class="decoration-row">
                  <Switch
                    v-model="enableWatermark"
                    :label="i18nPanel.enableWatermark || '显示水印'"
                    size="small"
                  />
                  <Input
                    v-if="enableWatermark"
                    v-model="watermarkText"
                   size="small"
                    :placeholder="i18nPanel.watermarkPlaceholder || '水印文字'"
                  />
                </div>
                <div class="decoration-row">
                  <Switch
                    v-model="enableAuthor"
                    :label="i18nPanel.enableAuthor || '显示作者'"
                    size="small"
                  />
                  <Input
                    v-if="enableAuthor"
                    v-model="authorName"
                   size="small"
                    :placeholder="i18nPanel.authorPlaceholder || '作者名称'"
                  />
                </div>
                <div class="decoration-row">
                  <Switch
                    v-model="enableTimestamp"
                    :label="i18nPanel.enableTimestamp || '显示时间'"
                    size="small"
                  />
                </div>
              </div>

              <!-- 高级样式 -->
              <div class="decoration-group">
                <div class="decoration-group-title">{{ i18nPanel.advancedStyle || '高级样式' }}</div>

                <div class="decoration-slider-row">
                  <label class="slider-label">{{ i18nPanel.borderWidth || '边框宽度' }}</label>
                  <div class="slider-control">
                    <input
                      v-model.number="borderWidth"
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      class="mini-slider"
                    />
                    <span class="slider-value">{{ borderWidth }}px</span>
                  </div>
                </div>

                <div class="decoration-slider-row">
                  <label class="slider-label">{{ i18nPanel.borderRadius || '圆角大小' }}</label>
                  <div class="slider-control">
                    <input
                      v-model.number="borderRadius"
                      type="range"
                      min="0"
                      max="32"
                      step="2"
                      class="mini-slider"
                    />
                    <span class="slider-value">{{ borderRadius }}px</span>
                  </div>
                </div>

                <div class="decoration-slider-row">
                  <label class="slider-label">{{ i18nPanel.paddingSize || '内边距' }}</label>
                  <div class="slider-control">
                    <input
                      v-model.number="paddingSize"
                      type="range"
                      min="0"
                      max="48"
                      step="4"
                      class="mini-slider"
                    />
                    <span class="slider-value">{{ paddingSize }}px</span>
                  </div>
                </div>

                <div class="decoration-slider-row">
                  <label class="slider-label">{{ i18nPanel.backgroundOpacity || '背景透明度' }}</label>
                  <div class="slider-control">
                    <input
                      v-model.number="backgroundOpacity"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      class="mini-slider"
                    />
                    <span class="slider-value">{{ backgroundOpacity }}%</span>
                  </div>
                </div>

                <div class="decoration-slider-row">
                  <label class="slider-label">{{ i18nPanel.shadowIntensity || '阴影强度' }}</label>
                  <div class="slider-control">
                    <input
                      v-model.number="shadowIntensity"
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      class="mini-slider"
                    />
                    <span class="slider-value">{{ shadowIntensity }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 预览区 -->
        <div class="preview-section">
          <label class="section-label">{{ i18nPanel.preview || '预览' }}</label>
          <div class="preview-container">
            <!-- 代码模式预览 -->
            <div
              v-if="contentType === 'code'"
              class="code-preview"
              :class="[`style-${selectedStyle}`, `theme-${selectedTheme}`]"
              :style="previewCustomStyle"
              ref="codePreview"
            >
              <!-- 窗口装饰 -->
              <div class="window-header">
                <div class="window-buttons">
                  <span class="window-btn close"></span>
                  <span class="window-btn minimize"></span>
                  <span class="window-btn maximize"></span>
                </div>
                <div class="window-title">{{ getLanguageDisplay() }}</div>
              </div>
              <!-- 代码内容 -->
              <div class="code-content" :style="{ fontSize: fontSize + 'px' }">
                <pre><code v-html="highlightedCode"></code></pre>
              </div>
              <!-- 装饰元素 -->
              <div v-if="enableWatermark || enableAuthor || enableTimestamp" class="decorations">
                <div v-if="enableWatermark" class="watermark">{{ watermarkText }}</div>
                <div v-if="enableAuthor || enableTimestamp" class="metadata">
                  <span v-if="enableAuthor" class="author">{{ authorName }}</span>
                  <span v-if="enableTimestamp" class="timestamp">{{ currentTime }}</span>
                </div>
              </div>
            </div>

            <!-- 文字模式预览 -->
            <div
              v-else
              class="text-preview"
              :class="[`text-style-${selectedStyle}`, `theme-${selectedTheme}`]"
              :style="previewCustomStyle"
              ref="codePreview"
            >
              <div class="text-content" :style="{ fontSize: fontSize + 'px' }">
                <div class="text-body">{{ codeContent || '在这里输入文字...' }}</div>
              </div>
              <!-- 装饰元素 -->
              <div v-if="enableWatermark || enableAuthor || enableTimestamp" class="decorations">
                <div v-if="enableWatermark" class="watermark">{{ watermarkText }}</div>
                <div v-if="enableAuthor || enableTimestamp" class="metadata">
                  <span v-if="enableAuthor" class="author">{{ authorName }}</span>
                  <span v-if="enableTimestamp" class="timestamp">{{ currentTime }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
import Input from '@/components/Input.vue'
import Textarea from '@/components/Textarea.vue'
import Select from '@/components/Select.vue'
import Switch from '@/components/Switch.vue'
import IconWrapper from '@/components/IconWrapper.vue'
import type { SelectOption } from '@/components/Select.vue'

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
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  i18n: () => ({})
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
        showMessage(props.i18n.codeImageGeneratorPanel?.copyFailed || '复制失败', DEFAULTS.messageDuration, 'error')
        return
      }

      try {
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        showMessage(props.i18n.codeImageGeneratorPanel?.imageCopied || '图片已复制到剪贴板', DEFAULTS.messageDuration, 'info')
      } catch (err) {
        console.error('复制失败:', getErrorMsg(err))
        showMessage(props.i18n.codeImageGeneratorPanel?.copyFailed || '复制失败', DEFAULTS.messageDuration, 'error')
      }
    }, 'image/png', 1.0) // 使用最高质量
  } catch (error) {
    console.error('生成图片失败:', getErrorMsg(error))
    showMessage(props.i18n.codeImageGeneratorPanel?.generateFailed || '生成图片失败', DEFAULTS.messageDuration, 'error')
  }
}

// 下载图片
const downloadImage = async (): Promise<void> => {
  if (!codeContent.value) return

  try {
    const canvas = await generateCanvas()
    const link = document.createElement('a')
    link.download = createFilename()
    link.href = canvas.toDataURL('image/png', 1.0) // 使用最高质量
    link.click()

    showMessage(props.i18n.codeImageGeneratorPanel?.imageDownloaded || '图片已下载', DEFAULTS.messageDuration, 'info')
  } catch (error) {
    console.error('下载失败:', getErrorMsg(error))
    showMessage(props.i18n.codeImageGeneratorPanel?.downloadFailed || '下载失败', DEFAULTS.messageDuration, 'error')
  }
}

</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
