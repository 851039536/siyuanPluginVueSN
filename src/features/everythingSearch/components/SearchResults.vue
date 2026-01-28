<template>
  <div class="results-area">
    <!-- 加载状态 -->
    <div v-if="state.status === 'loading'" class="loading-state">
      <div class="loading-spinner-large"></div>
      <p>正在搜索...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="state.status === 'error'" class="error-state">
      <span class="error-icon">❌</span>
      <p>{{ state.errorMessage }}</p>
    </div>

    <!-- 空状态（未搜索） -->
    <div v-else-if="state.status === 'idle'" class="empty-state">
      <span class="empty-icon">📁</span>
      <p>{{ emptyHintText }}</p>
      <p class="hint">支持通配符: * 匹配任意字符, ? 匹配单个字符</p>
    </div>

    <!-- 无结果 -->
    <div v-else-if="state.status === 'empty'" class="empty-state">
      <span class="empty-icon">🔍</span>
      <p>未找到匹配的文件</p>
    </div>

    <!-- 结果列表 -->
    <div v-else class="results-list">
      <div class="results-header">
        <span class="results-count-text">找到 {{ state.results.length }} 个结果</span>
      </div>
      <div class="results-scroll">
        <ResultItem
          v-for="(item, index) in state.results"
          :key="`${item.name}-${item.path}-${index}`"
          :item="item"
          @click="handleItemClick"
          @dbl-click="handleItemDblClick"
          @open="handleItemOpen"
          @show-in-folder="handleItemShowInFolder"
          @copy-path="handleItemCopyPath"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ResultItem from './ResultItem.vue'
import type { EverythingSearchResult, SearchState } from '../types'

interface Props {
  /** 搜索状态 */
  state: SearchState
  /** 是否启用自动搜索 */
  autoSearch?: boolean
}

interface Emits {
  (e: 'itemClick', item: EverythingSearchResult): void
  (e: 'itemDblClick', item: EverythingSearchResult): void
  (e: 'itemOpen', item: EverythingSearchResult): void
  (e: 'itemShowInFolder', item: EverythingSearchResult): void
  (e: 'itemCopyPath', item: EverythingSearchResult): void
}

const props = withDefaults(defineProps<Props>(), {
  autoSearch: true
})

const emit = defineEmits<Emits>()

/** 空状态提示文本 */
const emptyHintText = computed(() => {
  return props.autoSearch
    ? '输入关键词自动搜索本地文件'
    : '输入关键词点击搜索按钮搜索本地文件'
})

/** 处理项目点击 */
const handleItemClick = (item: EverythingSearchResult) => {
  emit('itemClick', item)
}

/** 处理项目双击 */
const handleItemDblClick = (item: EverythingSearchResult) => {
  emit('itemDblClick', item)
}

/** 处理项目打开 */
const handleItemOpen = (item: EverythingSearchResult) => {
  emit('itemOpen', item)
}

/** 处理在文件夹中显示 */
const handleItemShowInFolder = (item: EverythingSearchResult) => {
  emit('itemShowInFolder', item)
}

/** 处理复制路径 */
const handleItemCopyPath = (item: EverythingSearchResult) => {
  emit('itemCopyPath', item)
}
</script>

<style lang="scss">
@use "@/variables" as *;

.results-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  font-family: $font-body;
}

.loading-spinner-large {
  width: 28px;
  height: 28px;
  border: 2px solid var(--b3-border-color);
  border-top-color: $brand-orange;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon,
.error-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.hint {
  font-size: 11px;
  margin-top: 6px;
  opacity: 0.7;
}

/* 结果列表 */
.results-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-header {
  padding: 6px 16px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
}

.results-count-text {
  font-size: 11px;
  font-family: $font-body;
  color: var(--b3-theme-on-surface);
}

.results-scroll {
  flex: 1;
  overflow-y: auto;

  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: $brand-light-gray;
    border-radius: 3px;

    &:hover {
      background: $brand-mid-gray;
    }
  }
}
</style>
