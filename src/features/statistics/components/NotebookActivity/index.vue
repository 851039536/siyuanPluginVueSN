<!-- 活跃度 Tab 入口：范围选择 + 摘要 + 图表 + 排行编排 -->
<template>
  <div class="activity-page">
    <!-- 时间范围选择 -->
    <div class="range-selector">
      <button
        v-for="opt in periodOptions"
        :key="opt.value"
        class="range-btn"
        :class="{ active: days === opt.value }"
        @click="switchPeriod(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- 统计摘要 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-value">
          {{ metrics.summary.activeCount }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："活跃笔记本" -->
          {{ i18n.activeNotebooks }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ metrics.summary.mostActive }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："最活跃" -->
          {{ i18n.mostActive }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ formatNumber(metrics.summary.totalWords) }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："期间总字数" -->
          {{ i18n.periodTotalWords }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ formatNumber(metrics.summary.dailyAvg) }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："日均字数" -->
          {{ i18n.dailyAvgWords }}
        </div>
      </div>
    </div>

    <!-- 加载 / 空状态 -->
    <div
      v-if="loading"
      class="trend-loading"
    >
      <!-- 加载提示："加载中..." -->
      {{ i18n.loading }}
    </div>
    <div
      v-else-if="notebooks.length === 0"
      class="trend-empty"
    >
      <!-- 空状态："暂无数据" -->
      {{ i18n.noData }}
    </div>

    <template v-else>
      <ActivityChart
        :notebooks="activeNotebooks"
        :i18n="i18n"
      />
      <NotebookRankingTable
        :rows="metrics.ranking"
        :i18n="i18n"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// 活跃度 Tab 入口：数据加载 + 摘要 + 图表 + 排行编排
import type { NotebookActivityItem } from "../../types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import {
  computeActivityMetrics,
  formatNumber,
} from "../../utils"
import ActivityChart from "./ActivityChart.vue"
import NotebookRankingTable from "./NotebookRankingTable.vue"

interface Props {
  getNotebookActivityTrend?: (days: number) => Promise<NotebookActivityItem[]>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n)

const days = ref(30)
// 时间范围选项（30/60/90/180/200天/1年）
const periodOptions = computed(() => [
  {
    label: props.i18n.days30,
    value: 30,
  },
  {
    label: props.i18n.days60,
    value: 60,
  },
  {
    label: props.i18n.days90,
    value: 90,
  },
  {
    label: props.i18n.days180,
    value: 180,
  },
  {
    label: props.i18n.days200,
    value: 200,
  },
  {
    label: props.i18n.year1,
    value: 365,
  },
])

const loading = ref(false)
const notebooks = ref<NotebookActivityItem[]>([])

// 过滤出期间内有写作的笔记本
const activeNotebooks = computed(() =>
  notebooks.value.filter((n) => n.data.some((d) => d.words > 0)),
)

// 摘要 + 排行一次遍历计算，供摘要卡与排行表共享
const metrics = computed(() => computeActivityMetrics(activeNotebooks.value))

async function switchPeriod(d: number): Promise<void> {
  days.value = d
  await load()
}

async function load(): Promise<void> {
  if (!props.getNotebookActivityTrend) return
  loading.value = true
  try {
    notebooks.value = await props.getNotebookActivityTrend(days.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<style scoped lang="scss">
@use '../../styles/NotebookActivity.scss';
@use '../../styles/index.scss' as stats;
</style>
