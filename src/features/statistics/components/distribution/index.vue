<!-- 笔记本分布 Tab 入口容器：自加载笔记本统计并编排分布图表 -->
<template>
  <div class="notebook-distribution-tab">
    <!-- 汇总摘要 -->
    <div
      v-if="distSummary"
      class="dist-summary-bar"
    >
      <span class="dist-summary-item">
        <span class="dist-summary-label">{{ i18n.notebookName }}</span>
        <span class="dist-summary-value">{{ distSummary.notebookCount }}</span>
      </span>
      <span class="dist-summary-sep">·</span>
      <span class="dist-summary-item">
        <span class="dist-summary-label">{{ i18n.docBarChartTitle }}</span>
        <span class="dist-summary-value">{{ distSummary.totalDocs.toLocaleString() }}</span>
      </span>
      <span class="dist-summary-sep">·</span>
      <span class="dist-summary-item">
        <span class="dist-summary-label">{{ i18n.totalWords }}</span>
        <span class="dist-summary-value">{{ distSummary.totalWords.toLocaleString() }} {{ i18n.wordsUnit }}</span>
      </span>
    </div>

    <!-- 左侧：文档数条形图（全高） -->
    <section class="dist-section dist-left">
      <DocBarChart
        :title="i18n.docBarChartTitle"
        :chart-data="notebookDocStats"
        :loading="docChartLoading"
        :i18n="i18n"
      />
    </section>

    <!-- 右侧上：块类型分布 -->
    <section class="dist-section dist-right-top">
      <DocBarChart
        :title="i18n.blockTypeStats"
        :chart-data="(stats?.blockTypeStats ?? []).map(item => ({
          name: item.label,
          count: item.count,
        }))"
        :i18n="i18n"
      />
    </section>

    <!-- 右侧下：饼图 -->
    <section class="dist-section dist-right-bottom">
      <h3 class="dist-section-title">
        {{ i18n.notebookWordPie }}
      </h3>
      <NotebookWordPie :data="notebookWordStats" />
    </section>

    <!-- 底部全宽：堆叠条形图 -->
    <section class="dist-section dist-bottom">
      <h3 class="dist-section-title">
        {{ i18n.notebookBlockTypeTitle }}
      </h3>
      <NotebookBlockTypeChart :data="notebookBlockTypeStats" />
    </section>

    <!-- 表格视图：可排序详情 -->
    <section class="dist-section dist-table">
      <h3 class="dist-section-title">
        {{ i18n.notebookRanking }}
      </h3>
      <NotebookTable
        :doc-stats="notebookDocStats"
        :word-stats="notebookWordStats"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
// 笔记本分布 Tab 入口容器：自包含数据加载（首次激活时懒加载）
import {
  computed,
  watch,
} from "vue"
import type { StatisticsData } from "../../types"
import {
  provideNotebookHover,
} from "../../composables/useNotebookHover"
import { useNotebookStats } from "../../composables/useNotebookStats"
import DocBarChart from "./DocBarChart.vue"
import NotebookBlockTypeChart from "./NotebookBlockTypeChart.vue"
import NotebookTable from "./NotebookTable.vue"
import NotebookWordPie from "./NotebookWordPie.vue"

interface Props {
  active?: boolean
  stats?: StatisticsData | null
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  stats: null,
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n || {})

const {
  notebookDocStats,
  docChartLoading,
  notebookWordStats,
  notebookBlockTypeStats,
  loadNotebookDocStats,
  loadNotebookWordStats,
  loadNotebookBlockTypeStats,
} = useNotebookStats()

// 笔记本分布 hover 联动
provideNotebookHover()

// 分布 Tab 汇总摘要
const distSummary = computed(() => {
  const docs = notebookDocStats.value
  const words = notebookWordStats.value
  if (!docs.length && !words.length) return null
  const totalDocs = docs.reduce((s, d) => s + d.count, 0)
  const totalWords = words.reduce((s, d) => s + d.words, 0)
  return {
    notebookCount: docs.length || words.length,
    totalDocs,
    totalWords,
  }
})

let notebookStatsLoaded = false

async function loadNotebookStats(): Promise<void> {
  if (notebookStatsLoaded) return
  await Promise.all([
    loadNotebookDocStats(),
    loadNotebookWordStats(),
    loadNotebookBlockTypeStats(),
  ])
  notebookStatsLoaded = true
}

// 首次切换到分布 Tab 时懒加载
watch(() => props.active, (active) => {
  if (active) {
    loadNotebookStats()
  }
})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
