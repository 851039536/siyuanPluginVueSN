<template>
  <div class="text-diff-container">
    <!-- 工具栏 -->
    <div class="diff-toolbar">
      <div class="diff-options">
        <!-- 模式选择 -->
        <div class="option-group">
          <label class="option-label">{{ $t('displayMode') }}:</label>
          <button
            v-for="mode in [
              { value: 'split', label: $t('splitMode') },
              { value: 'unified', label: $t('unifiedMode') }
            ]"
            :key="mode.value"
            :class="['option-btn', { active: diffMode === mode.value }]"
            @click="updateMode(mode.value as 'split' | 'unified')"
          >
            {{ mode.label }}
          </button>
        </div>

        <!-- 主题选择 -->
        <div class="option-group">
          <label class="option-label">{{ $t('theme') }}:</label>
          <button
            v-for="theme in [
              { value: 'light', label: $t('lightTheme') },
              { value: 'dark', label: $t('darkTheme') }
            ]"
            :key="theme.value"
            :class="['option-btn', { active: diffTheme === theme.value }]"
            @click="updateTheme(theme.value as 'light' | 'dark')"
          >
            {{ theme.label }}
          </button>
        </div>

        <!-- 字体大小选择 -->
        <div class="option-group">
          <label class="option-label">{{ $t('fontSize') }}:</label>
          <select
            :value="fontSize"
            @change="updateFontSize(Number(($event.target as HTMLSelectElement).value))"
            class="font-size-select"
          >
            <option v-for="size in [12, 14, 16, 18, 20, 24, 28, 32]" :key="size" :value="size">
              {{ size }}px
            </option>
          </select>
        </div>
      </div>

      <div class="diff-actions">
        <button class="action-btn" @click="clearAll">
          <Icon icon="iconClose" />
          {{ $t('clear') }}
        </button>
        <button class="action-btn" @click="swapTexts">
          <Icon icon="iconSwap" />
          {{ $t('swap') }}
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="diff-content">
      <!-- 上部：输入区域 -->
      <div class="input-section">
        <!-- 原文本 -->
        <div class="diff-panel input-area">
          <div class="panel-header">
            <label>{{ $t('original') }}</label>
            <span class="char-count">{{ originalText.length }} {{ $t('chars') }}</span>
          </div>
          <textarea
            v-model="originalText"
            :placeholder="$t('originalPlaceholder')"
            class="diff-textarea"
            @input="handleTextChange"
          ></textarea>
        </div>

        <!-- 修改后文本 -->
        <div class="diff-panel input-area">
          <div class="panel-header">
            <label>{{ $t('modified') }}</label>
            <span class="char-count">{{ modifiedText.length }} {{ $t('chars') }}</span>
          </div>
          <textarea
            v-model="modifiedText"
            :placeholder="$t('modifiedPlaceholder')"
            class="diff-textarea"
            @input="handleTextChange"
          ></textarea>
        </div>
      </div>

      <!-- 下部：差异显示 -->
      <div class="diff-panel result">
        <div class="panel-header">
          <label>{{ $t('diffResult') }}</label>
        </div>
        <Diff
          class="diff-content-viewer"
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
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { Diff } from 'vue-diff'
import 'vue-diff/dist/index.css'
import type { Plugin } from 'siyuan'
import { loadTextDiffSettings, saveTextDiffSettings, type TextDiffSettings } from '../../../config/settings'

const props = defineProps<{
  onClose?: () => void
  i18n?: any
  plugin?: Plugin  // 添加 plugin 参数用于API调用
}>()

// 响应式数据
const originalText = ref('')
const modifiedText = ref('')
const diffMode = ref<'split' | 'unified'>('split')
const diffTheme = ref<'light' | 'dark'>('light')
const fontSize = ref<number>(14)

// 处理文本变化
const handleTextChange = () => {
  // vue-diff 会自动处理差异计算
}

// 加载保存的设置
const loadSettings = async () => {
  if (props.plugin) {
    try {
      const settings = await loadTextDiffSettings(props.plugin)
      diffMode.value = settings.diffMode
      diffTheme.value = settings.theme
      fontSize.value = settings.fontSize
      // 加载设置后立即更新字体大小
      setFontSize(settings.fontSize)
    } catch (error) {
      console.error('加载文本对比设置失败:', error)
    }
  }
}

// 保存当前设置
const saveSettings = async () => {
  if (props.plugin) {
    try {
      const settings: TextDiffSettings = {
        fontSize: fontSize.value,
        diffMode: diffMode.value,
        theme: diffTheme.value
      }
      await saveTextDiffSettings(props.plugin, settings)
    } catch (error) {
      console.error('保存文本对比设置失败:', error)
    }
  }
}

// 监听设置变化并保存
const updateMode = (mode: 'split' | 'unified') => {
  diffMode.value = mode
  saveSettings()
}

const updateTheme = (theme: 'light' | 'dark') => {
  diffTheme.value = theme
  saveSettings()
}

const updateFontSize = (size: number) => {
  fontSize.value = size
  setFontSize(size)  // 立即更新字体大小
  saveSettings()     // 保存到数据库
}

// 设置字体大小的 CSS 变量
const setFontSize = (size: number) => {
  document.documentElement.style.setProperty('--diff-font-size', `${size}px`)
}

// 组件挂载时加载设置
onMounted(() => {
  loadSettings()
  // 初始设置字体大小
  setFontSize(fontSize.value)
})

// 清空所有文本
function clearAll() {
  originalText.value = ''
  modifiedText.value = ''
}

// 交换文本内容
function swapTexts() {
  const temp = originalText.value
  originalText.value = modifiedText.value
  modifiedText.value = temp
}

// 国际化函数
const $t = (key: string) => {
  if (props.i18n && props.i18n.textDiff && props.i18n.textDiff[key]) {
    return props.i18n.textDiff[key]
  }
  // 回退到硬编码的翻译
  const translations: Record<string, string> = {
    clear: '清空',
    swap: '交换',
    original: '原文本',
    modified: '修改后文本',
    diffResult: '差异结果',
    chars: '字符',
    originalPlaceholder: '请输入原始文本...',
    modifiedPlaceholder: '请输入修改后的文本...',
    emptyState: '请输入文本以查看差异'
  }
  return translations[key] || key
}
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

.diff-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);

  .diff-options {
    display: flex;
    gap: 20px;
    align-items: center;

    .option-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .option-label {
        font-size: 13px;
        color: var(--b3-theme-on-surface);
        font-weight: 500;
      }

      .option-btn {
        padding: 4px 10px;
        border: 1px solid var(--b3-theme-surface-lighter);
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-background);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;

        &:hover {
          background: var(--b3-theme-surface-light);
        }

        &.active {
          background: var(--b3-theme-primary);
          color: var(--b3-theme-on-primary);
          border-color: var(--b3-theme-primary);
        }
      }
    }
  }

  .diff-actions {
    display: flex;
    gap: 8px;

    .action-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--b3-theme-surface-lighter);
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--b3-theme-surface-light);
      }

      .iconify {
        font-size: 16px;
      }
    }
  }
}

.diff-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.input-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--b3-theme-surface-lighter);
  flex-shrink: 0;
  max-height: 40vh;
  overflow: hidden;

  .input-area {
    min-height: 200px;
  }
}

.result {
  flex: 1;
  min-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diff-panel {
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  overflow: hidden;

  .panel-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--b3-theme-surface);
    border-bottom: 1px solid var(--b3-theme-surface-lighter);

    label {
      font-weight: 500;
      color: var(--b3-theme-on-surface);
    }

    .char-count {
      font-size: 12px;
      color: var(--b3-theme-on-surface-variant);
    }

    .diff-stats {
      display: flex;
      gap: 8px;
      font-size: 12px;

      .added {
        color: var(--b3-theme-success);
      }

      .removed {
        color: var(--b3-theme-error);
      }
    }
  }
}

.diff-textarea {
  width: 100%;
  height: 100%;
  padding: 12px;
  border: none;
  outline: none;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: var(--b3-font-family);
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  font-size: var(--diff-font-size, 14px);

  &::placeholder {
    color: var(--b3-theme-outline);
  }
}

.input-area {
  .diff-textarea {
    min-height: 160px;
  }
}

.font-size-select {
  padding: 4px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-light);
  }

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.diff-content-viewer {
  height: 400px;
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



// 响应式设计
@media (max-width: 1024px) {
  .input-section {
    grid-template-columns: 1fr;
    max-height: 50vh;
  }
}

@media (max-width: 768px) {
  .diff-toolbar {
    flex-direction: column;
    gap: 12px;
    padding: 8px 12px;

    .diff-options {
      flex-direction: column;
      gap: 12px;
      width: 100%;

      .option-group {
        flex-wrap: wrap;
        justify-content: center;
      }
    }

    .diff-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }

  .diff-content {
    height: calc(100vh - 100px);
  }
}
</style>
