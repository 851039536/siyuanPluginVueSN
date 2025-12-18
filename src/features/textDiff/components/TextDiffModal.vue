<template>
  <div class="text-diff-container">
    <!-- 工具栏 -->
    <div class="diff-toolbar">
      <div class="diff-options">
        <!-- 模式选择 -->
        <div class="option-group">
          <label class="option-label">显示模式:</label>
          <button
            v-for="mode in [
              { value: 'split', label: '分栏' },
              { value: 'unified', label: '统一' }
            ]"
            :key="mode.value"
            :class="['option-btn', { active: diffMode === mode.value }]"
            @click="diffMode = mode.value as 'split' | 'unified'"
          >
            {{ mode.label }}
          </button>
        </div>

        <!-- 主题选择 -->
        <div class="option-group">
          <label class="option-label">主题:</label>
          <button
            v-for="theme in [
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' }
            ]"
            :key="theme.value"
            :class="['option-btn', { active: diffTheme === theme.value }]"
            @click="diffTheme = theme.value as 'light' | 'dark'"
          >
            {{ theme.label }}
          </button>
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
      <!-- 左侧：输入区域 -->
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

      <!-- 右侧：差异显示 -->
      <div class="diff-panel result">
        <div class="panel-header">
          <label>{{ $t('diffResult') }}</label>
        </div>
        <Diff
          :mode="diffMode"
          :theme="diffTheme"
          language="plaintext"
          :prev="originalText"
          :current="modifiedText"
          :folding="false"
          :virtual-scroll="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { Diff } from 'vue-diff'
import 'vue-diff/dist/index.css'

const props = defineProps<{
  onClose?: () => void
  i18n?: any
}>()

// 响应式数据
const originalText = ref('')
const modifiedText = ref('')
const diffMode = ref<'split' | 'unified'>('split')
const diffTheme = ref<'light' | 'dark'>('light')

// 处理文本变化
const handleTextChange = () => {
  // vue-diff 会自动处理差异计算
}


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
  display: grid;
  grid-template-columns: 1fr 2fr;
  background: var(--b3-theme-surface-lighter);
  overflow: hidden;
}

.diff-panel {
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);

  .panel-header {
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
  padding: 8px;
  border: none;
  outline: none;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: var(--b3-font-family);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  min-height: 120px;

  &::placeholder {
    color: var(--b3-theme-outline);
  }
}

.input-area {
  .diff-textarea {
    flex: 1;
  }
}

.diff-result {
  flex: 1;
  padding: 1px;
  overflow-x: auto;
  overflow-y: auto;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--b3-theme-outline);
    font-style: italic;
    white-space: normal;
    font-size: 11px;
  }
}



// 响应式设计
@media (max-width: 1024px) {
  .diff-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

@media (max-width: 768px) {
  .diff-toolbar {
    flex-direction: column;
    gap: 12px;

    .diff-options {
      flex-direction: column;
      gap: 12px;
      width: 100%;

      .option-group {
        flex-wrap: wrap;
      }
    }

    .diff-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
}
</style>
