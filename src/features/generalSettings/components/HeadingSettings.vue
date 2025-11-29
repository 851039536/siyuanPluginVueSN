<template>
  <div class="heading-settings">
    <div class="settings-container">
      <!-- 风格选择 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.headingStyle || '标题风格' }}
          </label>
          <select v-model="selectedStyle" class="style-select" @change="applyStyle">
            <option value="default">{{ i18n.defaultHeadingStyle || '默认风格' }}</option>
            <option value="github">{{ i18n.githubStyle || 'GitHub 风格' }}</option>
            <option value="mac">{{ i18n.macStyle || 'Mac 风格' }}</option>
            <option value="cartoon">{{ i18n.cartoonStyle || '卡通风格' }}</option>
            <option value="rainbow">{{ i18n.rainbowStyle || '彩虹风格' }}</option>
            <option value="monochrome">{{ i18n.monochromeStyle || '单色风格' }}</option>
            <option value="warm">{{ i18n.warmStyle || '暖色风格' }}</option>
            <option value="cool">{{ i18n.coolStyle || '冷色风格' }}</option>
            <option value="gradient">{{ i18n.gradientStyle || '渐变风格' }}</option>
            <option value="custom">{{ i18n.customStyle || '自定义' }}</option>
          </select>
        </div>
      </div>

      <!-- 标题颜色设置 -->
      <div class="heading-colors">
        <div v-for="level in 6" :key="level" class="color-item">
          <label class="color-label">
            <span class="heading-icon">H{{ level }}</span>
            <span class="heading-text">{{ i18n[`heading${level}`] || `标题 ${level}` }}</span>
          </label>
          <div class="color-input-group">
            <input
              v-model="headingColors[`h${level}`]"
              type="color"
              class="color-picker"
              @change="onColorChange"
            />
            <input
              v-model="headingColors[`h${level}`]"
              type="text"
              class="color-text"
              @change="onColorChange"
            />
          </div>
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="preview-section">
        <div class="preview-toggle" @click="togglePreview">
          <span class="preview-icon">{{ showPreview ? '👁️' : '👁️‍🗨️' }}</span>
          <span>{{ i18n.preview || '预览效果' }}</span>
          <span class="toggle-arrow" :class="{ expanded: showPreview }">▼</span>
        </div>
        <transition name="preview-expand">
          <div v-show="showPreview" class="preview-content">
            <div class="preview-box">
              <div
                v-for="level in 6"
                :key="level"
                class="preview-heading"
                :class="`h${level}`"
                :style="{ color: headingColors[`h${level}`] }"
              >
                {{ i18n[`heading${level}Preview`] || `这是 H${level} 标题预览` }}
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { showMessage } from 'siyuan'

interface HeadingColors {
  h1: string
  h2: string
  h3: string
  h4: string
  h5: string
  h6: string
}

interface Props {
  i18n?: any
  initialSettings?: HeadingColors
}

interface Emits {
  (e: 'change', settings: HeadingColors): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  initialSettings: () => ({
    h1: '#F39A94',
    h2: '#F8D694',
    h3: '#B1DCB9',
    h4: '#AAD2FC',
    h5: '#AC9DC0',
    h6: '#D7D7D7'
  })
})

const emit = defineEmits<Emits>()

const selectedStyle = ref('default')
const showPreview = ref(false)
const headingColors = ref<HeadingColors>({ ...props.initialSettings })

// 预设风格
const styles: Record<string, HeadingColors> = {
  default: {
    h1: '#F39A94',
    h2: '#F8D694',
    h3: '#B1DCB9',
    h4: '#AAD2FC',
    h5: '#AC9DC0',
    h6: '#D7D7D7'
  },
  github: {
    h1: '#0969DA',
    h2: '#1F883D',
    h3: '#9A6700',
    h4: '#8250DF',
    h5: '#CF222E',
    h6: '#57606A'
  },
  mac: {
    h1: '#007AFF',
    h2: '#34C759',
    h3: '#FF9500',
    h4: '#FF3B30',
    h5: '#AF52DE',
    h6: '#8E8E93'
  },
  cartoon: {
    h1: '#FF6B9D',
    h2: '#FFA07A',
    h3: '#FFD700',
    h4: '#98D8C8',
    h5: '#87CEFA',
    h6: '#DDA0DD'
  },
  rainbow: {
    h1: '#FF6B6B',
    h2: '#FFA500',
    h3: '#FFD700',
    h4: '#90EE90',
    h5: '#87CEEB',
    h6: '#DA70D6'
  },
  monochrome: {
    h1: '#2C3E50',
    h2: '#34495E',
    h3: '#546E7A',
    h4: '#607D8B',
    h5: '#90A4AE',
    h6: '#B0BEC5'
  },
  warm: {
    h1: '#FF6B6B',
    h2: '#FF8E53',
    h3: '#FFAB73',
    h4: '#FFC299',
    h5: '#FFD4B3',
    h6: '#FFE4CC'
  },
  cool: {
    h1: '#667EEA',
    h2: '#64B5F6',
    h3: '#4FC3F7',
    h4: '#4DD0E1',
    h5: '#4DB6AC',
    h6: '#81C784'
  },
  gradient: {
    h1: '#667EEA',
    h2: '#7E57C2',
    h3: '#AB47BC',
    h4: '#EC407A',
    h5: '#EF5350',
    h6: '#FF7043'
  }
}

// 应用风格
function applyStyle() {
  if (selectedStyle.value !== 'custom' && styles[selectedStyle.value]) {
    headingColors.value = { ...styles[selectedStyle.value] }
    onColorChange()
  }
}

// 颜色变化时检测是否为自定义
function onColorChange() {
  let isCustom = true
  for (const [styleName, styleColors] of Object.entries(styles)) {
    const matches = Object.entries(styleColors).every(
      ([key, value]) => headingColors.value[key as keyof HeadingColors].toUpperCase() === value.toUpperCase()
    )
    if (matches) {
      selectedStyle.value = styleName
      isCustom = false
      break
    }
  }
  if (isCustom) {
    selectedStyle.value = 'custom'
  }
  emit('change', headingColors.value)
  applyToDocument()
}

// 应用到文档
function applyToDocument() {
  const style = document.getElementById('heading-colors-style') || document.createElement('style')
  style.id = 'heading-colors-style'

  // 只应用颜色样式
  const css = Object.entries(headingColors.value)
    .map(([level, color]) => {
      return `
        .protyle-wysiwyg [data-node-id].${level},
        .protyle-wysiwyg .${level},
        .b3-typography .${level} {
          color: ${color} !important;
        }
      `
    })
    .join('\n')

  style.textContent = css

  if (!style.parentElement) {
    document.head.appendChild(style)
  }
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

// 自动保存设置
function autoSave() {
  try {
    localStorage.setItem('general-heading-settings', JSON.stringify({
      style: selectedStyle.value,
      colors: headingColors.value
    }))
    applyToDocument()
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 加载保存的设置
function loadSettings() {
  try {
    const saved = localStorage.getItem('general-heading-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      selectedStyle.value = parsed.style || 'default'
      headingColors.value = { ...styles.default, ...parsed.colors }
      applyToDocument()
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 初始化
loadSettings()

// 监听设置变化，自动保存
watch(headingColors, (newColors) => {
  emit('change', newColors)
  autoSave()
}, { deep: true })

// 监听风格变化,自动保存
watch(selectedStyle, () => {
  autoSave()
})

// 暴露方法
defineExpose({
  loadSettings,
  headingColors,
  selectedStyle
})
</script>

<style scoped>
.heading-settings {
  padding: 16px;
  box-sizing: border-box;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 100%;
}

/* 设置行样式 */
.setting-row {
  display: flex;
  width: 100%;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

.style-select {
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.style-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

/* 标题颜色设置 */
.heading-colors {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.heading-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
}

.heading-text {
  font-size: 12px;
}

.color-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-picker {
  width: 48px;
  height: 36px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
}

.color-picker:hover {
  border-color: var(--b3-theme-primary);
}

.color-text {
  flex: 1;
  padding: 6px 10px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  font-family: monospace;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.color-text:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

/* 预览区域 */
.preview-section {
  border: 2px solid var(--b3-theme-outline);
  border-radius: 12px;
  overflow: hidden;
  background: var(--b3-theme-surface);
}

.preview-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--b3-theme-surface-variant);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.preview-toggle:hover {
  background: var(--b3-theme-outline);
}

.preview-icon {
  font-size: 16px;
}

.toggle-arrow {
  margin-left: auto;
  transition: transform 0.3s ease;
  font-size: 12px;
}

.toggle-arrow.expanded {
  transform: rotate(180deg);
}

.preview-expand-enter-active,
.preview-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.preview-expand-enter-from,
.preview-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.preview-expand-enter-to,
.preview-expand-leave-from {
  max-height: 400px;
  opacity: 1;
}

.preview-content {
  padding: 16px;
  border-top: 1px solid var(--b3-theme-outline);
}

.preview-box {
  padding: 20px;
  background: var(--b3-theme-surface-variant);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-outline);
}

.preview-heading {
  margin: 12px 0;
  font-weight: 600;
  line-height: 1.4;
}

.preview-heading.h1 {
  font-size: 28px;
}

.preview-heading.h2 {
  font-size: 24px;
}

.preview-heading.h3 {
  font-size: 20px;
}

.preview-heading.h4 {
  font-size: 18px;
}

.preview-heading.h5 {
  font-size: 16px;
}

.preview-heading.h6 {
  font-size: 14px;
}



/* 响应式设计 */
@media (max-width: 400px) {
  .heading-settings {
    padding: 12px;
  }

  .heading-colors {
    grid-template-columns: 1fr;
    gap: 10px;
  }



  .preview-heading.h1 {
    font-size: 24px;
  }

  .preview-heading.h2 {
    font-size: 20px;
  }

  .preview-heading.h3 {
    font-size: 18px;
  }

  .preview-heading.h4 {
    font-size: 16px;
  }

  .preview-heading.h5 {
    font-size: 14px;
  }

  .preview-heading.h6 {
    font-size: 13px;
  }
}
</style>
