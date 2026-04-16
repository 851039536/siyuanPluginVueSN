<template>
  <div class="stats-overview">
    <div class="stats-header">
      <span class="stats-title">文档统计概览</span>
      <button class="analyze-btn" :disabled="loading" @click="$emit('analyze')">
        <Icon :icon="loading ? 'mdi:loading' : 'mdi:chart-bar'" :class="{ 'spin-icon': loading }" />
        {{ loading ? '分析中...' : '分析' }}
      </button>
    </div>

    <template v-if="hasAnalyzed">
      <div class="stats-cards">
        <div
          class="stat-card"
          :class="{ active: activeFilter === '0B' }"
          @click="$emit('select-category', '0B')"
        >
          <div class="stat-value zero">{{ stats.zeroByteDocs }}</div>
          <div class="stat-label">0B 空文档</div>
        </div>
        <div
          class="stat-card"
          :class="{ active: activeFilter === 'small' }"
          @click="$emit('select-category', 'small')"
        >
          <div class="stat-value small">{{ stats.smallDocs }}</div>
          <div class="stat-label">&lt; 1KB</div>
        </div>
        <div
          class="stat-card"
          :class="{ active: activeFilter === 'medium' }"
          @click="$emit('select-category', 'medium')"
        >
          <div class="stat-value medium">{{ stats.mediumDocs }}</div>
          <div class="stat-label">1~10KB</div>
        </div>
        <div class="stat-card total">
          <div class="stat-value">{{ stats.totalDocs }}</div>
          <div class="stat-label">总文档数</div>
        </div>
      </div>
    </template>

    <div v-else class="stats-placeholder">
      <Icon icon="mdi:chart-box-outline" class="placeholder-icon" />
      <p>点击「分析」查看文档统计</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { DocStats } from "../types/index";

interface Props {
  stats: DocStats;
  loading: boolean;
  hasAnalyzed: boolean;
  activeFilter: string;
}

defineProps<Props>();

defineEmits<{
  (e: "analyze"): void;
  (e: "select-category", category: string): void;
}>();
</script>

<style lang="scss" scoped>
.stats-overview {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .stats-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .analyze-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
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

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  }
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border-radius: 8px;
  background: var(--b3-theme-surface-light);
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid transparent;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
  }

  &.total {
    cursor: default;
    background: var(--b3-theme-surface);
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--b3-theme-on-background);
    line-height: 1.2;

    &.zero {
      color: var(--b3-theme-error, #ef4444);
    }

    &.small {
      color: var(--b3-theme-warning, #f59e0b);
    }

    &.medium {
      color: var(--b3-theme-info, #3b82f6);
    }
  }

  .stat-label {
    font-size: 11px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 2px;
    white-space: nowrap;
  }
}

.stats-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 13px;
  gap: 6px;

  .placeholder-icon {
    font-size: 36px;
    opacity: 0.35;
  }

  p {
    margin: 0;
  }
}
</style>
