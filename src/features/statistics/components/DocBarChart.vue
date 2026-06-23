<template>
  <div class="doc-bar-chart-section">
    <div class="section-title">
      {{ title }}
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="loading-wrapper"
    >
      <Loader />
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!chartData || chartData.length === 0"
      class="empty-hint"
    >
      暂无数据
    </div>

    <!-- 水平条形图 -->
    <div
      v-else
      class="horizontal-chart"
    >
      <div
        v-for="item in sortedData"
        :key="item.name"
        class="chart-row"
        :class="{ 'row-highlight': hoveredNotebook === item.name }"
        :title="`${item.name}: ${formatNumber(item.count)} ${i18n.docsUnit || '篇'}`"
        @mouseenter="onHover(item.name)"
        @mouseleave="onHover(null)"
      >
        <span class="row-label">{{ item.name }}</span>
        <div class="row-bar-wrap">
          <div
            class="row-bar"
            :style="{ width: getBarWidth(item.count) }"
          ></div>
        </div>
        <span class="row-count">{{ formatShortNumber(item.count) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
} from "vue"
import Loader from "@/components/Loader.vue"
import { useNotebookHover } from "../composables/useNotebookHover"
import {
  formatNumber,
  formatShortNumber,
} from "../utils"

interface NotebookDocCount {
  name: string
  count: number
}

interface Props {
  title?: string
  chartData?: NotebookDocCount[]
  loading?: boolean
  sortBy?: "count" | "name"
  sortOrder?: "asc" | "desc"
  i18n?: Record<string, any>
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
})

const {
  hoveredNotebook,
  onHover,
} = useNotebookHover()

const maxCount = computed(() => {
  if (!props.chartData.length) return 0
  return Math.max(...props.chartData.map((item) => item.count))
})

const sortedData = computed(() => {
  const data = [...props.chartData]
  data.sort((a, b) => {
    if (props.sortBy === "name") {
      const compare = a.name.localeCompare(b.name, "zh-CN")
      return props.sortOrder === "asc" ? compare : -compare
    }
    return props.sortOrder === "asc"
      ? a.count - b.count
      : b.count - a.count
  })
  return data
})

function getBarWidth(count: number): string {
  const max = maxCount.value
  if (max === 0) return "0%"
  return `${Math.max((count / max) * 100, count > 0 ? 1 : 0)}%`
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

.doc-bar-chart-section {
  display: flex;
  flex-direction: column;
  min-height: 0;

  .section-title {
    margin: 0 0 10px 0;
    font-family: stats.$font-mono;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }

  .loading-wrapper {
    position: relative;
    height: 100px;
  }

  .empty-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
    font-size: 12px;
  }

  .horizontal-chart {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    @include scrollbar-thin;

    .chart-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 4px;
      transition: background 0.15s, box-shadow 0.15s;

      &:hover {
        background: var(--b3-list-hover);
      }

      &.row-highlight {
        background: rgba(var(--b3-theme-primary-rgb), 0.1);
        box-shadow: inset 3px 0 0 var(--b3-theme-primary);
      }

      .row-label {
        flex-shrink: 0;
        width: 80px;
        font-family: $font-body;
        font-size: 11px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: right;
      }

      .row-bar-wrap {
        flex: 1;
        height: 14px;
        background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
        border-radius: 4px;
        overflow: hidden;
        min-width: 20px;

        .row-bar {
          height: 100%;
          background: stats.$gradient-primary;
          border-radius: 4px;
          transition: width 0.3s ease;
          min-width: 2px;
        }
      }

      .row-count {
        flex-shrink: 0;
        width: 36px;
        font-family: stats.$font-mono;
        font-size: 10px;
        font-weight: 700;
        color: var(--b3-theme-primary);
        text-align: right;
        white-space: nowrap;
      }
    }
  }
}
</style>
