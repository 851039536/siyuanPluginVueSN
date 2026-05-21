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

      <!-- 今日文档变化详情 -->
      <CollapsibleSection
        v-if="stats.todayNewDocs.length > 0 || stats.todayModifiedDocs.length > 0"
        :title="`📋 ${i18n.todayChanges || '今日文档变化'}`"
      >
        <div
          v-if="stats.todayNewDocs.length > 0"
          class="changed-docs-group"
        >
          <div class="changed-docs-group-title">
            🆕 {{ i18n.todayCreated || '今日新增' }}（{{ stats.todayNewDocs.length }}）
          </div>
          <div
            v-for="doc in stats.todayNewDocs"
            :key="doc.id"
            class="changed-doc-item new"
            :title="`点击打开文档`"
            @click="openDoc(doc.id)"
          >
            <span class="changed-doc-icon">+</span>
            <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
          </div>
        </div>
        <div
          v-if="stats.todayModifiedDocs.length > 0"
          class="changed-docs-group"
        >
          <div class="changed-docs-group-title">
            ✏️ {{ i18n.todayModified || '今日修改' }}（{{ stats.todayModifiedDocs.length }}）
          </div>
          <div
            v-for="doc in stats.todayModifiedDocs"
            :key="doc.id"
            class="changed-doc-item modified"
            :title="`点击打开文档`"
            @click="openDoc(doc.id)"
          >
            <span class="changed-doc-icon">~</span>
            <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
          </div>
        </div>
      </CollapsibleSection>

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
    </div>

  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import BarChart from "./components/BarChart.vue"
import CollapsibleSection from "./components/CollapsibleSection.vue"
import DocBarChart from "./components/DocBarChart.vue"
import InsightCards from "./components/InsightCards.vue"
import StatisticsHeader from "./components/StatisticsHeader.vue"
import StatsCardsCompact from "./components/StatsCardsCompact.vue"
import TrendView from "./components/TrendView.vue"
import ViewModeSection from "./components/ViewModeSection.vue"
import WordRanking from "./components/WordRanking.vue"

interface Props {
  onRefresh?: (params: {
    viewMode: "day" | "week" | "month" | "year" | "trend"
    dayRange?: 7 | 15 | 30 | 90 | 180 | 365
    monthYearRange?: 1 | 2 | 3
    selectedYear?: number
  }) => Promise<StatisticsData>
  onGetHistoricalData?: (days?: number) => Promise<any[]>
  onGetNotebookDocStats?: () => Promise<Array<{ name: string, count: number }>>
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
  topTags: Array<{ name: string, count: number }>
  recentDocs: Array<{
    id: string
    title: string
    updated: string
    words: number
  }>
  todayNewDocs: ChangedDoc[]
  todayModifiedDocs: ChangedDoc[]
}

interface DailyWordCount {
  date: string
  words: number
  dateLabel: string
}

interface ChangedDoc {
  id: string
  title: string
  updated?: string
}

function openDoc(docId: string) {
  if (docId) {
    window.open(`siyuan://blocks/${docId}`)
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

const wordRankingI18n = computed(() => ({
  title: "字数排行",
  loading: props.i18n.loading || "加载中...",
  wordsUnit: props.i18n.wordsUnit || "字",
  emptyText: "暂无数据",
}))

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

function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num)
}

watch(viewMode, () => {
  refreshData()
})

watch(dayRange, () => {
  refreshData()
})

watch(monthYearRange, () => {
  refreshData()
})

watch(selectedYear, () => {
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

onMounted(() => {
  refreshData()
})

defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";

.changed-docs-group {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.changed-docs-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
  padding: 0 4px;
}

.changed-doc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  transition: background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  .changed-doc-icon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  &.new .changed-doc-icon {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  &.modified .changed-doc-icon {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .changed-doc-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
