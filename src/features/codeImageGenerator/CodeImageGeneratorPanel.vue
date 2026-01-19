<template>
  <div class="code-image-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="panel-title">
        <svg class="panel-icon" viewBox="0 0 24 24">
          <path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
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
          <textarea
            v-model="codeContent"
            class="code-textarea"
            :placeholder="contentType === 'code' ? (i18nPanel.codeContentPlaceholder || '请输入代码...') : (i18nPanel.textContentPlaceholder || '请输入文字内容...')"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- 设置区 -->
        <div class="settings-section">
          <div class="settings-row">
            <!-- 内容类型 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.contentType || '内容类型' }}</label>
              <select v-model="contentType" class="setting-select">
                <option value="code">{{ i18nPanel.codeMode || '代码' }}</option>
                <option value="text">{{ i18nPanel.textMode || '文字' }}</option>
              </select>
            </div>

            <!-- 语言选择(代码模式) -->
            <div class="setting-item" v-if="contentType === 'code'">
              <label class="setting-label">{{ i18nPanel.codeLanguage || '语言' }}</label>
              <select v-model="selectedLanguage" class="setting-select">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="csharp">C#</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="php">PHP</option>
                <option value="ruby">Ruby</option>
                <option value="swift">Swift</option>
                <option value="kotlin">Kotlin</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="scss">SCSS</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="markdown">Markdown</option>
                <option value="sql">SQL</option>
                <option value="bash">Bash</option>
              </select>
            </div>

            <!-- 风格选择 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.codeStyle || '风格' }}</label>
              <select v-model="selectedStyle" class="setting-select">
                <!-- 代码模式风格 -->
                <template v-if="contentType === 'code'">
                  <option value="github">{{ i18nPanel.styles?.github || 'GitHub' }}</option>
                  <option value="mac">{{ i18nPanel.styles?.mac || 'Mac' }}</option>
                  <option value="cartoon">{{ i18nPanel.styles?.cartoon || '卡通' }}</option>
                  <option value="wave">{{ i18nPanel.styles?.wave || '波浪渐变' }}</option>
                  <option value="glass">{{ i18nPanel.styles?.glass || '玻璃拟态' }}</option>
                  <option value="neon">{{ i18nPanel.styles?.neon || '霓虹灯' }}</option>
                  <option value="3d">{{ i18nPanel.styles?.threeD || '3D立体' }}</option>
                </template>
                <!-- 文字模式风格 -->
                <template v-else>
                  <option value="quote">{{ i18nPanel.styles?.quote || '名人名言' }}</option>
                  <option value="poetry">{{ i18nPanel.styles?.poetry || '诗词意境' }}</option>
                  <option value="note">{{ i18nPanel.styles?.note || '手写便签' }}</option>
                  <option value="poster">{{ i18nPanel.styles?.poster || '激励海报' }}</option>
                  <option value="card">{{ i18nPanel.styles?.card || '引用卡片' }}</option>
                  <option value="newspaper">{{ i18nPanel.styles?.newspaper || '复古报纸' }}</option>
                  <option value="gradient">{{ i18nPanel.styles?.gradientText || '渐变文字' }}</option>
                </template>
              </select>
            </div>
          </div>

          <div class="settings-row">
            <!-- 主题选择 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18nPanel.codeTheme || '主题' }}</label>
              <select v-model="selectedTheme" class="setting-select">
                <option value="light">{{ i18nPanel.lightTheme || '浅色' }}</option>
                <option value="dark">{{ i18nPanel.darkTheme || '深色' }}</option>
              </select>
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
              <svg class="decoration-toggle" :class="{ expanded: showDecorations }" viewBox="0 0 24 24">
                <path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
              </svg>
            </div>
            <div v-if="showDecorations" class="decoration-options">
              <!-- 水印、作者、时间 -->
              <div class="decoration-group">
                <div class="decoration-group-title">{{ i18nPanel.metadataOptions || '信息标签' }}</div>
                <div class="decoration-row">
                  <label class="decoration-checkbox">
                    <input type="checkbox" v-model="enableWatermark" />
                    <span>{{ i18nPanel.enableWatermark || '显示水印' }}</span>
                  </label>
                  <input
                    v-if="enableWatermark"
                    v-model="watermarkText"
                    class="decoration-input"
                    :placeholder="i18nPanel.watermarkPlaceholder || '水印文字'"
                  />
                </div>
                <div class="decoration-row">
                  <label class="decoration-checkbox">
                    <input type="checkbox" v-model="enableAuthor" />
                    <span>{{ i18nPanel.enableAuthor || '显示作者' }}</span>
                  </label>
                  <input
                    v-if="enableAuthor"
                    v-model="authorName"
                    class="decoration-input"
                    :placeholder="i18nPanel.authorPlaceholder || '作者名称'"
                  />
                </div>
                <div class="decoration-row">
                  <label class="decoration-checkbox">
                    <input type="checkbox" v-model="enableTimestamp" />
                    <span>{{ i18nPanel.enableTimestamp || '显示时间' }}</span>
                  </label>
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
          <div class="preview-container" ref="previewContainer">
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
        <button class="btn-action" @click="copyImage" :disabled="!codeContent">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <span>{{ i18nPanel.copyImage || '复制图片' }}</span>
        </button>
        <button class="btn-action btn-primary" @click="downloadImage" :disabled="!codeContent">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
          </svg>
          <span>{{ i18nPanel.downloadImage || '下载图片' }}</span>
        </button>
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

interface I18nPanelKeys {
  contentType?: string
  codeMode?: string
  textMode?: string
  codeContent?: string
  textContent?: string
  codeContentPlaceholder?: string
  textContentPlaceholder?: string
  codeLanguage?: string
  codeStyle?: string
  styles?: {
    github?: string
    mac?: string
    cartoon?: string
    wave?: string
    glass?: string
    neon?: string
    threeD?: string
    quote?: string
    poetry?: string
    note?: string
    poster?: string
    card?: string
    newspaper?: string
    gradientText?: string
  }
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
  visible: boolean
  content?: string
  i18n?: I18nKeys
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

const emit = defineEmits<Emits>()

// 计算属性：简化 i18n 访问
const i18nPanel = computed<I18nPanelKeys>(() => props.i18n?.codeImageGeneratorPanel || {})

// 常量定义
const DEFAULTS = {
  fontSize: 14,
  borderWidth: 1,
  borderRadius: 8,
  paddingSize: 16,
  backgroundOpacity: 100,
  shadowIntensity: 50,
  watermarkText: 'SiYuan Notes',
  selectedLanguage: 'javascript',
  selectedStyle: 'github',
  selectedTheme: 'light',
  minFontSize: 12,
  maxFontSize: 24,
  maxBorderWidth: 10,
  maxBorderRadius: 32,
  maxPaddingSize: 48,
  minShadowIntensity: 0,
  maxShadowIntensity: 100,
  scaleMultiplier: 3,
  baseShadowOffset: 4,
  baseShadowBlur: 12,
  baseShadowOpacity: 0.1,
  shadowOpacityStep: 500,
  messageDuration: 3000
} as const

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
    console.error('代码高亮失败:', error instanceof Error ? error.message : String(error))
    return codeContent.value
  }
})

// 获取语言显示名称
const getLanguageDisplay = (): string => {
  const languageMap: Record<string, string> = {
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
  }
  return languageMap[selectedLanguage.value] || selectedLanguage.value
}

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
const previewCustomStyle = computed<CSSProperties>(() => {
  return {
    borderRadius: `${borderRadius.value}px`,
    padding: `${paddingSize.value}px`,
    opacity: backgroundOpacity.value / 100,
    boxShadow: `0 ${DEFAULTS.baseShadowOffset + shadowIntensity.value / 10}px ${DEFAULTS.baseShadowBlur + shadowIntensity.value / 5}px rgba(0, 0, 0, ${DEFAULTS.baseShadowOpacity + shadowIntensity.value / DEFAULTS.shadowOpacityStep})`,
    borderWidth: borderWidth.value > 0 ? `${borderWidth.value}px` : '0',
    borderStyle: borderWidth.value > 0 ? 'solid' : 'none'
  }
})

// 生成画布的公共方法
const generateCanvas = async (): Promise<HTMLCanvasElement> => {
  if (!codePreview.value) {
    throw new Error('Preview element not found')
  }

  // 使用设备像素比,确保在高分辨率屏幕上清晰
  const dpr = window.devicePixelRatio || 1
  const scale = Math.max(dpr, DEFAULTS.scaleMultiplier) // 提高到至少 3 倍缩放

  // 获取预览元素的实际背景色
  const computedStyle = window.getComputedStyle(codePreview.value)
  const bgColor = computedStyle.backgroundColor || 'transparent'

  return await html2canvas(codePreview.value, {
    backgroundColor: bgColor, // 使用预览元素的实际背景色
    scale: scale,
    logging: false,
    useCORS: true,
    allowTaint: true,
    // 提高渲染质量
    width: codePreview.value.scrollWidth,
    height: codePreview.value.scrollHeight,
    windowWidth: codePreview.value.scrollWidth,
    windowHeight: codePreview.value.scrollHeight,
    imageTimeout: 0,
    removeContainer: true
  })
}

// 生成文件名
const createFilename = (): string => {
  const timestamp = Date.now()
  return contentType.value === 'code'
    ? `code-${selectedLanguage.value}-${timestamp}.png`
    : `text-${timestamp}.png`
}

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
        console.error('复制失败:', err instanceof Error ? err.message : String(err))
        showMessage(props.i18n.codeImageGeneratorPanel?.copyFailed || '复制失败', DEFAULTS.messageDuration, 'error')
      }
    }, 'image/png', 1.0) // 使用最高质量
  } catch (error) {
    console.error('生成图片失败:', error instanceof Error ? error.message : String(error))
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
    console.error('下载失败:', error instanceof Error ? error.message : String(error))
    showMessage(props.i18n.codeImageGeneratorPanel?.downloadFailed || '下载失败', DEFAULTS.messageDuration, 'error')
  }
}

</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
