<template>
  <div class="font-settings">
    <div class="settings-container">
      <!-- 字体族 - 单独一行 -->
      <div class="setting-row full-width">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">🔤</span>
            {{ i18n.fontFamily || '字体族' }}
          </label>
          <div class="font-input-container">
            <input
              v-model="settings.fontFamily"
              type="text"
              :placeholder="i18n.fontFamilyPlaceholder || '输入字体名称'"
              class="font-input"
            />
            <select v-model="settings.fontFamily" class="font-select">
              <option value="">{{ i18n.selectFont || '选择字体' }}</option>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimSun">宋体</option>
              <option value="SimHei">黑体</option>
              <option value="KaiTi">楷体</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="system-ui">System UI</option>
              <option value="monospace">Monospace</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 数值设置区域 -->
      <div class="numeric-settings">
        <!-- 字体大小 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📏</span>
            {{ i18n.fontSize || '字号' }}
          </label>
          <div class="range-control">
            <input
              v-model.number="settings.fontSize"
              type="number"
              min="8"
              max="72"
              class="number-input"
            />
            <div class="slider-container">
              <input
                v-model="fontSizePreview"
                type="range"
                min="8"
                max="72"
                class="range-slider"
              />
              <div class="slider-labels">
                <span>8</span>
                <span>72</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 行高 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📐</span>
            {{ i18n.lineHeight || '行高' }}
          </label>
          <div class="range-control">
            <input
              v-model.number="settings.lineHeight"
              type="number"
              min="1"
              max="3"
              step="0.1"
              class="number-input"
            />
            <div class="slider-container">
              <input
                v-model="lineHeightPreview"
                type="range"
                min="1"
                max="3"
                step="0.1"
                class="range-slider"
              />
              <div class="slider-labels">
                <span>1.0</span>
                <span>3.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 字体粗细和高亮功能 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">💪</span>
            {{ i18n.fontWeight || '粗细' }}
          </label>
          <select v-model="settings.fontWeight" class="weight-select">
            <option value="100">100 - Thin</option>
            <option value="300">300 - Light</option>
            <option value="normal">400 - {{ i18n.normal || '正常' }}</option>
            <option value="500">500 - Medium</option>
            <option value="600">600 - Semi Bold</option>
            <option value="bold">700 - {{ i18n.bold || '粗体' }}</option>
            <option value="800">800 - Extra Bold</option>
            <option value="900">900 - Black</option>
          </select>
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
            <div class="preview-box" :style="previewStyle">
              <div class="preview-text">
                <p class="preview-line">{{ i18n.previewText || '示例文本展示效果' }}</p>
                <p class="preview-line">The quick brown fox jumps over the lazy dog.</p>
                <p class="preview-line">1234567890 !@#$%^&*() 中文标点符号，。</p>
              </div>
            </div>
            <div class="preview-info">
              <span class="info-item">{{ settings.fontFamily || '默认字体' }}</span>
              <span class="info-item">{{ settings.fontSize }}px</span>
              <span class="info-item">{{ settings.fontWeight }}</span>
              <span class="info-item">行高 {{ settings.lineHeight }}</span>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

interface FontSettings {
  fontFamily: string
  fontSize: number
  fontWeight: string
  lineHeight: number
}

interface Props {
  i18n?: any
  plugin?: any
  initialSettings?: FontSettings
}

interface Emits {
  (e: 'change', settings: FontSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  initialSettings: () => ({
    fontFamily: '',
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 1.6
  })
})

const emit = defineEmits<Emits>()

const settings = ref<FontSettings>({ ...props.initialSettings })
const showPreview = ref(false)
const fontSizePreview = ref(props.initialSettings.fontSize)
const lineHeightPreview = ref(props.initialSettings.lineHeight)

const DEFAULT_SETTINGS: FontSettings = {
  fontFamily: '',
  fontSize: 14,
  fontWeight: 'normal',
  lineHeight: 1.6
}

// 监听滑块变化并更新进度
watch(fontSizePreview, (val) => {
  settings.value.fontSize = val
  updateSliderProgress('fontSize', val, 8, 72)
})

watch(lineHeightPreview, (val) => {
  settings.value.lineHeight = val
  updateSliderProgress('lineHeight', val, 1, 3)
})

// 监听设置变化,自动保存
watch(settings, async (newSettings) => {
  fontSizePreview.value = newSettings.fontSize
  lineHeightPreview.value = newSettings.lineHeight
  emit('change', newSettings)
  // 自动保存到思源数据库
  if (props.plugin) {
    try {
      // 保存字体设置到思源数据库
      await props.plugin.saveData('font-settings', {
        fontFamily: newSettings.fontFamily,
        fontSize: newSettings.fontSize,
        fontWeight: newSettings.fontWeight,
        lineHeight: newSettings.lineHeight
      })
      console.log('字体设置已保存:', newSettings)
    } catch (error) {
      console.error('自动保存失败:', error)
    }
  }
}, { deep: true })

const previewStyle = computed(() => ({
  fontFamily: settings.value.fontFamily || 'inherit',
  fontSize: `${settings.value.fontSize}px`,
  fontWeight: settings.value.fontWeight,
  lineHeight: settings.value.lineHeight
}))

function togglePreview() {
  showPreview.value = !showPreview.value
}

// 加载保存的设置
async function loadSettings() {
  try {
    // 加载字体设置（从思源数据库）
    let fontSettings = { ...DEFAULT_SETTINGS }
    if (props.plugin) {
      try {
        const fontData = await props.plugin.loadData('font-settings')
        if (fontData) {
          fontSettings = { ...DEFAULT_SETTINGS, ...fontData }
        }
      } catch (error) {
        console.error('加载字体设置失败:', error)
      }
    }

    // 应用设置
    settings.value = fontSettings
    fontSizePreview.value = settings.value.fontSize
    lineHeightPreview.value = settings.value.lineHeight

    // 初始化滑块进度
    nextTick(() => {
      updateSliderProgress('fontSize', settings.value.fontSize, 8, 72)
      updateSliderProgress('lineHeight', settings.value.lineHeight, 1, 3)
    })
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 更新滑块进度条样式
function updateSliderProgress(type: string, value: number, min: number, max: number) {
  const progress = ((value - min) / (max - min)) * 100
  nextTick(() => {
    const slider = type === 'fontSize' ?
      document.querySelector('.range-slider') as HTMLInputElement :
      document.querySelectorAll('.range-slider')[1] as HTMLInputElement

    if (slider) {
      slider.style.setProperty('--progress', `${progress}%`)
    }
  })
}

// 初始化时加载设置
loadSettings().catch(error => {
  console.error('初始化加载设置失败:', error)
})

// 暴露方法
defineExpose({
  loadSettings,
  settings
})
</script>

<style scoped>
/* === 基础样式 === */
.font-settings {
  padding: 16px;
  box-sizing: border-box;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 100%;
}

/* === 设置行 === */
.setting-row {
  display: flex;
  width: 100%;
}

.setting-row.full-width {
  flex-direction: column;
}

/* === 数值设置区域 === */
.numeric-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}

/* === 设置项 === */
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0;
  white-space: nowrap;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

/* === 表单控件基础样式 === */
.font-input,
.font-select,
.weight-select,
.number-input {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border: 2px solid var(--b3-theme-outline);
  transition: all 0.2s ease;
}

.font-input:focus,
.font-select:focus,
.weight-select:focus,
.number-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb), 0.1);
  background: var(--b3-theme-surface-variant);
}

/* === 字体输入 === */
.font-input-container {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.font-input {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}

.font-select {
  min-width: 120px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

/* === 范围控制 === */
.range-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.number-input {
  width: 70px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
  font-weight: 500;
}

.slider-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right,
    var(--b3-theme-primary) 0%,
    var(--b3-theme-primary) var(--progress, 50%),
    var(--b3-theme-surface-variant) var(--progress, 50%),
    var(--b3-theme-surface-variant) 100%);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.range-slider::-webkit-slider-thumb,
.range-slider::-moz-range-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
  border: 3px solid var(--b3-theme-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
}

/* === 字体粗细选择 === */
.weight-select {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
}

/* === 预览区域 === */
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
  max-height: 200px;
  opacity: 1;
}

.preview-content {
  padding: 16px;
  border-top: 1px solid var(--b3-theme-outline);
}

.preview-box {
  padding: 16px;
  background: var(--b3-theme-surface-variant);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--b3-theme-outline);
  min-height: 80px;
}

.preview-text {
  line-height: 1.5;
  word-wrap: break-word;
}

.preview-line {
  margin: 0 0 8px 0;
}

.preview-line:last-child {
  margin-bottom: 0;
}

.preview-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.info-item {
  padding: 2px 8px;
  background: var(--b3-theme-surface);
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid var(--b3-theme-outline);
}

/* === 响应式设计 === */
@media (max-width: 400px) {
  .font-settings {
    padding: 12px;
  }

  .numeric-settings {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .font-input-container {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .font-select {
    min-width: 100%;
  }

  .preview-info {
    flex-direction: column;
    gap: 4px;
  }

  .settings-container {
    gap: 16px;
  }
}

@media (max-width: 320px) {
  .font-settings {
    padding: 8px;
  }

  .setting-label {
    font-size: 12px;
  }

  .font-input,
  .font-select,
  .weight-select {
    font-size: 12px;
    padding: 6px 10px;
  }
}

@media (max-width: 280px) {
  .preview-content,
  .preview-box {
    padding: 12px;
  }

  .preview-box {
    min-height: 60px;
  }
}
</style>
