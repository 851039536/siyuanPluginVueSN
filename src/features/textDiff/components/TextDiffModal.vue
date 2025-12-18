<template>
  <div class="text-diff-container">
    <!-- 工具栏 -->
    <div class="diff-toolbar">
      <div class="diff-modes">
        <button
          v-for="mode in diffModes"
          :key="mode.value"
          :class="['mode-btn', { active: currentMode === mode.value }]"
          @click="currentMode = mode.value"
        >
          {{ mode.label }}
        </button>
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
      <!-- 左侧：原文本 -->
      <div class="diff-panel original">
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

      <!-- 中间：修改后文本 -->
      <div class="diff-panel modified">
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
          <span v-if="diffStats" class="diff-stats">
            <span class="added">+{{ diffStats.added }}</span>
            <span class="removed">-{{ diffStats.removed }}</span>
          </span>
        </div>
        <div class="diff-result" v-html="diffResult"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { diff_match_patch } from 'diff-match-patch'

const props = defineProps<{
  onClose?: () => void
  i18n?: any
}>()

// 响应式数据
const originalText = ref('')
const modifiedText = ref('')
const currentMode = ref<'char' | 'word' | 'line' | 'patch'>('line')

// 差异模式配置
const diffModes = [
  { value: 'char', label: '字符' },
  { value: 'word', label: '词语' },
  { value: 'line', label: '行' },
  { value: 'patch', label: '补丁' }
]

// 创建 diff_match-patch 实例
const dmp = new diff_match_patch()

// 处理文本变化
const handleTextChange = () => {
  // 实时计算差异
}

// 计算差异结果
const diffResult = computed(() => {
  if (!originalText.value && !modifiedText.value) {
    return `<div class="empty-state">${$t('emptyState')}</div>`
  }

  let diffs: Array<[number, string]> = []

  switch (currentMode.value) {
    case 'char':
      diffs = dmp.diff_main(originalText.value, modifiedText.value)
      break
    case 'word':
      diffs = getWordDiff(originalText.value, modifiedText.value)
      break
    case 'line':
      diffs = getLineDiff(originalText.value, modifiedText.value)
      break
    case 'patch':
      return generatePatch()
  }

  // 对差异进行语义清理
  dmp.diff_cleanupSemantic(diffs)

  // 渲染差异
  return renderDiff(diffs)
})

// 计算差异统计
const diffStats = computed(() => {
  if (!originalText.value && !modifiedText.value) return null

  let diffs: Array<[number, string]> = []
  if (currentMode.value === 'patch') {
    return null
  } else if (currentMode.value === 'word') {
    diffs = getWordDiff(originalText.value, modifiedText.value)
  } else if (currentMode.value === 'line') {
    diffs = getLineDiff(originalText.value, modifiedText.value)
  } else {
    diffs = dmp.diff_main(originalText.value, modifiedText.value)
  }

  let added = 0
  let removed = 0

  diffs.forEach(([operation, text]) => {
    if (operation === 1) added += text.length
    else if (operation === -1) removed += text.length
  })

  return { added, removed }
})

// 获取词语级差异
function getWordDiff(text1: string, text2: string): Array<[number, string]> {
  // 改进的词语分割：支持中文、英文和标点
  const splitIntoWords = (text: string): string[] => {
    // 匹配中文字符、英文单词、数字、标点符号和空白
    return text.match(/[\u4e00-\u9fff]+|[a-zA-Z]+|\d+|[^\w\s\u4e00-\u9fff]|\s+/g) || [text]
  }

  const words1 = splitIntoWords(text1)
  const words2 = splitIntoWords(text2)

  const lineText1 = words1.join('\x00')
  const lineText2 = words2.join('\x00')

  const diffs = dmp.diff_main(lineText1, lineText2)
  dmp.diff_cleanupSemantic(diffs)

  return diffs.map(([op, text]) => [op, text.replace(/\x00/g, '')] as [number, string])
}

// 获取行级差异
function getLineDiff(text1: string, text2: string): Array<[number, string]> {
  const lines1 = text1.split('\n')
  const lines2 = text2.split('\n')

  // 将每行用特殊分隔符连接，让 diff-match-patch 处理
  const separator = '\u0000'
  const joinedText1 = lines1.join(separator)
  const joinedText2 = lines2.join(separator)

  const diffs = dmp.diff_main(joinedText1, joinedText2, false)
  dmp.diff_cleanupSemantic(diffs)

  // 将差异转换回行格式，确保每行都有换行符（除了最后一行）
  const lineDiffs: Array<[number, string]> = []

  // 重新构建行级差异，保持正确的行结构
  let currentPos1 = 0
  let currentPos2 = 0

  diffs.forEach(([op, text]) => {
    const segments = text.split(separator)

    segments.forEach((segment: string, index: number) => {
      const isLastSegment = index === segments.length - 1

      if (!isLastSegment) {
        // 不是最后一个分段，这代表一行
        if (segment || op === 0) {
          // 空行也要保留
          lineDiffs.push([op, segment + '\n'])
        }

        if (op === 0) {
          currentPos1++
          currentPos2++
        } else if (op === -1) {
          currentPos1++
        } else if (op === 1) {
          currentPos2++
        }
      } else if (segment && op !== 0) {
        // 最后一个分段且有内容（对于不完整的行）
        lineDiffs.push([op, segment])
      }
    })
  })

  return lineDiffs
}

// 生成补丁格式
function generatePatch(): string {
  // 使用 diff_match_patch 自带的 patch 生成功能
  const diffs = dmp.diff_main(originalText.value, modifiedText.value)
  dmp.diff_cleanupSemantic(diffs)

  // 生成标准的补丁格式
  const patches = dmp.patch_make(originalText.value, modifiedText.value, diffs)
  const patchText = dmp.patch_toText(patches)

  // 如果没有差异，返回空
  if (!patchText) {
    return `<pre>No differences found</pre>`
  }

  return `<pre>${patchText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
}

// 渲染差异结果
function renderDiff(diffs: Array<[number, string]>): string {
  // 使用 diff-match-patch 自带的渲染功能
  return dmp.diff_prettyHtml(diffs)
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

  .diff-modes {
    display: flex;
    gap: 8px;

    .mode-btn {
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

      &.active {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);
        border-color: var(--b3-theme-primary);
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
  grid-template-columns: 1fr 1fr 1fr;
  font-size: 10px;
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
  flex: 1;
  width: 100%;
  padding: 1px;
  border: none;
  outline: none;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: var(--b3-font-family);
  font-size: 11px;
  line-height: 1.5;
  resize: none;

  &::placeholder {
    color: var(--b3-theme-outline);
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
    grid-template-rows: 1fr 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .diff-toolbar {
    flex-direction: column;
    gap: 12px;

    .diff-modes {
      flex-wrap: wrap;
    }
  }
}
</style>
