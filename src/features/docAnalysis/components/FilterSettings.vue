<!-- 文档过滤设置组件 - 标题/全文搜索 + 字数/笔记本/书签/日期过滤 -->
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
        @keyup.enter="$emit('query')"
      />
      <input
        v-model="options.contentKeyword"
        type="text"
        class="filter-input content-input"
        placeholder="全文搜索"
        @input="handleDebouncedInput"
        @keyup.enter="$emit('query')"
      />
      <button
        v-if="hasAnyFilter"
        class="clear-btn"
        title="清空所有过滤条件"
        @click="handleClearAll"
      >
        <Icon
          icon="mdi:filter-remove-outline"
          :size="14"
        />
      </button>
      <button
        class="query-btn"
        :disabled="isQuerying"
        @click="$emit('query')"
      >
        <Icon
          icon="mdi:magnify"
          class="btn-icon"
        />
        {{ isQuerying ? '...' : '查询' }}
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
          @change="handleChange"
          @keyup.enter="$emit('query')"
        />
        <span class="filter-separator">~</span>
        <input
          v-model.number="options.wordCountMax"
          type="number"
          class="filter-input wordcount-input"
          min="0"
          placeholder="上限"
          @change="handleChange"
          @keyup.enter="$emit('query')"
        />
      </div>
      <select
        v-model="options.notebookId"
        class="filter-select notebook-select"
        @change="handleChange"
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
        @keyup.enter="$emit('query')"
      />
      <div class="filter-group date-group">
        <DateInput
          v-model="options.updatedAfter"
          placeholder="起始日期"
          class="date-picker"
          @update:model-value="handleChange"
        />
        <span class="filter-separator">~</span>
        <DateInput
          v-model="options.updatedBefore"
          placeholder="截止日期"
          class="date-picker"
          @update:model-value="handleChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotebookInfo } from "../types/index"
import type { FilterOptions } from "../types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  onBeforeUnmount,
} from "vue"
import DateInput from "./DateInput.vue"

interface Props {
  options: FilterOptions
  notebooks: NotebookInfo[]
  isQuerying: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "query"): void
  (e: "optionsUpdate", options: FilterOptions): void
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
    || o.wordCountMin
    || o.wordCountMax
    || o.notebookId
    || o.bookmarkName
    || o.updatedAfter
    || o.updatedBefore
  )
})

function handleChange() {
  emit("optionsUpdate", { ...props.options })
}

/** 标题/全文输入防抖查询 */
function handleDebouncedInput() {
  handleChange()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit("query")
  }, 500)
}

/** 一键清空所有过滤条件 */
function handleClearAll() {
  emit("reset")
}
</script>

<style lang="scss" scoped>
@use "../styles/FilterSettings.scss";
</style>
