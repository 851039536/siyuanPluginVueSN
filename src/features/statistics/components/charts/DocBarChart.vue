<!-- 横向文档柱状图：各笔记本文档数排行可视化 -->
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
import { useNotebookHover } from "../../composables/useNotebookHover"
import {
  formatNumber,
  formatShortNumber,
} from "../../utils"

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
@use "../../styles/DocBarChart.scss";
</style>
