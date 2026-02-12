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
        <h3 v-if="viewMode !== 'trend' && viewMode !== 'snapshot'" class="section-title">{{ chartTitle }}</h3>
        <BarChart
          v-if="viewMode !== 'trend' && viewMode !== 'snapshot'"
          :title="chartTitle"
          :chart-data="chartData"
          :i18n="barChartI18n"
        />

        <TrendView
          v-if="viewMode === 'trend'"
          :historical-data="historicalData"
          :i18n="trendViewI18n"
        />

        <SnapshotView
          v-if="viewMode === 'snapshot'"
          :snapshot-data="snapshotData"
          :i18n="snapshotViewI18n"
          @clear="clearSnapshots"
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
import SnapshotView from './components/SnapshotView.vue'

interface Props {
  onRefresh?: (params: {
    viewMode: 'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot'
    dayRange?: 7 | 15 | 30 | 90 | 180 | 365
    monthYearRange?: 1 | 2 | 3
    selectedYear?: number
  }) => Promise<StatisticsData>
  onGetHistoricalData?: (days?: number) => Promise<any[]>
  onGetSnapshots?: (count?: number) => Promise<any[]>
  onClearSnapshots?: () => Promise<void>
  i18n?: {
    loading: string
    refresh: string
    lastUpdate: string
    totalNotes: string
    totalWords: string
    totalBlocks: string
    totalAssets: string
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
    snapshot: string
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
    snapshotTitle: string
    clearTitle: string
    savedCount: string
    latest: string
    blocks: string
    assets: string
    changeLabel: string
    emptySnapshot: string
    confirmClear: string
  }
}

interface StatisticsData {
  totalNotes: number
  totalWords: number
  totalBlocks: number
  totalAssets: number
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
    snapshot: '快照',
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
    snapshotTitle: '快照分析',
    clearTitle: '清除快照',
    savedCount: '已保存',
    latest: '最新',
    blocks: '块',
    assets: '附件',
    changeLabel: '变化',
    emptySnapshot: '还没有快照数据，等待系统自动收集...',
    confirmClear: '确认清除所有快照数据吗？',
  }),
})

// 状态
const loading = ref(false)
const stats = ref<StatisticsData | null>(null)
const lastUpdateTime = ref('')
const viewMode = ref<'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot'>('day')
const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
const monthYearRange = ref<1 | 2 | 3>(1)
const selectedYear = ref<number>(new Date().getFullYear())
const chartData = ref<DailyWordCount[]>([])
const historicalData = ref<any[]>([])
const snapshotData = ref<any[]>([])
const updateInterval = ref(60)

// I18n 分组 - 简化映射
const headerI18n = computed(() => props.i18n)
const statsCardsI18n = computed(() => props.i18n)
const extendedCardsI18n = computed(() => props.i18n)
const barChartI18n = computed(() => props.i18n)

const viewModeI18n = computed(() => props.i18n)

const trendViewI18n = computed(() => ({
  ...props.i18n,
  title: props.i18n.trendTitle,
}))

const snapshotViewI18n = computed(() => ({
  ...props.i18n,
  title: props.i18n.snapshotTitle,
  emptyMessage: props.i18n.emptySnapshot,
}))


// 图表标题
const chartTitle = computed(() => {
  return stats.value?.currentPeriod || ''
})

// 计算时段平均每日字数
const periodAvgWords = computed(() => {
  if (!chartData.value || chartData.value.length === 0) return 0

  const totalWords = chartData.value.reduce((sum, item) => sum + item.words, 0)
  const days = chartData.value.length

  return days > 0 ? Math.round(totalWords / days) : 0
})

// 监听视图模式变化
watch(viewMode, () => {
  refreshData()
})

// 刷新数据
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

    // 如果是趋势视图，获取历史数据
    if (viewMode.value === 'trend') {
      await loadHistoricalData()
    }

    // 如果是快照视图，加载快照数据
    if (viewMode.value === 'snapshot') {
      await loadSnapshotData()
    }
  } catch (error) {
    console.error('刷新统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载历史数据
async function loadHistoricalData() {
  if (!props.onGetHistoricalData) return

  try {
    const data = await props.onGetHistoricalData()
    historicalData.value = data.reverse()
  } catch (error) {
    console.error('加载历史数据失败:', error)
  }
}

// 加载快照数据
async function loadSnapshotData() {
  if (!props.onGetSnapshots) return

  try {
    snapshotData.value = await props.onGetSnapshots(50)
  } catch (error) {
    console.error('加载快照数据失败:', error)
  }
}

// 清除快照数据
async function clearSnapshots() {
  if (!props.onClearSnapshots) return

  try {
    await props.onClearSnapshots()
    snapshotData.value = []
  } catch (error) {
    console.error('清除快照数据失败:', error)
  }
}

// 初始化
onMounted(() => {
  loading.value = true
  refreshData()
})

// 暴露方法给父组件
defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
