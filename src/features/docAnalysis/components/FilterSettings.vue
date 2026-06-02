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
      />
      <input
        v-model="options.contentKeyword"
        type="text"
        class="filter-input content-input"
        placeholder="全文搜索"
        @input="handleDebouncedInput"
      />
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
        />
        <span class="filter-separator">~</span>
        <input
          v-model.number="options.wordCountMax"
          type="number"
          class="filter-input wordcount-input"
          min="0"
          placeholder="上限"
          @change="handleChange"
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
      />
      <div class="filter-group">
        <input
          v-model="options.updatedAfter"
          type="date"
          class="filter-input date-input"
          title="更新起始日期"
          @change="handleChange"
        />
        <span class="filter-separator">~</span>
        <input
          v-model="options.updatedBefore"
          type="date"
          class="filter-input date-input"
          title="更新截止日期"
          @change="handleChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotebookInfo } from "../composables/useDocAnalysis"
import type { FilterOptions } from "../types/index"
import { Icon } from "@iconify/vue"

interface Props {
  options: FilterOptions
  notebooks: NotebookInfo[]
  isQuerying: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "query"): void
  (e: "update:options", options: FilterOptions): void
}>()

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function handleChange() {
  emit("update:options", { ...props.options })
}

/** 标题/全文输入防抖查询 */
function handleDebouncedInput() {
  handleChange()
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit("query")
  }, 500)
}
</script>

<style lang="scss" scoped>
.doc-analysis-filter {
  padding: 6px 10px;
  border-bottom: 1px solid var(--b3-border-color);
  display: flex;
  flex-direction: column;
  gap: 4px;

  .filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-row-secondary {
    gap: 4px;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .filter-input {
    padding: 4px 6px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 12px;
    outline: none;
    min-width: 0;

    &:focus {
      border-color: var(--b3-theme-primary);
    }
  }

  .title-input {
    flex: 1;
    min-width: 0;
  }

  .content-input {
    flex: 1;
    min-width: 0;
  }

  .wordcount-input {
    width: 42px;
    text-align: center;
  }

  .bookmark-input {
    width: 54px;
  }

  .date-input {
    width: 94px;
    font-size: 11px;
    padding: 3px 4px;

    &::-webkit-calendar-picker-indicator {
      filter: var(--b3-theme-on-surface-variant);
      cursor: pointer;
    }
  }

  .filter-select {
    padding: 4px 4px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 12px;
    outline: none;
    cursor: pointer;
    min-width: 0;

    &:focus {
      border-color: var(--b3-theme-primary);
    }
  }

  .notebook-select {
    width: 84px;
  }

  .filter-separator {
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);
    flex-shrink: 0;
  }

  .query-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;

    &:hover:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-icon {
      font-size: 14px;
    }
  }
}
</style>
