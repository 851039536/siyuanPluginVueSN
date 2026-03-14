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
    <div v-if="loading && !stats" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ i18n.loading }}</p>
    </div>

    <!-- 主要内容 -->
    <div v-else-if="stats" class="statistics-content">
      <StatsCardsCompact
        :total-notes="stats.totalNotes"
        :total-words="stats.totalWords"
        :total-blocks="stats.totalBlocks"
        :total-assets="stats.totalAssets"
        :total-images="stats.totalImages"
        :total-tags="stats.totalTags"
        :total-backlinks="stats.totalBacklinks"
        :i18n="statsCardsI18n"
      />

      <ExtendedStatsCards
        :today-created="stats.todayCreated"
        :today-modified="stats.todayModified"
        :avg-words-per-doc="stats.avgWordsPerDoc"
        :i18n="extendedCardsI18n"
      />

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
        <h3 v-if="viewMode !== 'trend'" class="section-title">{{ chartTitle }}</h3>
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
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import StatisticsHeader from './components/StatisticsHeader.vue'
import StatsCardsCompact from './components/StatsCardsCompact.vue'
import ExtendedStatsCards from './components/ExtendedStatsCards.vue'
import ViewModeSection from './components/ViewModeSection.vue'
import BarChart from './components/BarChart.vue'
import TrendView from './components/TrendView.vue'

interface Props {
  onRefresh?: (params: {
    viewMode: 'day' | 'week' | 'month' | 'year' | 'trend'
    dayRange?: 7 | 15 | 30 | 90 | 180 | 365
    monthYearRange?: 1 | 2 | 3
    selectedYear?: number
  }) => Promise<StatisticsData>
  onGetHistoricalData?: (days?: number) => Promise<any[]>
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
    notesGrowth: string
    wordsGrowth: string
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
  }
}

interface StatisticsData {
  totalNotes: number
  totalWords: number
  totalBlocks: number
  totalAssets: number
  totalImages: number
  totalTags: number
  totalBacklinks: number
  todayCreated: number
  todayModified: number
  avgWordsPerDoc: number
  dailyStats: DailyWordCount[]
  currentPeriod: string
  periodTotalWords: number
  topTags: Array<{ name: string; count: number }>
  recentDocs: Array<{ id: string; title: string; updated: string; words: number }>
}

interface DailyWordCount {
  date: string
  words: number
  dateLabel: string
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({
    loading: '加载中...',
    refresh: '刷新',
    lastUpdate: '最后更新',
    totalNotes: '笔记总数',
    totalWords: '总字数',
    totalBlocks: '内容块',
    totalAssets: '附件',
    totalImages: '图片',
    totalTags: '标签',
    totalBacklinks: '双链',
    todayCreated: '今日新增',
    todayModified: '今日修改',
    avgWordsPerDoc: '平均字数',
    day: '日',
    week: '周',
    month: '月',
    year: '年',
    trend: '趋势',
    avgLabel: '日均字数',
    totalLabel: '总字数',
    wordsUnit: '字',
    notesUnit: '笔记',
    days7: '7天',
    days15: '15天',
    days30: '30天',
    quarter: '季度',
    halfYear: '半年',
    fullYear: '整年',
    last1Year: '最近一年',
    last2Years: '最近两年',
    last3Years: '最近三年',
    trendTitle: '趋势分析',
    notesGrowth: '笔记增长',
    wordsGrowth: '字数增长',
    avgDailyCreated: '日均新增',
    avgDailyModified: '日均修改',
    historicalData: '历史数据',
    date: '日期',
    notes: '笔记',
    words: '字数',
    created: '新增',
    modified: '修改',
    change: '变化',
    blocks: '块',
    assets: '附件',
    changeLabel: '变化',
  }),
})

const loading = ref(false)
const stats = ref<StatisticsData | null>(null)
const lastUpdateTime = ref('')
const viewMode = ref<'day' | 'week' | 'month' | 'year' | 'trend'>('day')
const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
const monthYearRange = ref<1 | 2 | 3>(1)
const selectedYear = ref<number>(new Date().getFullYear())
const chartData = ref<DailyWordCount[]>([])
const historicalData = ref<any[]>([])
const updateInterval = ref(60)

const headerI18n = computed(() => props.i18n)
const statsCardsI18n = computed(() => props.i18n)
const extendedCardsI18n = computed(() => props.i18n)
const barChartI18n = computed(() => props.i18n)
const viewModeI18n = computed(() => props.i18n)

const trendViewI18n = computed(() => ({
  ...props.i18n,
  title: props.i18n.trendTitle,
}))

const chartTitle = computed(() => {
  return stats.value?.currentPeriod || ''
})

const periodAvgWords = computed(() => {
  if (!chartData.value || chartData.value.length === 0) return 0

  const totalWords = chartData.value.reduce((sum, item) => sum + item.words, 0)
  const days = chartData.value.length

  return days > 0 ? Math.round(totalWords / days) : 0
})

watch(viewMode, () => {
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
    lastUpdateTime.value = new Date().toLocaleString('zh-CN')

    if (viewMode.value === 'trend') {
      await loadHistoricalData()
    }
  } catch (error) {
    console.error('刷新统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadHistoricalData() {
  if (!props.onGetHistoricalData) return
  try {
    const data = await props.onGetHistoricalData()
    historicalData.value = data.reverse()
  } catch (error) {
    console.error('加载历史数据失败:', error)
  }
}

onMounted(() => {
  loading.value = true
  refreshData()
})

defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
