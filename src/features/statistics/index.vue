<template>
  <div class="statistics-panel">
    <!-- 顶部操作栏 -->
    <StatisticsHeader
      :loading="loading"
      :last-update-time="lastUpdateTime"
      :update-interval="updateInterval"
      :i18n="headerI18n"
      @refresh="refreshData"
    />

    <!-- 加载状态 -->
    <div
      v-if="loading && !stats"
      class="loading-state"
    >
      <div class="loading-spinner"></div>
      <p>{{ i18n.loading }}</p>
    </div>

    <!-- 主要内容 -->
    <div
      v-else-if="stats"
      class="statistics-content"
    >
      <!-- 核心指标横幅（常驻） -->
      <StatsCardsCompact
        :total-notes="stats.totalNotes"
        :total-words="stats.totalWords"
        :total-blocks="stats.totalBlocks"
        :total-assets="stats.totalAssets"
        :total-images="stats.totalImages"
        :total-tags="stats.totalTags"
        :total-backlinks="stats.totalBacklinks"
        :today-created="stats.todayCreated"
        :today-modified="stats.todayModified"
        :avg-words-per-doc="stats.avgWordsPerDoc"
        :created-change="createdChange"
        :modified-change="modifiedChange"
        :i18n="statsCardsI18n"
      />

      <!-- 文档变化详情（日期范围 + 柱状图 + 详情列表） -->
      <DocChangeSection
        :on-get-date-changed-docs="props.onGetDateChangedDocs"
        :on-get-date-range-change-stats="props.onGetDateRangeChangeStats"
        :i18n="docChangeI18n"
      />

      <!-- 视图模式切换 + 时段统计 + 图表 -->
      <ViewModeSection
        v-model="viewMode"
        v-model:day-range="dayRange"
        v-model:month-year-range="monthYearRange"
        v-model:selected-year="selectedYear"
        :period-avg-words="periodAvgWords"
        :period-total-words="stats.periodTotalWords"
        :i18n="viewModeI18n"
        @refresh="refreshData"
      />

      <div class="chart-section">
        <h3
          v-if="viewMode !== 'trend'"
          class="section-title"
        >
          {{ chartTitle }}
        </h3>
        <BarChart
          v-if="viewMode !== 'trend'"
          :title="chartTitle"
          :chart-data="chartData"
          :i18n="barChartI18n"
        />

        <TrendView
          v-if="viewMode === 'trend'"
          :historical-data="historicalData"
          :i18n="trendViewI18n"
        />
      </div>

      <!-- 可折叠：热力图 + 里程碑 -->
      <InsightCards
        :historical-data="historicalData"
        :total-notes="stats.totalNotes"
        :total-words="stats.totalWords"
        :total-backlinks="stats.totalBacklinks"
        :i18n="insightCardsI18n"
      />

      <!-- 可折叠：字数排行 -->
      <CollapsibleSection
        :title="`🏆 ${wordRankingI18n.title}`"
      >
        <WordRanking
          v-if="viewMode !== 'trend'"
          :chart-data="chartData"
          :i18n="wordRankingI18n"
        />
      </CollapsibleSection>

      <!-- 可折叠：各笔记本文档数 -->
      <CollapsibleSection
        :title="`📂 ${docBarChartTitle}`"
      >
        <DocBarChart
          :title="docBarChartTitle"
          :chart-data="notebookDocStats"
          :loading="docChartLoading"
          :i18n="docBarChartI18n"
        />
      </CollapsibleSection>

      <!-- 可折叠：块类型分布 -->
      <CollapsibleSection
        :title="`🧩 ${blockTypeStatsTitle}`"
        :badge="stats.blockTypeStats.length > 0 ? `${stats.blockTypeStats.length}种` : ''"
      >
        <DocBarChart
          :title="blockTypeStatsTitle"
          :chart-data="stats.blockTypeStats.map(item => ({
            name: item.label,
            count: item.count,
          }))"
          :i18n="blockTypeChartI18n"
        />
      </CollapsibleSection>

      <!-- 可折叠：笔记本字数占比饼图 -->
      <CollapsibleSection
        :title="`🥧 ${notebookWordPieTitle}`"
        :badge="notebookWordStats.length > 0 ? `${notebookWordStats.length}` : ''"
      >
        <NotebookWordPie
          :data="notebookWordStats"
        />
      </CollapsibleSection>

      <!-- 可折叠：各笔记本写作活跃度对比 -->
      <CollapsibleSection
        :title="`📈 ${notebookActivityTitle}`"
      >
        <NotebookActivityTrend
          :on-get-notebook-activity-trend="props.onGetNotebookActivityTrend"
        />
      </CollapsibleSection>

      <!-- 可折叠：年度/月度报告 -->
      <CollapsibleSection
        :title="`📊 ${reportTitle}`"
      >
        <ReportView
          :on-get-report-data="props.onGetReportData"
        />
      </CollapsibleSection>

      <!-- 可折叠：趋势预测 -->
      <CollapsibleSection
        :title="`🔮 ${predictionTitle}`"
      >
        <TrendPrediction
          :on-get-trend-prediction="props.onGetTrendPrediction"
        />
      </CollapsibleSection>
    </div>

  </div>
</template>

<script setup lang="ts">
import type {
  ChangedDoc,
  DailyWordCount,
  NotebookActivityItem,
  NotebookWordStat,
  RangeStatItem,
  ReportData,
  StatisticsData,
  TrendPrediction as TrendPredictionData,
} from "./types"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import BarChart from "./components/BarChart.vue"
import CollapsibleSection from "./components/CollapsibleSection.vue"
import DocBarChart from "./components/DocBarChart.vue"
import DocChangeSection from "./components/DocChangeSection.vue"
import InsightCards from "./components/InsightCards.vue"
import NotebookActivityTrend from "./components/NotebookActivityTrend.vue"
import NotebookWordPie from "./components/NotebookWordPie.vue"
import ReportView from "./components/ReportView.vue"
import StatisticsHeader from "./components/StatisticsHeader.vue"
import StatsCardsCompact from "./components/StatsCardsCompact.vue"
import TrendPrediction from "./components/TrendPrediction.vue"
import TrendView from "./components/TrendView.vue"
import ViewModeSection from "./components/ViewModeSection.vue"
import WordRanking from "./components/WordRanking.vue"
import { padZero } from "./utils"

interface Props {
  onRefresh?: (params: {
    viewMode: "day" | "week" | "month" | "year" | "trend"
    dayRange?: 7 | 15 | 30 | 90 | 180 | 365
    monthYearRange?: 1 | 2 | 3
    selectedYear?: number
  }) => Promise<StatisticsData>
  onGetHistoricalData?: (days?: number) => Promise<any[]>
  onGetNotebookDocStats?: () => Promise<Array<{ name: string, count: number }>>
  onGetDateChangedDocs?: (dateStr: string) => Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }>
  onGetDateRangeChangeStats?: (startStr: string, endStr: string) => Promise<RangeStatItem[]>
  onGetNotebookWordStats?: () => Promise<NotebookWordStat[]>
  onGetNotebookActivityTrend?: (days: number) => Promise<NotebookActivityItem[]>
  onGetReportData?: (year?: number, month?: number) => Promise<ReportData>
  onGetTrendPrediction?: () => Promise<TrendPredictionData>
  onRegisterRefresh?: (fn: () => Promise<void>) => void
  i18n?: {
    loading: string
    refresh: string
    lastUpdate: string
    totalNotes: string
    totalWords: string
    totalBlocks: string
    totalAssets: string
    totalImages: string
    totalTags: string
    totalBacklinks: string
    todayCreated: string
    todayModified: string
    avgWordsPerDoc: string
    day: string
    week: string
    month: string
    year: string
    trend: string
    avgLabel: string
    totalLabel: string
    wordsUnit: string
    notesUnit: string
    days7: string
    days15: string
    days30: string
    quarter: string
    halfYear: string
    fullYear: string
    last1Year: string
    last2Years: string
    last3Years: string
    trendTitle: string
    avgDailyCreated: string
    avgDailyModified: string
    historicalData: string
    date: string
    notes: string
    words: string
    created: string
    modified: string
    change: string
    blocks: string
    assets: string
    changeLabel: string
    docBarChartTitle: string
    todayChanges: string
    docChanges: string
    noDocChanges: string
    today: string
    days3: string
    oneMonth: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({
    loading: "加载中...",
    refresh: "刷新",
    lastUpdate: "最后更新",
    totalNotes: "笔记总数",
    totalWords: "总字数",
    totalBlocks: "内容块",
    totalAssets: "附件",
    totalImages: "图片",
    totalTags: "标签",
    totalBacklinks: "双链",
    todayCreated: "今日新增",
    todayModified: "今日修改",
    avgWordsPerDoc: "平均字数",
    day: "日",
    week: "周",
    month: "月",
    year: "年",
    trend: "趋势",
    avgLabel: "日均字数",
    totalLabel: "总字数",
    wordsUnit: "字",
    notesUnit: "笔记",
    days7: "7天",
    days15: "15天",
    days30: "30天",
    quarter: "季度",
    halfYear: "半年",
    fullYear: "整年",
    last1Year: "最近一年",
    last2Years: "最近两年",
    last3Years: "最近三年",
    trendTitle: "趋势分析",
    avgDailyCreated: "日均新增",
    avgDailyModified: "日均修改",
    historicalData: "历史数据",
    date: "日期",
    notes: "笔记",
    words: "字数",
    created: "新增",
    modified: "修改",
    change: "变化",
    blocks: "块",
    assets: "附件",
    changeLabel: "变化",
    docBarChartTitle: "各笔记本文档数",
    todayChanges: "今日文档变化",
    docChanges: "文档变化",
    noDocChanges: "当天无新增或修改",
    today: "今天",
    days3: "近3天",
    oneMonth: "近1月",
  }),
})

const loading = ref(false)
const stats = ref<StatisticsData | null>(null)
const lastUpdateTime = ref("")
const viewMode = ref<"day" | "week" | "month" | "year" | "trend">("day")
const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
const monthYearRange = ref<1 | 2 | 3>(1)
const selectedYear = ref<number>(new Date().getFullYear())
const chartData = ref<DailyWordCount[]>([])
const historicalData = ref<any[]>([])
const updateInterval = ref(60)
const notebookDocStats = ref<Array<{ name: string, count: number }>>([])
const docChartLoading = ref(false)

const notebookWordStats = ref<NotebookWordStat[]>([])

const headerI18n = computed(() => props.i18n)
const statsCardsI18n = computed(() => props.i18n)
const barChartI18n = computed(() => props.i18n)
const viewModeI18n = computed(() => props.i18n)

const trendViewI18n = computed(() => ({
  ...props.i18n,
  title: props.i18n.trendTitle,
  dayOverDay: "日环比",
  weekOverWeek: "周环比",
  monthOverMonth: "月环比",
}))

const insightCardsI18n = computed(() => ({
  activityHeatmap: "活跃热力图",
  less: "少",
  more: "多",
  last30Days: "近30天",
  activeDaysCount: "天活跃",
  milestones: "里程碑",
  notes: "笔记",
  words: "字数",
  notesUnit: "篇",
  wordsUnit: "字",
}))

const docBarChartTitle = computed(() => props.i18n.docBarChartTitle || "各笔记本文档数")
const docBarChartI18n = computed(() => ({
  loading: props.i18n.loading || "加载中...",
  docsUnit: props.i18n.notesUnit || "笔记",
}))

const blockTypeStatsTitle = computed(() => "块类型分布")
const blockTypeChartI18n = computed(() => ({
  loading: props.i18n.loading || "加载中...",
  docsUnit: "个",
}))

const wordRankingI18n = computed(() => ({
  title: "字数排行",
  loading: props.i18n.loading || "加载中...",
  wordsUnit: props.i18n.wordsUnit || "字",
  emptyText: "暂无数据",
}))

const docChangeI18n = computed(() => props.i18n)

const notebookWordPieTitle = computed(() => "笔记本字数占比")
const notebookActivityTitle = computed(() => "笔记本写作活跃度")
const reportTitle = computed(() => "年度/月度报告")
const predictionTitle = computed(() => "趋势预测")

const chartTitle = computed(() => {
  return stats.value?.currentPeriod || ""
})

const periodAvgWords = computed(() => {
  if (!chartData.value || chartData.value.length === 0) return 0

  const totalWords = chartData.value.reduce((sum, item) => sum + item.words, 0)
  const days = chartData.value.length

  return days > 0 ? Math.round(totalWords / days) : 0
})

// 计算昨日数据
const yesterdayCreated = computed(() => {
  if (!historicalData.value || historicalData.value.length < 2) return null
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${padZero(yesterday.getMonth() + 1)}-${padZero(yesterday.getDate())}`

  const yesterdayData = historicalData.value.find(
    (item) => item.date === yesterdayStr,
  )
  return yesterdayData?.todayCreated ?? null
})

const yesterdayModified = computed(() => {
  if (!historicalData.value || historicalData.value.length < 2) return null
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${padZero(yesterday.getMonth() + 1)}-${padZero(yesterday.getDate())}`

  const yesterdayData = historicalData.value.find(
    (item) => item.date === yesterdayStr,
  )
  return yesterdayData?.todayModified ?? null
})

// 计算变化百分比
const createdChange = computed(() => {
  if (yesterdayCreated.value === null || yesterdayCreated.value === 0) {
    return stats.value?.todayCreated ? 100 : null
  }
  if (stats.value?.todayCreated === undefined) return null
  return (
    ((stats.value.todayCreated - yesterdayCreated.value)
      / yesterdayCreated.value)
    * 100
  )
})

const modifiedChange = computed(() => {
  if (yesterdayModified.value === null || yesterdayModified.value === 0) {
    return stats.value?.todayModified ? 100 : null
  }
  if (stats.value?.todayModified === undefined) return null
  return (
    ((stats.value.todayModified - yesterdayModified.value)
      / yesterdayModified.value)
    * 100
  )
})

// 合并监听，避免多个状态同时变化时触发多次刷新
watch([viewMode, dayRange, monthYearRange, selectedYear], () => {
  refreshData()
})

async function refreshData() {
  if (!props.onRefresh) return

  loading.value = true
  try {
    stats.value = await props.onRefresh({
      viewMode: viewMode.value,
      dayRange: dayRange.value,
      monthYearRange: monthYearRange.value,
      selectedYear: selectedYear.value,
    })
    chartData.value = stats.value.dailyStats || []
    lastUpdateTime.value = new Date().toLocaleString("zh-CN")

    // 始终加载历史数据，供 InsightCards 和 TrendView 使用
    await loadHistoricalData()

    // 加载笔记本文档统计
    await loadNotebookDocStats()

    // 加载笔记本字数占比
    await loadNotebookWordStats()
  } catch (error) {
    console.error("刷新统计数据失败:", error)
  } finally {
    loading.value = false
  }
}

async function loadHistoricalData() {
  if (!props.onGetHistoricalData) return
  try {
    const data = await props.onGetHistoricalData()
    historicalData.value = [...data].reverse()
  } catch (error) {
    console.error("加载历史数据失败:", error)
  }
}

async function loadNotebookDocStats() {
  if (!props.onGetNotebookDocStats) return
  docChartLoading.value = true
  try {
    notebookDocStats.value = await props.onGetNotebookDocStats()
  } catch (error) {
    console.error("加载笔记本文档统计失败:", error)
  } finally {
    docChartLoading.value = false
  }
}

async function loadNotebookWordStats() {
  if (!props.onGetNotebookWordStats) return
  try {
    notebookWordStats.value = await props.onGetNotebookWordStats()
  } catch (error) {
    console.error("加载笔记本字数统计失败:", error)
  }
}

onMounted(() => {
  refreshData()
  // 向父组件注册 refreshData 函数，供外部调用
  props.onRegisterRefresh?.(refreshData)
})

defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
</style>
