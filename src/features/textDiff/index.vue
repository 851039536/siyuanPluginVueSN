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
        <!-- 原文本面板 -->
        <div 
          class="input-panel"
          :class="{ 'drag-over': dragState.original }"
          @dragover.prevent="handleDragOver('original', $event)"
          @dragleave="handleDragLeave('original')"
          @drop.prevent="handleDrop('original', $event)"
        >
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-title">{{ $t('original') }}</span>
              <span v-if="originalFileName" class="file-name">{{ originalFileName }}</span>
            </div>
            <div class="header-right">
              <span class="char-count">{{ originalText.length }} {{ $t('chars') }}</span>
              <button class="file-btn" @click="triggerFileInput('original')" :title="$t('selectFile')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
              </button>
            </div>
          </div>
          <textarea
            v-model="originalText"
            :placeholder="$t('originalPlaceholder')"
            class="input-textarea"
          ></textarea>
          <!-- 拖拽提示层 -->
          <div v-if="dragState.original" class="drag-overlay">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
            <span>{{ $t('dropFile') }}</span>
          </div>
        </div>

        <!-- 修改后文本面板 -->
        <div 
          class="input-panel"
          :class="{ 'drag-over': dragState.modified }"
          @dragover.prevent="handleDragOver('modified', $event)"
          @dragleave="handleDragLeave('modified')"
          @drop.prevent="handleDrop('modified', $event)"
        >
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-title">{{ $t('modified') }}</span>
              <span v-if="modifiedFileName" class="file-name">{{ modifiedFileName }}</span>
            </div>
            <div class="header-right">
              <span class="char-count">{{ modifiedText.length }} {{ $t('chars') }}</span>
              <button class="file-btn" @click="triggerFileInput('modified')" :title="$t('selectFile')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
              </button>
            </div>
          </div>
          <textarea
            v-model="modifiedText"
            :placeholder="$t('modifiedPlaceholder')"
            class="input-textarea"
          ></textarea>
          <!-- 拖拽提示层 -->
          <div v-if="dragState.modified" class="drag-overlay">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
            </svg>
            <span>{{ $t('dropFile') }}</span>
          </div>
        </div>
      </div>

      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInputRef"
        type="file"
        style="display: none"
        @change="handleFileSelect"
      />

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
import { ref, reactive, computed, onMounted } from 'vue'
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

// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null)
const currentInputTarget = ref<'original' | 'modified'>('original')

// 响应式数据
const originalText = ref('')
const modifiedText = ref('')
const originalFileName = ref('')
const modifiedFileName = ref('')
const diffMode = ref<'split' | 'unified'>('split')
const fontSize = ref<number>(14)

// 拖拽状态
const dragState = reactive({
  original: false,
  modified: false
})

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
  originalFileName.value = ''
  modifiedFileName.value = ''
}

const swapTexts = () => {
  const tempText = originalText.value
  const tempName = originalFileName.value
  originalText.value = modifiedText.value
  originalFileName.value = modifiedFileName.value
  modifiedText.value = tempText
  modifiedFileName.value = tempName
}

// 触发文件选择
const triggerFileInput = (target: 'original' | 'modified') => {
  currentInputTarget.value = target
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    readFile(file, currentInputTarget.value)
  }
  // 重置 input 以允许再次选择同一文件
  input.value = ''
}

// 处理拖拽进入
const handleDragOver = (target: 'original' | 'modified', event: DragEvent) => {
  if (event.dataTransfer?.types.includes('Files')) {
    dragState[target] = true
  }
}

// 处理拖拽离开
const handleDragLeave = (target: 'original' | 'modified') => {
  dragState[target] = false
}

// 处理文件放置
const handleDrop = (target: 'original' | 'modified', event: DragEvent) => {
  dragState[target] = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    readFile(file, target)
  }
}

// 读取文件内容
const readFile = (file: File, target: 'original' | 'modified') => {
  const reader = new FileReader()
  reader.onload = () => {
    const content = reader.result as string
    if (target === 'original') {
      originalText.value = content
      originalFileName.value = file.name
    } else {
      modifiedText.value = content
      modifiedFileName.value = file.name
    }
  }
  reader.onerror = () => {
    console.error('读取文件失败:', file.name)
  }
  reader.readAsText(file)
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
    originalPlaceholder: '输入原始文本或拖拽文件到此处...',
    modifiedPlaceholder: '输入修改后文本或拖拽文件到此处...',
    displayMode: '显示模式',
    splitMode: '分栏',
    unifiedMode: '统一',
    fontSize: '字体',
    selectFile: '选择文件',
    dropFile: '释放文件以导入'
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
  position: relative;

  &.drag-over {
    background: var(--b3-theme-surface-lighter);
  }
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

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
}

.file-name {
  font-size: 11px;
  color: var(--b3-theme-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.char-count {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
}

.file-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    color: var(--b3-theme-on-surface);
  }
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

// 拖拽提示层
.drag-overlay {
  position: absolute;
  inset: 0;
  top: 29px; // header height
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(var(--b3-theme-primary-rgb, 235, 94, 42), 0.1);
  border: 2px dashed var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  pointer-events: none;
  z-index: 10;

  span {
    font-size: 13px;
    font-weight: 500;
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
