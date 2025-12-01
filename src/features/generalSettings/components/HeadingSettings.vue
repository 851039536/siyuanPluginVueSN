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

      <!-- 标题层级显示设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔢</span>
            {{ i18n.headingLevelDisplay || '标题层级显示' }}
          </label>
          <select v-model="levelDisplayStyle" class="style-select" @change="applyLevelDisplay">
            <option value="none">{{ i18n.levelDisplayNone || '不显示' }}</option>
            <option value="number">{{ i18n.levelDisplayNumber || '数字标记 (1-6)' }}</option>
            <option value="roman">{{ i18n.levelDisplayRoman || '罗马数字 (I-VI)' }}</option>
            <option value="chinese">{{ i18n.levelDisplayChinese || '中文数字 (一-六)' }}</option>
            <option value="chineseUpper">{{ i18n.levelDisplayChineseUpper || '中文大写 (壹-陆)' }}</option>
            <option value="dots">{{ i18n.levelDisplayDots || '圆点标记 (•)' }}</option>
            <option value="emoji">{{ i18n.levelDisplayEmoji || '表情符号 (😀-😎)' }}</option>
            <option value="star">{{ i18n.levelDisplayStar || '星级标记 (⭐)' }}</option>
            <option value="arrow">{{ i18n.levelDisplayArrow || '箭头标记 (→)' }}</option>
            <option value="tag">{{ i18n.levelDisplayTag || '标签样式 (H1-H6)' }}</option>
            <option value="bracket">{{ i18n.levelDisplayBracket || '括号标记 [1-6]' }}</option>
            <option value="custom">{{ i18n.levelDisplayCustom || '自定义...' }}</option>
          </select>
          <div v-if="levelDisplayStyle !== 'none'" class="level-display-hint">
            <span class="hint-icon">ℹ️</span>
            <span class="hint-text">{{ i18n.levelDisplayHint || '注意:第三方主题可能会影响显示效果' }}</span>
          </div>
        </div>
      </div>

      <!-- 标题居中设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">↔️</span>
            {{ i18n.titleCenterAlign || '标题居中显示' }}
          </label>
          <div class="toggle-container">
            <input
              v-model="titleCenterAlign"
              type="checkbox"
              class="toggle-checkbox"
              @change="applyTitleCenterAlign"
            />
            <span class="toggle-label">{{ titleCenterAlign ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}</span>
          </div>
        </div>
      </div>

      <!-- 文档标题颜色设置 -->
      <div v-if="titleCenterAlign" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🎨</span>
            {{ i18n.titleColor || '文档标题颜色' }}
          </label>
          <div class="title-color-input-group">
            <input
              v-model="titleColor"
              type="color"
              class="title-color-picker"
              @change="onTitleColorChange"
            />
            <input
              v-model="titleColor"
              type="text"
              class="title-color-text"
              @change="onTitleColorChange"
            />
            <button 
              v-if="titleColor !== defaultTitleColor"
              class="reset-color-btn"
              @click="resetTitleColor"
            >
              {{ i18n.resetColor || '重置' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 自定义层级标记设置 -->
      <div v-if="levelDisplayStyle === 'custom'" class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">✏️</span>
            {{ i18n.customLevelMarkers || '自定义标记' }}
          </label>
          <div class="custom-level-inputs">
            <div v-for="level in 6" :key="level" class="custom-level-item">
              <label class="custom-level-label">H{{ level }}</label>
              <input
                v-model="customLevelMarkers[level - 1]"
                type="text"
                class="custom-level-input"
                :placeholder="`H${level}标记`"
                maxlength="10"
                @input="applyLevelDisplay"
              />
            </div>
          </div>
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
import { ref, watch, onMounted } from 'vue'

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
  plugin?: any
  initialSettings?: HeadingColors
}

interface Emits {
  (e: 'change', settings: HeadingColors): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
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
const levelDisplayStyle = ref('none')
const customLevelMarkers = ref<string[]>(['1', '2', '3', '4', '5', '6'])
const titleCenterAlign = ref(false)
const titleColor = ref('#2C3E50')
const defaultTitleColor = '#2C3E50'

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

  // 颜色样式
  const colorCss = Object.entries(headingColors.value)
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

  // 层级显示样式
  let levelCss = ''
  if (levelDisplayStyle.value !== 'none') {
    levelCss = generateLevelDisplayCss(levelDisplayStyle.value)
    console.log('生成的层级CSS:', levelCss)
  }

  // 标题居中样式（仅文档标题，不影响H1-H6）
  const centerAlignCss = titleCenterAlign.value ? `
    .protyle-title__input {
      text-align: center !important;
    }
  ` : ''

  // 文档标题颜色样式（独立于居中设置）
  const titleColorCss = titleColor.value ? `
    .protyle-title__input {
      color: ${titleColor.value} !important;
    }
  ` : ''

  style.textContent = colorCss + '\n' + levelCss + '\n' + centerAlignCss + '\n' + titleColorCss

  if (!style.parentElement) {
    document.head.appendChild(style)
  }

  console.log('CSS已应用到文档,层级显示样式:', levelDisplayStyle.value, '标题居中:', titleCenterAlign.value, '标题颜色:', titleColor.value)
}

// 生成层级显示 CSS
function generateLevelDisplayCss(style: string): string {
  const levelMappings: Record<string, string[]> = {
    number: ['1', '2', '3', '4', '5', '6'],
    roman: ['I', 'II', 'III', 'IV', 'V', 'VI'],
    chinese: ['一', '二', '三', '四', '五', '六'],
    chineseUpper: ['壹', '贰', '叁', '肆', '伍', '陆'],
    dots: ['•', '••', '•••', '••••', '•••••', '••••••'],
    emoji: ['😀', '😁', '😂', '🤣', '😊', '😎'],
    star: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐', '⭐⭐⭐⭐⭐⭐'],
    arrow: ['→', '→→', '→→→', '→→→→', '→→→→→', '→→→→→→'],
    tag: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
    bracket: ['[1]', '[2]', '[3]', '[4]', '[5]', '[6]'],
    custom: customLevelMarkers.value
  }

  const levels = levelMappings[style] || levelMappings.number

  return levels.map((label, index) => {
    const level = index + 1
    const tagStyles = style === 'tag'
      ? 'background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600; opacity: 0.7;'
      : '';

    return `
      .protyle-wysiwyg div[data-subtype="h${level}"][data-node-id]:not([type]) > div[contenteditable]:first-child::after,
      .protyle-wysiwyg div[data-subtype="h${level}"][data-node-id] > div.h${level}[contenteditable]::after {
        content: "  ${label}";
        font-size: 0.7em;
        opacity: 0.4;
        margin-left: 6px;
        vertical-align: middle;
        ${tagStyles}
      }
    `
  }).join('\n')
}

// 应用层级显示
function applyLevelDisplay() {
  console.log('应用层级显示样式:', levelDisplayStyle.value)
  applyToDocument()
  autoSave()
}

// 应用标题居中
function applyTitleCenterAlign() {
  console.log('应用标题居中样式:', titleCenterAlign.value)
  applyToDocument()
  autoSave()
}

// 标题颜色变化处理
function onTitleColorChange() {
  console.log('标题颜色变化:', titleColor.value)
  applyToDocument()
  autoSave()
}

// 重置标题颜色
function resetTitleColor() {
  titleColor.value = defaultTitleColor
  console.log('标题颜色重置为默认值:', defaultTitleColor)
  applyToDocument()
  autoSave()
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

// 自动保存设置
async function autoSave() {
  if (!props.plugin) {
    console.warn('插件实例不可用，无法保存设置')
    return
  }
  
  try {
    const settingsToSave = {
      style: selectedStyle.value,
      colors: headingColors.value,
      levelDisplay: levelDisplayStyle.value,
      customMarkers: customLevelMarkers.value,
      titleCenterAlign: titleCenterAlign.value,
      titleColor: titleColor.value
    }
    
    // 使用插件的数据存储 API
    const { saveHeadingSettings } = await import('@/config/settings')
    const success = await saveHeadingSettings(props.plugin, settingsToSave)
    
    if (success) {
      console.log('设置已保存到数据库:', settingsToSave)
    } else {
      console.error('保存设置失败')
    }
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 加载保存的设置
async function loadSettings() {
  if (!props.plugin) {
    console.warn('插件实例不可用，使用默认设置')
    return
  }
  
  try {
    console.log('尝试从数据库加载设置...')
    
    // 使用插件的数据存储 API
    const { loadHeadingSettings } = await import('@/config/settings')
    const settings = await loadHeadingSettings(props.plugin)
    
    console.log('从数据库加载的设置:', settings)
    
    selectedStyle.value = settings.style || 'default'
    headingColors.value = { ...styles.default, ...settings.colors }
    levelDisplayStyle.value = settings.levelDisplay || 'none'
    customLevelMarkers.value = settings.customMarkers || ['1', '2', '3', '4', '5', '6']
    titleCenterAlign.value = settings.titleCenterAlign ?? false
    titleColor.value = settings.titleColor || defaultTitleColor
    
    console.log('已加载设置:', {
      style: selectedStyle.value,
      levelDisplay: levelDisplayStyle.value,
      titleCenterAlign: titleCenterAlign.value,
      titleColor: titleColor.value
    })
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 初始化 - 在组件挂载后执行
onMounted(() => {
  console.log('HeadingSettings 组件已挂载，开始加载设置')
  loadSettings()
  // 确保样式立即应用
  setTimeout(() => {
    applyToDocument()
    console.log('HeadingSettings 样式已应用')
  }, 100)
})

// 监听设置变化，自动保存
watch(headingColors, (newColors) => {
  emit('change', newColors)
  autoSave()
}, { deep: true })

// 监听风格变化,自动保存
watch(selectedStyle, () => {
  autoSave()
})

// 监听层级显示变化,自动保存并应用
watch(levelDisplayStyle, (newValue, oldValue) => {
  console.log('levelDisplayStyle 变化:', oldValue, '->', newValue)
  applyToDocument()
  autoSave()
})

// 监听标题居中变化,自动保存并应用
watch(titleCenterAlign, (newValue, oldValue) => {
  console.log('titleCenterAlign 变化:', oldValue, '->', newValue)
  applyToDocument()
  autoSave()
})

// 监听标题颜色变化,自动保存并应用
watch(titleColor, (newValue, oldValue) => {
  console.log('titleColor 变化:', oldValue, '->', newValue)
  if (titleCenterAlign.value) {
    applyToDocument()
  }
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

/* 层级显示提示 */
.level-display-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
  border-left: 3px solid var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.hint-icon {
  font-size: 14px;
  opacity: 0.8;
}

.hint-text {
  flex: 1;
  line-height: 1.4;
}

/* 自定义层级标记输入 */
.custom-level-inputs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.custom-level-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-level-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 28px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.custom-level-input {
  flex: 1;
  padding: 6px 10px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  transition: all 0.2s ease;
}

.custom-level-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.custom-level-input::placeholder {
  color: var(--b3-theme-on-surface-variant);
  opacity: 0.5;
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

/* 标题居中设置样式 */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  user-select: none;
}

/* 文档标题颜色设置样式 */
.title-color-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.title-color-picker {
  width: 48px;
  height: 36px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
}

.title-color-picker:hover {
  border-color: var(--b3-theme-primary);
}

.title-color-text {
  flex: 1;
  min-width: 100px;
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

.title-color-text:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.reset-color-btn {
  padding: 6px 12px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.reset-color-btn:hover {
  border-color: var(--b3-theme-primary);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}


</style>
