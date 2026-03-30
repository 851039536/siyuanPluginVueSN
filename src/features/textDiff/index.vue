<template>
  <div class="text-diff-container">
    <!-- 工具栏 -->
    <div class="diff-toolbar">
      <div class="toolbar-left">
        <div class="option-group">
          <span class="option-label">{{ $t('displayMode') }}</span>
          <button
            v-for="mode in modeOptions"
            :key="mode.value"
            :class="['toggle-btn', { active: diffMode === mode.value }]"
            @click="updateMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>

        <div class="option-group">
          <span class="option-label">{{ $t('fontSize') }}</span>
          <select class="font-select" :value="fontSize" @change="updateFontSize(Number(($event.target as HTMLSelectElement).value))">
            <option v-for="opt in FONT_SIZE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="toolbar-right">
        <button class="action-btn" @click="clearAll" :title="$t('clear')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          <span>{{ $t('clear') }}</span>
        </button>
        <button class="action-btn" @click="swapTexts" :title="$t('swap')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
          </svg>
          <span>{{ $t('swap') }}</span>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="diff-main">
      <!-- 输入区域 -->
      <div class="input-section">
        <div class="input-panel">
          <div class="panel-header">
            <span class="panel-title">{{ $t('original') }}</span>
            <span class="char-count">{{ originalText.length }} {{ $t('chars') }}</span>
          </div>
          <textarea
            v-model="originalText"
            :placeholder="$t('originalPlaceholder')"
            class="input-textarea"
          ></textarea>
        </div>

        <div class="input-panel">
          <div class="panel-header">
            <span class="panel-title">{{ $t('modified') }}</span>
            <span class="char-count">{{ modifiedText.length }} {{ $t('chars') }}</span>
          </div>
          <textarea
            v-model="modifiedText"
            :placeholder="$t('modifiedPlaceholder')"
            class="input-textarea"
          ></textarea>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="divider">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>

      <!-- 差异结果 -->
      <div class="result-section">
        <div class="panel-header">
          <span class="panel-title">{{ $t('diffResult') }}</span>
        </div>
        <Diff
          class="diff-viewer"
          :mode="diffMode"
          :theme="diffTheme"
          language="plaintext"
          :prev="originalText"
          :current="modifiedText"
          :folding="false"
          :virtual-scroll="false"
          :render-added="true"
          :render-removed="true"
          :hide-line-numbers="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Diff } from 'vue-diff'
import 'vue-diff/dist/index.css'
import type { Plugin } from 'siyuan'
import { TextDiffStorage, type TextDiffSettings } from './types/storage'

const props = defineProps<{
  onClose?: () => void
  i18n?: any
  plugin?: Plugin
}>()

// 存储管理
const storage = props.plugin ? new TextDiffStorage(props.plugin) : null

// 响应式数据
const originalText = ref('')
const modifiedText = ref('')
const diffMode = ref<'split' | 'unified'>('split')
const fontSize = ref<number>(14)

// 固定使用浅色主题
const diffTheme = 'light'

// 选项数据
const FONT_SIZE_OPTIONS = [
  { value: 12, label: '12px' },
  { value: 14, label: '14px' },
  { value: 16, label: '16px' },
  { value: 18, label: '18px' },
  { value: 20, label: '20px' },
  { value: 24, label: '24px' }
]

const modeOptions = computed(() => [
  { value: 'split' as const, label: $t('splitMode') },
  { value: 'unified' as const, label: $t('unifiedMode') }
])

// 设置字体大小
const setFontSize = (size: number) => {
  document.documentElement.style.setProperty('--diff-font-size', `${size}px`)
}

// 加载设置
const loadSettings = async () => {
  if (!storage) return
  try {
    const settings = await storage.loadSettings()
    diffMode.value = settings.diffMode
    fontSize.value = settings.fontSize
    setFontSize(settings.fontSize)
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

// 保存设置
const saveSettings = async () => {
  if (!storage) return
  try {
    const settings: TextDiffSettings = {
      fontSize: fontSize.value,
      diffMode: diffMode.value,
      theme: 'light'
    }
    await storage.saveSettings(settings)
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

const updateMode = (mode: 'split' | 'unified') => {
  diffMode.value = mode
  saveSettings()
}

const updateFontSize = (size: number) => {
  fontSize.value = size
  setFontSize(size)
  saveSettings()
}

const clearAll = () => {
  originalText.value = ''
  modifiedText.value = ''
}

const swapTexts = () => {
  const temp = originalText.value
  originalText.value = modifiedText.value
  modifiedText.value = temp
}

// 国际化
const $t = (key: string): string => {
  if (props.i18n?.textDiff?.[key]) {
    return props.i18n.textDiff[key]
  }
  const translations: Record<string, string> = {
    clear: '清空',
    swap: '交换',
    original: '原文本',
    modified: '修改后文本',
    diffResult: '差异结果',
    chars: '字符',
    originalPlaceholder: '输入原始文本...',
    modifiedPlaceholder: '输入修改后文本...',
    displayMode: '显示模式',
    splitMode: '分栏',
    unifiedMode: '统一',
    theme: '主题',
    lightTheme: '浅色',
    darkTheme: '深色',
    fontSize: '字体'
  }
  return translations[key] || key
}

onMounted(() => {
  loadSettings()
  setFontSize(fontSize.value)
})
</script>

<style scoped lang="scss">
.text-diff-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  overflow: hidden;
}

// 工具栏
.diff-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  gap: 16px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.option-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  font-weight: 500;
  white-space: nowrap;
}

// 切换按钮
.toggle-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  white-space: nowrap;

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }

  &:hover:not(.active) {
    background: var(--b3-theme-surface-lighter);
  }
}

// 字体选择
.font-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
  outline: none;
}

// 操作按钮
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  svg {
    flex-shrink: 0;
  }

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

// 主内容
.diff-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

// 输入区域
.input-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--b3-theme-surface-lighter);
  flex-shrink: 0;
  max-height: 35vh;
}

.input-panel {
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  overflow: hidden;
  min-height: 150px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.char-count {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.input-textarea {
  flex: 1;
  padding: 8px 10px;
  font-size: var(--diff-font-size, 14px);
  font-family: inherit;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-background);
  resize: none;
  outline: none;
  line-height: 1.5;

  &::placeholder {
    color: var(--b3-theme-on-surface-variant);
    opacity: 0.6;
  }
}

// 分割线
.divider {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-theme-surface-lighter);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-variant);
  flex-shrink: 0;
}

// 结果区域
.result-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 200px;
  background: var(--b3-theme-background);
}

.diff-viewer {
  flex: 1;
  overflow: auto;
  font-size: var(--diff-font-size, 14px);

  :deep(.vue-diff) {
    height: 100%;
    overflow: auto;
  }

  :deep(.vue-diff *),
  :deep(.vue-diff .d2h-wrapper),
  :deep(.vue-diff .d2h-file-wrapper),
  :deep(.vue-diff .d2h-diff-table),
  :deep(.vue-diff .d2h-diff-row) {
    font-size: inherit !important;
  }
}

// 响应式
@media (max-width: 900px) {
  .diff-toolbar {
    flex-wrap: wrap;
    padding: 8px;
  }

  .toolbar-left {
    width: 100%;
    justify-content: center;
  }

  .toolbar-right {
    width: 100%;
    justify-content: center;
  }

  .input-section {
    grid-template-columns: 1fr;
    max-height: 45vh;
  }

  .input-panel {
    min-height: 120px;
  }
}
</style>
