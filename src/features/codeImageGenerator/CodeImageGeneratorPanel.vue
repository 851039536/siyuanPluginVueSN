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
            {{ contentType === 'code' ? (i18n.codeContent || '代码内容') : (i18n.textContent || '文字内容') }}
          </label>
          <textarea
            v-model="codeContent"
            class="code-textarea"
            :placeholder="contentType === 'code' ? (i18n.codeContentPlaceholder || '请输入代码...') : (i18n.textContentPlaceholder || '请输入文字内容...')"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- 设置区 -->
        <div class="settings-section">
          <div class="settings-row">
            <!-- 内容类型 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18n.contentType || '内容类型' }}</label>
              <select v-model="contentType" class="setting-select">
                <option value="code">{{ i18n.codeMode || '代码' }}</option>
                <option value="text">{{ i18n.textMode || '文字' }}</option>
              </select>
            </div>

            <!-- 语言选择(代码模式) -->
            <div class="setting-item" v-if="contentType === 'code'">
              <label class="setting-label">{{ i18n.codeLanguage || '语言' }}</label>
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
              <label class="setting-label">{{ i18n.codeStyle || '风格' }}</label>
              <select v-model="selectedStyle" class="setting-select">
                <!-- 代码模式风格 -->
                <template v-if="contentType === 'code'">
                  <option value="github">{{ i18n.githubStyle || 'GitHub' }}</option>
                  <option value="mac">{{ i18n.macStyle || 'Mac' }}</option>
                  <option value="cartoon">{{ i18n.cartoonStyle || '卡通' }}</option>
                  <option value="wave">{{ i18n.waveStyle || '波浪渐变' }}</option>
                  <option value="glass">{{ i18n.glassStyle || '玻璃拟态' }}</option>
                  <option value="neon">{{ i18n.neonStyle || '霓虹灯' }}</option>
                  <option value="3d">{{ i18n.threeDStyle || '3D立体' }}</option>
                </template>
                <!-- 文字模式风格 -->
                <template v-else>
                  <option value="quote">{{ i18n.quoteStyle || '名人名言' }}</option>
                  <option value="poetry">{{ i18n.poetryStyle || '诗词意境' }}</option>
                  <option value="note">{{ i18n.noteStyle || '手写便签' }}</option>
                  <option value="poster">{{ i18n.posterStyle || '激励海报' }}</option>
                  <option value="card">{{ i18n.cardStyle || '引用卡片' }}</option>
                  <option value="newspaper">{{ i18n.newspaperStyle || '复古报纸' }}</option>
                  <option value="gradient">{{ i18n.gradientTextStyle || '渐变文字' }}</option>
                </template>
              </select>
            </div>
          </div>

          <div class="settings-row">
            <!-- 主题选择 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18n.codeTheme || '主题' }}</label>
              <select v-model="selectedTheme" class="setting-select">
                <option value="light">{{ i18n.lightTheme || '浅色' }}</option>
                <option value="dark">{{ i18n.darkTheme || '深色' }}</option>
              </select>
            </div>

            <!-- 字体大小 -->
            <div class="setting-item">
              <label class="setting-label">{{ i18n.fontSize || '字体大小' }}</label>
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
              <span class="decoration-title">{{ i18n.decorations || '装饰选项' }}</span>
              <svg class="decoration-toggle" :class="{ expanded: showDecorations }" viewBox="0 0 24 24">
                <path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
              </svg>
            </div>
            <div v-if="showDecorations" class="decoration-options">
              <!-- 水印、作者、时间 -->
              <div class="decoration-group">
                <div class="decoration-group-title">{{ i18n.metadataOptions || '信息标签' }}</div>
                <div class="decoration-row">
                  <label class="decoration-checkbox">
                    <input type="checkbox" v-model="enableWatermark" />
                    <span>{{ i18n.enableWatermark || '显示水印' }}</span>
                  </label>
                  <input
                    v-if="enableWatermark"
                    v-model="watermarkText"
                    class="decoration-input"
                    :placeholder="i18n.watermarkPlaceholder || '水印文字'"
                  />
                </div>
                <div class="decoration-row">
                  <label class="decoration-checkbox">
                    <input type="checkbox" v-model="enableAuthor" />
                    <span>{{ i18n.enableAuthor || '显示作者' }}</span>
                  </label>
                  <input
                    v-if="enableAuthor"
                    v-model="authorName"
                    class="decoration-input"
                    :placeholder="i18n.authorPlaceholder || '作者名称'"
                  />
                </div>
                <div class="decoration-row">
                  <label class="decoration-checkbox">
                    <input type="checkbox" v-model="enableTimestamp" />
                    <span>{{ i18n.enableTimestamp || '显示时间' }}</span>
                  </label>
                </div>
              </div>

              <!-- 高级样式 -->
              <div class="decoration-group">
                <div class="decoration-group-title">{{ i18n.advancedStyle || '高级样式' }}</div>

                <div class="decoration-slider-row">
                  <label class="slider-label">{{ i18n.borderWidth || '边框宽度' }}</label>
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
                  <label class="slider-label">{{ i18n.borderRadius || '圆角大小' }}</label>
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
                  <label class="slider-label">{{ i18n.paddingSize || '内边距' }}</label>
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
                  <label class="slider-label">{{ i18n.backgroundOpacity || '背景透明度' }}</label>
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
                  <label class="slider-label">{{ i18n.shadowIntensity || '阴影强度' }}</label>
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
          <label class="section-label">{{ i18n.preview || '预览' }}</label>
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
          <span>{{ i18n.copyImage || '复制图片' }}</span>
        </button>
        <button class="btn-action btn-primary" @click="downloadImage" :disabled="!codeContent">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
          </svg>
          <span>{{ i18n.downloadImage || '下载图片' }}</span>
        </button>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { showMessage } from 'siyuan'
import html2canvas from 'html2canvas'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

interface Props {
  visible: boolean
  content?: string
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
const contentType = ref<'code' | 'text'>('code')
const codeContent = ref(props.content || '')
const selectedLanguage = ref('javascript')
const selectedStyle = ref('github')
const selectedTheme = ref('light')
const fontSize = ref(14)
const codePreview = ref<HTMLDivElement>()

// 装饰选项
const showDecorations = ref(false)
const enableWatermark = ref(false)
const watermarkText = ref('SiYuan Notes')
const enableAuthor = ref(false)
const authorName = ref('')
const enableTimestamp = ref(false)

// 高级装饰选项
const borderWidth = ref(1)
const borderRadius = ref(8)
const paddingSize = ref(16)
const backgroundOpacity = ref(100)
const shadowIntensity = ref(50)

// 监听props变化
watch(() => props.content, (newContent) => {
  if (newContent) {
    codeContent.value = newContent
  }
})

// 高亮代码
const highlightedCode = computed(() => {
  if (!codeContent.value) {
    return '<span style="color: #999;">在这里输入代码...</span>'
  }

  try {
    const result = hljs.highlight(codeContent.value, { language: selectedLanguage.value })
    return result.value
  } catch (error) {
    console.error('代码高亮失败:', error)
    return codeContent.value
  }
})

// 获取语言显示名称
const getLanguageDisplay = () => {
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
const currentTime = computed(() => {
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
const previewCustomStyle = computed(() => {
  return {
    borderRadius: `${borderRadius.value}px`,
    padding: `${paddingSize.value}px`,
    opacity: backgroundOpacity.value / 100,
    boxShadow: `0 ${4 + shadowIntensity.value / 10}px ${12 + shadowIntensity.value / 5}px rgba(0, 0, 0, ${0.1 + shadowIntensity.value / 500})`,
    borderWidth: borderWidth.value > 0 ? `${borderWidth.value}px` : '0',
    borderStyle: borderWidth.value > 0 ? 'solid' : 'none'
  }
})

// 复制图片到剪贴板
const copyImage = async () => {
  if (!codePreview.value || !codeContent.value) return

  try {
    // 使用设备像素比,确保在高分辨率屏幕上清晰
    const dpr = window.devicePixelRatio || 1
    const scale = Math.max(dpr, 3) // 提高到至少 3 倍缩放

    // 获取预览元素的实际背景色
    const computedStyle = window.getComputedStyle(codePreview.value)
    const bgColor = computedStyle.backgroundColor || 'transparent'

    const canvas = await html2canvas(codePreview.value, {
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

    canvas.toBlob(async (blob) => {
      if (!blob) {
        showMessage(props.i18n.copyFailed || '复制失败', 3000, 'error')
        return
      }

      try {
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        showMessage(props.i18n.imageCopied || '图片已复制到剪贴板', 3000, 'info')
      } catch (err) {
        console.error('复制失败:', err)
        showMessage(props.i18n.copyFailed || '复制失败', 3000, 'error')
      }
    }, 'image/png', 1.0) // 使用最高质量
  } catch (error) {
    console.error('生成图片失败:', error)
    showMessage(props.i18n.generateFailed || '生成图片失败', 3000, 'error')
  }
}

// 下载图片
const downloadImage = async () => {
  if (!codePreview.value || !codeContent.value) return

  try {
    // 使用设备像素比,确保在高分辨率屏幕上清晰
    const dpr = window.devicePixelRatio || 1
    const scale = Math.max(dpr, 3) // 提高到至少 3 倍缩放

    // 获取预览元素的实际背景色
    const computedStyle = window.getComputedStyle(codePreview.value)
    const bgColor = computedStyle.backgroundColor || 'transparent'

    const canvas = await html2canvas(codePreview.value, {
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

    const link = document.createElement('a')
    const filename = contentType.value === 'code'
      ? `code-${selectedLanguage.value}-${Date.now()}.png`
      : `text-${Date.now()}.png`
    link.download = filename
    link.href = canvas.toDataURL('image/png', 1.0) // 使用最高质量
    link.click()

    showMessage(props.i18n.imageDownloaded || '图片已下载', 3000, 'info')
  } catch (error) {
    console.error('下载失败:', error)
    showMessage(props.i18n.downloadFailed || '下载失败', 3000, 'error')
  }
}

</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
