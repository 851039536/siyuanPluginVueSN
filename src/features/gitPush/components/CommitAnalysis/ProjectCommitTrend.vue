<!-- gitPush 每日项目提交趋势（chart.js 堆叠柱：每根柱=一个时间桶，每段=一个项目；点击柱子联动当日明细） -->
<template>
  <div class="gpa-section gpa-trend">
    <!-- 区块标题 + 口径摘要（粒度 / Top N / 抓取条数上限） -->
    <div class="gpa-section-title">
      {{ i18n.analysisTrendTitle }}
      <span
        v-if="subtitle"
        class="gpa-trend-sub"
      >{{ subtitle }}</span>
    </div>

    <EmptyState
      v-if="series.totals.every((n) => n === 0)"
      icon="mdi:chart-bar"
      :text="i18n.analysisTrendNoData"
    />

    <template v-else>
      <!-- 横向滚动区：日期多时保持每根柱可读，两侧箭头按可用态启用 -->
      <div class="gpa-trend-scroll-area">
        <div
          ref="scrollRef"
          class="gpa-trend-scroll"
        >
          <div
            class="gpa-trend-chart"
            :style="{ minWidth: `${minChartWidth}px` }"
          >
            <Bar
              :data="chartData"
              :options="chartOptions"
            />
          </div>
        </div>
        <button
          type="button"
          class="gpa-trend-scroll-btn gpa-trend-scroll-btn--left"
          :disabled="!canScrollLeft"
          :title="i18n.reportScrollLeft"
          :aria-label="i18n.reportScrollLeft"
          @click="handleScrollLeft"
        >
          <Icon icon="mdi:chevron-left" />
        </button>
        <button
          type="button"
          class="gpa-trend-scroll-btn gpa-trend-scroll-btn--right"
          :disabled="!canScrollRight"
          :title="i18n.reportScrollRight"
          :aria-label="i18n.reportScrollRight"
          @click="handleScrollRight"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>

      <!-- 图例：与排行条同色的项目色点 + 范围内合计（不占画布，窄面板可换行） -->
      <div class="gpa-trend-legend">
        <span
          v-for="item in legendItems"
          :key="item.id"
          class="gpa-trend-legend-item"
          :title="item.title"
        >
          <i
            class="gpa-trend-legend-dot"
            :style="{ background: item.color }"
          />
          <span class="gpa-trend-legend-name">{{ item.name }}</span>
          <span class="gpa-trend-legend-count">{{ item.total }}</span>
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 每日项目提交趋势：范围内条目 → 与热力图同粒度的桶 × 项目堆叠柱。
// Top N 之外合并为「其他」，既保留每日总量又避免几十个项目把图例压成不可读。
import type {
  ChartData,
  ChartOptions,
} from "chart.js"
import type {
  CommitAnalysisEntry,
  CommitHeatGranularity,
} from "../../types"
import type { HeatBucketSpan } from "../../utils"
import { Icon } from "@iconify/vue"
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js"
import {
  computed,
  ref,
} from "vue"
import { Bar } from "vue-chartjs"
import { useChartScroll } from "../../composables/useChartScroll"
import {
  buildProjectSeries,
  OTHER_PROJECT_COLOR,
} from "../../utils"
import EmptyState from "../common/EmptyState.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 已按显示范围裁剪的提交条目（排行与热力图同源） */
  entries: CommitAnalysisEntry[]
  /** 显示范围起止（YYYY-MM-DD） */
  start: string
  end: string
  /** 与热力图相同的桶粒度（日 / 周 / 月） */
  granularity: CommitHeatGranularity
  /** 每周第一天（1=周一, 0=周日） */
  weekStart: 0 | 1
}>()

const emit = defineEmits<{
  /** 点击柱子：把该时间桶交给热力图选区（日粒度=当日明细，周/月=区间明细） */
  pick: [span: HeatBucketSpan]
}>()

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

/** 每根柱最小占地宽度（px）：日期多时横向滚动，而不是把柱挤成不可读的细线 */
const MIN_WIDTH_PER_BUCKET = 7
/** 画布最小宽度（px）：月粒度只有 12 根柱时仍撑满容器 */
const MIN_CHART_WIDTH = 320
/** 画布最大宽度（px）：防御性上限，避免异常范围把 canvas 撑到浏览器单维上限 */
const MAX_CHART_WIDTH = 3200
/** 坐标轴与网格的中间灰（canvas 无法解析 CSS 变量，取深浅主题都可见的中性色） */
const AXIS_COLOR = "rgba(128, 128, 128, 0.8)"
const GRID_COLOR = "rgba(128, 128, 128, 0.12)"
/** 单次点击滚动距离（px）：约 40 根柱，步长适中便于快速定位 */
const SCROLL_AMOUNT = 300

/** 堆叠序列（Top 8 + 其他） */
const series = computed(() => buildProjectSeries(
  props.entries,
  props.start,
  props.end,
  props.granularity,
  props.weekStart,
  8,
))

/** 标题右侧口径摘要：粒度 · Top N（抓取条数上限由页面顶部的范围说明统一交代） */
const subtitle = computed(() => {
  const grain = {
    day: props.i18n.analysisHeatGrainDay,
    week: props.i18n.analysisHeatGrainWeek,
    month: props.i18n.analysisHeatGrainMonth,
  }[props.granularity]
  const topN = series.value.projects.length > 0
    ? String(props.i18n.analysisTrendTopN || "").replace("{0}", String(series.value.projects.length))
    : ""
  return [grain, topN, props.i18n.analysisTrendHint].filter(Boolean).join(" · ")
})

/** 单个时间桶的轴标签（日/周取 MM-DD，月取 YYYY-MM） */
function bucketLabel(span: HeatBucketSpan): string {
  return props.granularity === "month" ? span.start.slice(0, 7) : span.start.slice(5)
}

/** 单个时间桶的 tooltip 标题（单日与区间分开表达） */
function bucketTitle(span: HeatBucketSpan): string {
  return span.start === span.end ? span.start : `${span.start} – ${span.end}`
}

/** chart.js 堆叠柱数据集（Top N 项目 + 其他；颜色与排行条同源） */
const chartData = computed<ChartData<"bar">>(() => {
  const s = series.value
  const datasets: ChartData<"bar">["datasets"] = s.projects.map((p) => ({
    label: p.name,
    data: p.counts,
    backgroundColor: p.color,
    borderColor: p.color,
    borderWidth: 0,
    stack: "commits",
    maxBarThickness: 26,
  }))
  if (s.otherTotal > 0) {
    datasets.push({
      label: props.i18n.analysisTrendOther,
      data: s.otherCounts,
      backgroundColor: OTHER_PROJECT_COLOR,
      borderColor: OTHER_PROJECT_COLOR,
      borderWidth: 0,
      stack: "commits",
      maxBarThickness: 26,
    })
  }
  return {
    labels: s.buckets.map((b) => bucketLabel(b)),
    datasets,
  }
})

/** chart.js 配置：堆叠轴 + 指数型 tooltip（只列有值的项目，页脚给当日合计） */
const chartOptions = computed<ChartOptions<"bar">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  interaction: {
    mode: "index",
    intersect: false,
  },
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      ticks: {
        color: AXIS_COLOR,
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 12,
        font: { size: 9 },
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: GRID_COLOR },
      ticks: {
        color: AXIS_COLOR,
        precision: 0,
        font: { size: 9 },
      },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(28, 28, 30, 0.94)",
      titleColor: "#f8fafc",
      bodyColor: "#f8fafc",
      footerColor: "#cbd5e1",
      padding: 8,
      displayColors: true,
      filter: (item) => Number(item.parsed.y) > 0,
      callbacks: {
        title: (items) => {
          const i = items[0]?.dataIndex
          return i === undefined ? "" : bucketTitle(series.value.buckets[i])
        },
        label: (item) => `${item.dataset.label}: ${item.parsed.y} ${props.i18n.analysisHeatUnitCommits || ""}`,
        footer: (items) => {
          const i = items[0]?.dataIndex
          return i === undefined ? "" : `${props.i18n.analysisTrendTotal || ""}: ${series.value.totals[i]}`
        },
      },
    },
  },
  onClick: (_event, elements) => {
    const i = elements[0]?.index
    const span = i === undefined ? undefined : series.value.buckets[i]
    if (span) emit("pick", { ...span })
  },
  onHover: (event, elements) => {
    const target = event.native?.target as HTMLElement | null | undefined
    if (target) target.style.cursor = elements.length > 0 ? "pointer" : "default"
  },
}))

/** 图例项：项目（按范围内合计降序）+ 其他 */
const legendItems = computed(() => {
  const unit = props.i18n.analysisHeatUnitCommits || ""
  const items = series.value.projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    total: p.total,
    title: `${p.name}: ${p.total} ${unit}`,
  }))
  if (series.value.otherTotal > 0) {
    items.push({
      id: "__other__",
      name: props.i18n.analysisTrendOther,
      color: OTHER_PROJECT_COLOR,
      total: series.value.otherTotal,
      title: `${props.i18n.analysisTrendOther}: ${series.value.otherTotal} ${unit}`,
    })
  }
  return items
})

/** 图表最小宽度：桶数 × 每桶最小占地，夹在 [MIN_CHART_WIDTH, MAX_CHART_WIDTH] */
const minChartWidth = computed(() => Math.min(
  Math.max(series.value.buckets.length * MIN_WIDTH_PER_BUCKET, MIN_CHART_WIDTH),
  MAX_CHART_WIDTH,
))

/** 横向滚动（与 K 线图共用 useChartScroll：rAF 合并 scroll、数据变化回最左、按钮可用态） */
const scrollRef = ref<HTMLElement | null>(null)
const active = ref(true)
const {
  canScrollLeft,
  canScrollRight,
  handleScrollLeft,
  handleScrollRight,
} = useChartScroll({
  scrollRef,
  active,
  dataSource: series,
  scrollAmount: SCROLL_AMOUNT,
})
</script>

<style lang="scss">
@use "../../styles/ProjectCommitTrend.scss";
@use "../../styles/index.scss";
</style>
