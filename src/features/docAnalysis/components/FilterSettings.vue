<template>
  <div class="doc-analysis-filter">
    <div class="filter-row">
      <div class="filter-item title-item">
        <label class="filter-label">标题</label>
        <input
          v-model="options.titleKeyword"
          type="text"
          class="filter-input title-input"
          placeholder="标题搜索"
          @input="handleDebouncedInput"
        />
      </div>
      <div class="filter-item content-item">
        <label class="filter-label">全文</label>
        <input
          v-model="options.contentKeyword"
          type="text"
          class="filter-input content-input"
          placeholder="内容搜索"
          @input="handleDebouncedInput"
        />
      </div>
      <div class="filter-item wordcount-item">
        <label class="filter-label">字数</label>
        <input
          v-model.number="options.wordCountMin"
          type="number"
          class="filter-input wordcount-input"
          min="0"
          placeholder="最小"
          @change="handleChange"
        />
        <span class="filter-separator">~</span>
        <input
          v-model.number="options.wordCountMax"
          type="number"
          class="filter-input wordcount-input"
          min="0"
          placeholder="最大"
          @change="handleChange"
        />
      </div>
      <div class="filter-item">
        <label class="filter-label">笔记本</label>
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
      </div>
      <button
        class="query-btn"
        :disabled="isQuerying"
        @click="$emit('query')"
      >
        <Icon
          icon="mdi:magnify"
          class="btn-icon"
        />
        {{ isQuerying ? '查询中...' : '查询' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilterOptions } from "../types/index"
import { Icon } from "@iconify/vue"

interface NotebookInfo {
  id: string
  name: string
}

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
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);

  .filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-label {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    white-space: nowrap;
    font-weight: 500;
  }

  .filter-input {
    width: 80px;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    outline: none;

    &:focus {
      border-color: var(--b3-theme-primary);
    }
  }

  .filter-select {
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    outline: none;
    cursor: pointer;

    &:focus {
      border-color: var(--b3-theme-primary);
    }
  }

  .notebook-select {
    max-width: 140px;
  }

  .title-input {
    width: 90px;
  }

  .content-input {
    width: 90px;
  }

  .wordcount-item {
    gap: 4px;
  }

  .wordcount-input {
    width: 55px;
  }

  .filter-separator {
    font-size: 13px;
    color: var(--b3-theme-on-surface-variant);
  }

  .query-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-size: 13px;
    cursor: pointer;

    &:hover:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-icon {
      font-size: 16px;
    }
  }
}
</style>
