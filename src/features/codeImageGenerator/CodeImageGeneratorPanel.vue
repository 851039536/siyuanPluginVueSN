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
const previewContainer = ref<HTMLDivElement>()
const codePreview = ref<HTMLDivElement>()

// 装饰选项
const showDecorations = ref(false)
const enableWatermark = ref(false)
const watermarkText = ref('SiYuan Notes')
const enableAuthor = ref(false)
const authorName = ref('')
const enableTimestamp = ref(false)

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

// 复制图片到剪贴板
const copyImage = async () => {
  if (!codePreview.value || !codeContent.value) return

  try {
    const canvas = await html2canvas(codePreview.value, {
      backgroundColor: null,
      scale: 2,
      logging: false
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
    })
  } catch (error) {
    console.error('生成图片失败:', error)
    showMessage(props.i18n.generateFailed || '生成图片失败', 3000, 'error')
  }
}

// 下载图片
const downloadImage = async () => {
  if (!codePreview.value || !codeContent.value) return

  try {
    const canvas = await html2canvas(codePreview.value, {
      backgroundColor: null,
      scale: 2,
      logging: false
    })

    const link = document.createElement('a')
    link.download = `code-${selectedLanguage.value}-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()

    showMessage(props.i18n.imageDownloaded || '图片已下载', 3000, 'info')
  } catch (error) {
    console.error('下载失败:', error)
    showMessage(props.i18n.downloadFailed || '下载失败', 3000, 'error')
  }
}

// 关闭面板
const closePanel = () => {
  // 右侧边栏不需要关闭操作
  // emit('update:visible', false)
  // emit('close')
}
</script>

<style scoped lang="scss">
.code-image-panel {
  background: var(--b3-theme-background);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.panel-icon {
  width: 18px;
  height: 18px;
  color: var(--b3-theme-primary);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section,
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-textarea {
  width: 100%;
  min-height: 120px;
  max-height: 200px;
  padding: 12px;
  border: 2px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
}

.settings-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.setting-select {
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary-lighter);
  }

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.size-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.size-slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--b3-theme-surface-lighter);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
}

.size-value {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  min-width: 45px;
  text-align: right;
  font-weight: 600;
}

.preview-container {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  padding: 20px;
}

.code-preview {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 400px;
  max-width: 100%;
}

/* GitHub 风格 */
.style-github.theme-light {
  background: #ffffff;
  border: 1px solid #d0d7de;
}

.style-github.theme-dark {
  background: #0d1117;
  border: 1px solid #30363d;
}

/* Mac 风格 */
.style-mac.theme-light {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.style-mac.theme-dark {
  background: #1e1e1e;
  border: 1px solid #3d3d3d;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* 卡通风格 */
.style-cartoon.theme-light {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 3px solid #5a67d8;
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
}

.style-cartoon.theme-dark {
  background: linear-gradient(135deg, #434343 0%, #000000 100%);
  border: 3px solid #666;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
}

/* 波浪渐变风格 */
.style-wave.theme-light {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.style-wave.theme-dark {
  background: linear-gradient(135deg, #2d3561 0%, #3a1c71 50%, #6441a5 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(58, 28, 113, 0.5);
}

/* 玻璃拟态风格 */
.style-glass.theme-light {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.style-glass.theme-dark {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* 霓虹灯风格 */
.style-neon.theme-light {
  background: #1a1a2e;
  border: 2px solid #0ff;
  box-shadow:
    0 0 10px #0ff,
    0 0 20px #0ff,
    0 0 40px #0ff,
    inset 0 0 10px rgba(0, 255, 255, 0.2);
}

.style-neon.theme-dark {
  background: #0f0f23;
  border: 2px solid #f0f;
  box-shadow:
    0 0 10px #f0f,
    0 0 20px #f0f,
    0 0 40px #f0f,
    inset 0 0 10px rgba(255, 0, 255, 0.2);
}

/* 3D立体风格 */
.style-3d.theme-light {
  background: linear-gradient(145deg, #f0f0f0, #cacaca);
  border: none;
  box-shadow:
    20px 20px 60px #bebebe,
    -20px -20px 60px #ffffff;
  transform: perspective(1000px) rotateX(5deg);
}

.style-3d.theme-dark {
  background: linear-gradient(145deg, #2d2d2d, #1a1a1a);
  border: none;
  box-shadow:
    20px 20px 60px #0d0d0d,
    -20px -20px 60px #3d3d3d;
  transform: perspective(1000px) rotateX(5deg);
}

.window-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  gap: 12px;
}

.theme-dark .window-header {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.window-buttons {
  display: flex;
  gap: 8px;
}

.window-btn {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: block;
}

.style-github .window-btn,
.style-mac .window-btn {
  &.close { background: #ff5f56; }
  &.minimize { background: #ffbd2e; }
  &.maximize { background: #27c93f; }
}

.style-cartoon .window-btn {
  &.close { background: #ff6b9d; }
  &.minimize { background: #feca57; }
  &.maximize { background: #48dbfb; }
}

.window-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  flex: 1;
  text-align: center;
}

.theme-light .window-title {
  color: #586069;
}

.theme-dark .window-title {
  color: #8b949e;
}

.style-cartoon .window-title {
  color: #ffffff;
  font-weight: 600;
}

.code-content {
  padding: 16px;
  overflow-x: auto;

  pre {
    margin: 0;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    line-height: 1.6;
  }

  code {
    display: block;
    white-space: pre;
  }
}

.theme-light .code-content {
  color: #24292e;
  background: #ffffff;
}

.theme-dark .code-content {
  color: #c9d1d9;
  background: #0d1117;
}

.style-cartoon.theme-light .code-content {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.style-cartoon.theme-dark .code-content {
  color: #e0e0e0;
  background: rgba(0, 0, 0, 0.3);
}

/* 装饰元素 */
.decorations {
  position: relative;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.theme-dark .decorations {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.watermark {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.3);
  font-weight: 500;
}

.theme-dark .watermark {
  color: rgba(255, 255, 255, 0.3);
}

.metadata {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
}

.theme-dark .metadata {
  color: rgba(255, 255, 255, 0.5);
}

.author::before {
  content: '👤 ';
}

.timestamp::before {
  content: '🕒 ';
}

/* 文字预览样式 */
.text-preview {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  min-width: 400px;
  max-width: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.text-content {
  flex: 1;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.text-body {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.8;
}

/* 名人名言风格 */
.text-style-quote.theme-light {
  background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
  border-left: 6px solid #3498db;
}

.text-style-quote.theme-dark {
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  border-left: 6px solid #3498db;
}

.text-style-quote .text-body::before {
  content: '“';
  font-size: 3em;
  color: #3498db;
  opacity: 0.3;
  position: absolute;
  top: 20px;
  left: 20px;
}

/* 诗词意境风格 */
.text-style-poetry.theme-light {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
  border: 2px solid rgba(255, 107, 107, 0.3);
  position: relative;
}

.text-style-poetry.theme-dark {
  background: linear-gradient(135deg, #4a2c2a 0%, #3d1e1c 100%);
  border: 2px solid rgba(255, 107, 107, 0.5);
}

.text-style-poetry .text-body {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 1.2em;
  line-height: 2;
}

/* 手写便签风格 */
.text-style-note.theme-light {
  background: #fef5e7;
  border: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: rotate(-1deg);
}

.text-style-note.theme-dark {
  background: #3e3021;
  border: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transform: rotate(-1deg);
}

.text-style-note .text-body {
  font-family: 'Segoe Print', 'Comic Sans MS', cursive;
  color: #555;
}

.text-style-note.theme-dark .text-body {
  color: #ddd;
}

/* 激励海报风格 */
.text-style-poster.theme-light {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4);
}

.text-style-poster.theme-dark {
  background: linear-gradient(135deg, #2d3561 0%, #3a1c71 100%);
  border: none;
  box-shadow: 0 12px 40px rgba(58, 28, 113, 0.6);
}

.text-style-poster .text-body {
  color: #ffffff;
  font-weight: bold;
  font-size: 1.5em;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

/* 引用卡片风格 */
.text-style-card.theme-light {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-radius: 16px;
}

.text-style-card.theme-dark {
  background: #1e1e1e;
  border: 1px solid #3d3d3d;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border-radius: 16px;
}

/* 复古报纸风格 */
.text-style-newspaper.theme-light {
  background: #f4f1e8;
  border: 3px double #8b7355;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.1);
}

.text-style-newspaper.theme-dark {
  background: #2a2418;
  border: 3px double #5a4a3a;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
}

.text-style-newspaper .text-body {
  font-family: 'Times New Roman', serif;
  color: #2c2416;
}

.text-style-newspaper.theme-dark .text-body {
  color: #d4c4a8;
}

/* 渐变文字风格 */
.text-style-gradient.theme-light {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(245, 87, 108, 0.4);
}

.text-style-gradient.theme-dark {
  background: linear-gradient(135deg, #6a1b9a 0%, #c2185b 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(106, 27, 154, 0.5);
}

.text-style-gradient .text-body {
  background: linear-gradient(45deg, #fff, rgba(255, 255, 255, 0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: bold;
}

/* 装饰选项区域 */
.decoration-section {
  margin-top: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  overflow: hidden;
}

.decoration-header {
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  transition: background 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.decoration-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.decoration-toggle {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
  color: var(--b3-theme-on-surface);

  &.expanded {
    transform: rotate(180deg);
  }
}

.decoration-options {
  padding: 12px;
  background: var(--b3-theme-background);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.decoration-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.decoration-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  min-width: 100px;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.decoration-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.panel-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.btn-action {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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

.btn-primary {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-lighter);
  border-radius: 3px;

  &:hover {
    background: var(--b3-theme-on-surface-variant);
  }
}
</style>
