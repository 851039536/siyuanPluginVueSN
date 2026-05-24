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
      <CollapsibleSection
        :title="`📋 ${i18n.docChanges || '文档变化'} — ${rangeLabel}`"
        :badge="docRange !== 'today' && rangeStats.length > 0 ? `${rangeTotalChanges}` : changedDocsCount > 0 ? `${changedDocsCount}` : ''"
      >
        <!-- 范围选择按钮 -->
        <div class="changed-range-picker">
          <button
            v-for="r in dateRangeOptions"
            :key="r.value"
            class="changed-range-btn"
            :class="{ active: docRange === r.value }"
            @click="switchDocRange(r.value)"
          >
            {{ r.label }}
          </button>
        </div>

        <!-- 范围模式：柱状图 -->
        <div
          v-if="docRange !== 'today' && rangeStats.length > 0"
          class="range-chart-section"
        >
          <div class="range-chart-bar-group">
            <div class="range-chart-legend">
              <span class="legend-dot new"></span>{{ i18n.todayCreated || '新增' }}
              <span class="legend-dot modified"></span>{{ i18n.todayModified || '修改' }}
            </div>
            <div
              v-for="item in sortByDate(rangeStats)"
              :key="item.date"
              class="range-chart-row"
              :class="{ active: selectedChartDate === item.date }"
              @click="drillIntoDate(item.date)"
            >
              <span class="range-chart-label">{{ formatChartDate(item.date) }}</span>
              <div class="range-chart-bars">
                <div
                  v-if="item.newCount > 0"
                  class="range-chart-bar new"
                  :style="{ width: barWidth(item.newCount) }"
                >
                  {{ item.newCount }}
                </div>
                <div
                  v-if="item.modifiedCount > 0"
                  class="range-chart-bar modified"
                  :style="{ width: barWidth(item.modifiedCount) }"
                >
                  {{ item.modifiedCount }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 单日详情（date 模式钻取 或 today 模式） -->
        <div v-if="selectedChartDate || docRange === 'today'">
          <div class="changed-date-picker" v-if="docRange === 'today'">
            <input
              type="date"
              :value="docChangeDate"
              :max="todayDateStr"
              class="changed-date-input"
              @change="onDocDateChange"
            >
            <button
              class="changed-date-today"
              :class="{ active: docChangeDate === todayDateStr }"
              @click="setDocDateToday"
            >
              {{ i18n.today || '今天' }}
            </button>
          </div>

          <div v-if="changedDocsLoading" class="changed-docs-loading">
            {{ i18n.loading || '加载中...' }}
          </div>

          <div
            v-else-if="changedDocs.newDocs.length > 0 || changedDocs.modifiedDocs.length > 0"
            class="changed-docs-content"
          >
            <div v-if="changedDocs.newDocs.length > 0" class="changed-docs-group">
              <div class="changed-docs-group-title">
                🆕 {{ i18n.todayCreated || '新增' }}（{{ changedDocs.newDocs.length }}）
              </div>
              <div
                v-for="doc in changedDocs.newDocs"
                :key="doc.id"
                class="changed-doc-item new"
                title="点击打开文档"
                @click="openDoc(doc.id)"
              >
                <span class="changed-doc-icon">+</span>
                <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
              </div>
            </div>
            <div v-if="changedDocs.modifiedDocs.length > 0" class="changed-docs-group">
              <div class="changed-docs-group-title">
                ✏️ {{ i18n.todayModified || '修改' }}（{{ changedDocs.modifiedDocs.length }}）
              </div>
              <div
                v-for="doc in changedDocs.modifiedDocs"
                :key="doc.id"
                class="changed-doc-item modified"
                title="点击打开文档"
                @click="openDoc(doc.id)"
              >
                <span class="changed-doc-icon">~</span>
                <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
              </div>
            </div>
          </div>
          <div v-else class="changed-docs-empty">
            {{ i18n.noDocChanges || '当天无新增或修改' }}
          </div>
        </div>

        <!-- 范围模式下无数据 或 尚未选择 -->
        <div
          v-if="docRange !== 'today' && !selectedChartDate && rangeStats.length === 0"
          class="changed-docs-empty"
        >
          {{ rangeStatsLoading ? (i18n.loading || '加载中...') : (i18n.noDocChanges || '该范围无变更') }}
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
import { padZero } from "./utils"
import type {
  ChangedDoc,
  DailyWordCount,
  RangeStatItem,
  StatisticsData,
} from "./types"

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

// 文档变化按日期查看
const docChangeDate = ref(getTodayStr())
const changedDocs = ref<{ newDocs: ChangedDoc[], modifiedDocs: ChangedDoc[] }>({ newDocs: [], modifiedDocs: [] })
const changedDocsLoading = ref(false)

// 范围选择
type DocRangeType = 'today' | '3d' | '7d' | '1m' | '6m'
const docRange = ref<DocRangeType>('today')
const dateRangeOptions = computed<Array<{ value: DocRangeType, label: string }>>(() => [
  { value: 'today', label: props.i18n.today || '今天' },
  { value: '3d', label: props.i18n.days3 || '近3天' },
  { value: '7d', label: props.i18n.days7 || '近7天' },
  { value: '1m', label: props.i18n.oneMonth || '近1月' },
  { value: '6m', label: props.i18n.halfYear || '近半年' },
])

// 范围柱状图数据
const rangeStats = ref<RangeStatItem[]>([])
const rangeStatsLoading = ref(false)
const selectedChartDate = ref<string | null>(null)

const todayDateStr = computed(() => getTodayStr())

const rangeLabel = computed(() => {
  if (docRange.value === 'today') return formattedDocDate.value
  return dateRangeOptions.value.find(r => r.value === docRange.value)?.label || ''
})

const rangeTotalChanges = computed(() =>
  rangeStats.value.reduce((s, i) => s + i.newCount + i.modifiedCount, 0)
)

const formattedDocDate = computed(() => {
  const d = docChangeDate.value
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`
})

const changedDocsCount = computed(() =>
  changedDocs.value.newDocs.length + changedDocs.value.modifiedDocs.length
)

const maxBarCount = computed(() => {
  let max = 1
  for (const item of rangeStats.value) {
    max = Math.max(max, item.newCount, item.modifiedCount)
  }
  return max
})

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`
}

function formatChartDate(dateStr: string): string {
  return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`
}

function barWidth(count: number): string {
  return `${Math.max((count / maxBarCount.value) * 100, 4)}%`
}

function sortByDate(items: RangeStatItem[]) {
  return [...items].sort((a, b) => a.date.localeCompare(b.date))
}

async function switchDocRange(range: DocRangeType) {
  docRange.value = range
  selectedChartDate.value = null
  changedDocs.value = { newDocs: [], modifiedDocs: [] }

  if (range === 'today') {
    loadDateChangedDocs(docChangeDate.value)
    return
  }

  // 计算范围的起止日期
  const today = new Date()
  const start = new Date(today)
  const endStr = getTodayStr()

  switch (range) {
    case '3d': start.setDate(today.getDate() - 2); break
    case '7d': start.setDate(today.getDate() - 6); break
    case '1m': start.setMonth(today.getMonth() - 1); break
    case '6m': start.setMonth(today.getMonth() - 6); break
  }
  const startStr = `${start.getFullYear()}${padZero(start.getMonth() + 1)}${padZero(start.getDate())}`

  rangeStatsLoading.value = true
  try {
    rangeStats.value = props.onGetDateRangeChangeStats
      ? await props.onGetDateRangeChangeStats(startStr, endStr)
      : []
  } catch (e) {
    console.error("加载范围统计失败:", e)
  } finally {
    rangeStatsLoading.value = false
  }
}

/** 点击柱状图某一天 → 钻取该日文档列表 */
async function drillIntoDate(dateStr: string) {
  if (!props.onGetDateChangedDocs) return
  selectedChartDate.value = dateStr
  changedDocsLoading.value = true
  try {
    changedDocs.value = await props.onGetDateChangedDocs(dateStr)
  } finally {
    changedDocsLoading.value = false
  }
}

async function loadDateChangedDocs(dateStr: string) {
  if (!props.onGetDateChangedDocs) return
  changedDocsLoading.value = true
  try {
    changedDocs.value = await props.onGetDateChangedDocs(dateStr)
  } catch (error) {
    console.error("加载文档变化失败:", error)
    changedDocs.value = { newDocs: [], modifiedDocs: [] }
  } finally {
    changedDocsLoading.value = false
  }
}

function onDocDateChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.value) return
  docChangeDate.value = input.value.replace(/-/g, "")
  loadDateChangedDocs(docChangeDate.value)
}

function setDocDateToday() {
  docChangeDate.value = getTodayStr()
  loadDateChangedDocs(docChangeDate.value)
}

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
  loadDateChangedDocs(docChangeDate.value)
  // 向父组件注册 refreshData 函数，供外部调用
  props.onRegisterRefresh?.(refreshData)
})

defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as stats;

.changed-range-picker {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.changed-range-btn {
  @include stats.small-action-btn;
}

.range-chart-section {
  margin-bottom: 8px;
}

.range-chart-bar-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.range-chart-legend {
  display: flex;
  gap: 12px;
  padding: 2px 4px 6px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 3px;
  vertical-align: middle;

  &.new { background: #22c55e; }
  &.modified { background: #f59e0b; }
}

.range-chart-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.active {
    background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.08));
  }
}

.range-chart-label {
  width: 32px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  flex-shrink: 0;
  text-align: right;
}

.range-chart-bars {
  flex: 1;
  display: flex;
  gap: 2px;
  align-items: center;
  height: 18px;
}

.range-chart-bar {
  height: 16px;
  border-radius: 3px;
  font-size: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  padding-left: 4px;
  min-width: 20px;
  font-weight: 600;

  &.new { background: #22c55e; }
  &.modified { background: #f59e0b; }
}

.changed-date-picker {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.changed-date-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.changed-date-today {
  @include stats.small-action-btn;
  white-space: nowrap;
  padding: 4px 12px;
}

.changed-docs-loading {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.changed-docs-empty {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.changed-docs-content {
  max-height: 240px;
  overflow-y: auto;
}

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
