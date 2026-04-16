<template>
  <div class="doc-analysis-filter">
    <div class="filter-row">
      <div class="filter-item threshold-item">
        <label class="filter-label">内容大小 &lt;</label>
        <input
          v-model.number="options.threshold"
          type="number"
          class="filter-input"
          min="0"
          placeholder="阈值"
          @change="handleChange"
        />
        <select
          v-model="options.unit"
          class="filter-select"
          @change="handleChange"
        >
          <option value="B">B</option>
          <option value="KB">KB</option>
          <option value="MB">MB</option>
        </select>
      </div>
      <div class="filter-item">
        <label class="filter-label">笔记本</label>
        <select
          v-model="options.notebookId"
          class="filter-select notebook-select"
          @change="handleChange"
        >
          <option value="">全部笔记本</option>
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
        <Icon icon="mdi:magnify" class="btn-icon" />
        {{ isQuerying ? '查询中...' : '查询' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { FilterOptions } from "../types/index";

interface NotebookInfo {
  id: string;
  name: string;
}

interface Props {
  options: FilterOptions;
  notebooks: NotebookInfo[];
  isQuerying: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "query"): void;
  (e: "update:options", options: FilterOptions): void;
}>();

function handleChange() {
  emit("update:options", { ...props.options });
}
</script>

<style lang="scss" scoped>
.doc-analysis-filter {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter, rgba(0, 0, 0, 0.06));

  .filter-row {
    display: flex;
    align-items: center;
    gap: 12px;
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
    border: 1px solid var(--b3-theme-surface-lighter, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;

    &:focus {
      border-color: var(--b3-theme-primary);
    }
  }

  .filter-select {
    padding: 4px 8px;
    border: 1px solid var(--b3-theme-surface-lighter, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;

    &:focus {
      border-color: var(--b3-theme-primary);
    }
  }

  .notebook-select {
    max-width: 160px;
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
    transition: opacity 0.15s;

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
