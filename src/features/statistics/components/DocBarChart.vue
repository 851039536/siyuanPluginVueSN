<template>
  <div class="doc-bar-chart-section">
    <div class="section-title">{{ title }}</div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ i18n.loading || '加载中...' }}</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!chartData || chartData.length === 0" class="empty-hint">
      暂无数据
    </div>

    <template v-else>
      <div class="bar-chart-container">
        <div class="chart-viewport">
          <div
            v-for="item in sortedData"
            :key="item.name"
            class="bar-item"
          >
            <div v-if="item.count > 0" class="bar-value">
              {{ formatShortNumber(item.count) }}
            </div>
            <div
              class="bar"
              :style="{ height: getBarHeight(item.count) + 'px' }"
              :title="`${item.name}: ${formatNumber(item.count)} ${i18n.docsUnit || '篇'}`"
            ></div>
            <div class="bar-label" :title="item.name">
              {{ truncateName(item.name) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 数据列表 -->
      <div class="data-list">
        <div
          v-for="item in sortedData"
          :key="item.name"
          class="data-item active"
        >
          <span class="data-name" :title="item.name">{{ item.name }}</span>
          <span class="data-value">{{ formatNumber(item.count) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber, formatShortNumber } from "../utils";

interface NotebookDocCount {
  name: string;
  count: number;
}

interface Props {
  title?: string;
  chartData?: NotebookDocCount[];
  loading?: boolean;
  sortBy?: "count" | "name";
  sortOrder?: "asc" | "desc";
  i18n?: {
    loading?: string;
    docsUnit?: string;
  };
}

const props = withDefaults(defineProps<Props>(), {
  title: "各笔记本文档数",
  chartData: () => [],
  loading: false,
  sortBy: "count",
  sortOrder: "desc",
  i18n: () => ({
    loading: "加载中...",
    docsUnit: "篇",
  }),
});

const maxCount = computed(() => {
  if (!props.chartData.length) return 0;
  return Math.max(...props.chartData.map((item) => item.count));
});

const sortedData = computed(() => {
  const data = [...props.chartData];
  data.sort((a, b) => {
    if (props.sortBy === "name") {
      const compare = a.name.localeCompare(b.name, "zh-CN");
      return props.sortOrder === "asc" ? compare : -compare;
    }
    return props.sortOrder === "asc"
      ? a.count - b.count
      : b.count - a.count;
  });
  return data;
});

function getBarHeight(count: number): number {
  const max = maxCount.value;
  if (max === 0) return 0;
  const maxHeight = 150;
  const height = (count / max) * maxHeight;
  return Math.max(height, count > 0 ? 5 : 0);
}

function truncateName(name: string): string {
  if (name.length <= 4) return name;
  return name.substring(0, 3) + "…";
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

.doc-bar-chart-section {
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 120px;
    color: var(--b3-theme-on-surface);

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--b3-border-color);
      border-top-color: var(--b3-theme-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 8px;
    }
  }

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
    font-size: 12px;
  }

  .bar-chart-container {
    overflow-x: auto;
    margin-bottom: 16px;
    padding-bottom: 6px;
    @include scrollbar-thin;

    &::-webkit-scrollbar {
      height: 3px;
    }
  }

  .chart-viewport {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    min-height: 160px;
    padding: 15px 5px 35px 5px;
    position: relative;

    .bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 36px;
      flex: 1;
      max-width: 60px;
      position: relative;
      transition: stats.$stats-transition;

      &:hover {
        .bar {
          filter: brightness(1.1);
          box-shadow: 0 0 8px rgba(var(--b3-theme-primary-rgb), 0.3);
        }

        .bar-value {
          opacity: 1;
          transform: translateX(-50%) translateY(-3px);
        }
      }

      .bar-value {
        position: absolute;
        font-family: $font-heading;
        font-size: 10px;
        font-weight: 700;
        color: var(--b3-theme-primary);
        white-space: nowrap;
        transform: translateX(-50%);
        left: 50%;
        opacity: 0.6;
        transition: stats.$stats-transition;
      }

      .bar {
        width: 100%;
        min-height: 3px;
        background: stats.$gradient-primary;
        border-radius: 4px 4px 1px 1px;
        cursor: pointer;
        transition: stats.$stats-transition;
      }

      .bar-label {
        position: absolute;
        bottom: -25px;
        font-family: $font-body;
        font-size: 10px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        opacity: 0.5;
        transform: rotate(-45deg);
        transform-origin: top left;
        white-space: nowrap;
        left: 50%;
        transition: stats.$stats-transition;
        cursor: default;
      }
    }
  }
}

.data-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;

  .data-item {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    background: var(--b3-theme-background);
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    transition: stats.$stats-transition;

    &:hover {
      border-color: var(--b3-theme-primary);
      transform: translateY(-1px);
    }

    &.active {
      background: var(--b3-theme-surface-lighter, rgba(var(--b3-theme-primary-rgb), 0.03));
    }

    .data-name {
      font-family: $font-body;
      font-size: 9px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .data-value {
      font-family: $font-heading;
      font-size: 14px;
      font-weight: 800;
      color: var(--b3-theme-on-surface);
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@include mobile-only {
  .doc-bar-chart-section {
    .chart-viewport {
      min-width: 500px;
    }
  }

  .data-list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
