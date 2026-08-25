<!-- 文档过滤设置组件 - 标题/全文搜索 + 字数/笔记本/书签过滤 -->
<template>
  <div class="doc-analysis-filter">
    <!-- 第一行：主搜索 -->
    <div class="filter-row">
      <input
        v-model="options.titleKeyword"
        type="text"
        class="filter-input title-input"
        placeholder="标题搜索"
        @input="handleDebouncedInput"
        @keyup.enter="triggerQuery"
      />
      <input
        v-model="options.contentKeyword"
        type="text"
        class="filter-input content-input"
        placeholder="全文搜索"
        @input="handleDebouncedInput"
        @keyup.enter="triggerQuery"
      />
      <button
        v-if="hasAnyFilter"
        class="clear-btn"
        title="清空所有过滤条件"
        @click="$emit('reset')"
      >
        <Icon
          icon="mdi:filter-remove-outline"
          :size="14"
        />
      </button>
      <button
        class="query-btn"
        :disabled="isQuerying"
        @click="triggerQuery"
      >
        <Icon
          :icon="isQuerying ? 'mdi:loading' : 'mdi:magnify'"
          :class="{ 'spin-icon': isQuerying }"
          class="btn-icon"
        />
        {{ isQuerying ? '查询中' : '查询' }}
      </button>
    </div>
    <!-- 第二行：辅助过滤 -->
    <div class="filter-row filter-row-secondary">
      <div class="filter-group">
        <input
          v-model.number="options.wordCountMin"
          type="number"
          class="filter-input wordcount-input"
          min="0"
          placeholder="字数"
          @keyup.enter="triggerQuery"
        />
        <span class="filter-separator">~</span>
        <input
          v-model.number="options.wordCountMax"
          type="number"
          class="filter-input wordcount-input"
          min="0"
          placeholder="上限"
          @keyup.enter="triggerQuery"
        />
      </div>
      <select
        v-model="options.notebookId"
        class="filter-select notebook-select"
      >
        <option value="">
          全部笔记本
        </option>
        <option
          v-for="nb in notebooks"
          :key="nb.id"
          :value="nb.id"
        >
          {{ nb.name }}
        </option>
      </select>
      <input
        v-model="options.bookmarkName"
        type="text"
        class="filter-input bookmark-input"
        placeholder="书签"
        @input="handleDebouncedInput"
        @keyup.enter="triggerQuery"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilterOptions, NotebookInfo } from "../../types/index"
import { DEFAULT_FILTER_OPTIONS } from "../../types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  onBeforeUnmount,
} from "vue"

interface Props {
  options: FilterOptions
  notebooks: NotebookInfo[]
  isQuerying: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "query"): void
  (e: "reset"): void
}>()

let debounceTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})

/** 是否有任何非空过滤条件 */
const hasAnyFilter = computed(() => {
  const o = props.options
  return !!(
    o.titleKeyword
    || o.contentKeyword
    || o.wordCountMin > 0
    || o.wordCountMax !== DEFAULT_FILTER_OPTIONS.wordCountMax
    || o.notebookId
    || o.bookmarkName
  )
})

/** 统一触发查询：清除待执行的防抖查询，避免回车/按钮与防抖重复触发 */
function triggerQuery() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  emit("query")
}

/** 标题/全文输入防抖查询（输入停顿 500ms 后自动触发） */
function handleDebouncedInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    emit("query")
  }, 500)
}
</script>

<style lang="scss" scoped>
@use "../../styles/FilterSettings.scss";
</style>
