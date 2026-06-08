<template>
  <div class="statistics-panel">
    <!-- 顶部操作栏 -->
    <StatisticsHeader
      :loading="loading"
      :last-update-time="lastUpdateTime"
      :storage-paths="storagePaths"
      :i18n="i18n"
      @refresh="refreshData"
    />

    <!-- Tab 栏 -->
    <div class="tab-bar">
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'overview' }]"
        @click="activeTab = 'overview'"
      >
        {{ i18n.tabOverview || '概览' }}
      </button>
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'heatmap' }]"
        @click="activeTab = 'heatmap'"
      >
        {{ i18n.activityHeatmap || '活跃热力图' }}
      </button>
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'activity' }]"
        @click="activeTab = 'activity'"
      >
        {{ i18n.notebookActivity || '写作活跃度' }}
      </button>
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'trend' }]"
        @click="activeTab = 'trend'"
      >
        {{ i18n.trendTab || '趋势' }}
      </button>
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'notebookDistribution' }]"
        @click="activeTab = 'notebookDistribution'"
      >
        {{ i18n.notebookDistributionTab || '笔记分布' }}
      </button>
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'report' }]"
        @click="activeTab = 'report'"
      >
        {{ i18n.reportTab || '报告' }}
      </button>
      <button
        class="tab-item"
        :class="[{ active: activeTab === 'milestones' }]"
        @click="activeTab = 'milestones'"
      >
        {{ i18n.milestones || '里程碑' }}
        <span
          v-if="stats"
          class="tab-badge"
        >{{ milestonesAchievedCount }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div
      v-if="loading && !stats"
      class="loading-wrapper"
    >
      <Loader />
    </div>

    <!-- 主要内容 -->
    <div
      v-else-if="stats"
      class="statistics-content"
    >
      <!-- 概览 Tab -->
      <div v-if="activeTab === 'overview'">
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
          :i18n="i18n"
        />

        <!-- 文档变化详情（日期范围 + 柱状图 + 详情列表 + 最近更新） -->
        <DocChangeSection
          :on-get-date-changed-docs="getDateChangedDocs"
          :on-get-date-range-change-stats="getDateRangeChangeStats"
          :on-get-recent-updated-docs="getRecentUpdatedDocs"
          :i18n="i18n"
        />

        <!-- 视图模式切换 + 时段统计 + 图表 -->
        <ViewModeSection
          v-model="viewMode"
          v-model:day-range="dayRange"
          v-model:month-year-range="monthYearRange"
          v-model:selected-year="selectedYear"
          :period-avg-words="periodAvgWords"
          :period-total-words="stats.periodTotalWords"
          :i18n="i18n"
          @refresh="refreshData"
        />

        <div class="chart-section">
          <h3 class="section-title">
            {{ chartTitle }}
          </h3>
          <BarChart
            :title="chartTitle"
            :chart-data="stats.dailyStats"
            :i18n="i18n"
          />

          <WordRanking
            :chart-data="stats.dailyStats"
            :i18n="wordRankingI18n"
          />
        </div>

      </div>

      <!-- 趋势 Tab -->
      <div
        v-if="activeTab === 'trend'"
        class="trend-tab"
      >
        <TrendView
          :historical-data="historicalData"
          :i18n="trendViewI18n"
        />
        <TrendPrediction
          :on-get-trend-prediction="getTrendPrediction"
        />
      </div>

      <!-- 笔记分布 Tab -->
      <div
        v-if="activeTab === 'notebookDistribution'"
        class="notebook-distribution-tab"
      >
        <section class="dist-section">
          <DocBarChart
            :title="i18n.docBarChartTitle"
            :chart-data="notebookDocStats"
            :loading="docChartLoading"
            :i18n="docBarChartI18n"
          />
        </section>

        <section class="dist-section">
          <DocBarChart
            :title="i18n.blockTypeStats || '块类型分布'"
            :chart-data="stats.blockTypeStats.map(item => ({
              name: item.label,
              count: item.count,
            }))"
            :i18n="blockTypeChartI18n"
          />
        </section>

        <section class="dist-section">
          <h3 class="dist-section-title">
            {{ i18n.notebookBlockTypeTitle || '各笔记本块类型分布' }}
          </h3>
          <NotebookBlockTypeChart
            :data="notebookBlockTypeStats"
          />
        </section>

        <section class="dist-section">
          <h3 class="dist-section-title">
            {{ i18n.notebookWordPie || '笔记本字数占比' }}
          </h3>
          <NotebookWordPie
            :data="notebookWordStats"
          />
        </section>
      </div>

      <!-- 报告 Tab -->
      <div
        v-if="activeTab === 'report'"
        class="report-tab"
      >
        <ReportView
          :on-get-report-data="getReportData"
          :on-get-comparison-data="getComparisonData"
        />
      </div>

      <!-- 里程碑 Tab -->
      <div
        v-if="activeTab === 'milestones'"
        class="milestones-tab"
      >
        <MilestonesCard
          :total-notes="stats.totalNotes"
          :total-words="stats.totalWords"
          :total-tags="stats.totalTags"
          :total-backlinks="stats.totalBacklinks"
          :total-assets="stats.totalAssets"
          :total-images="stats.totalImages"
          :notebook-count="stats.notebookCount"
          :code-blocks="stats.codeBlocks"
          :writing-streak="stats.writingStreak"
          :active-days="stats.activeDays"
          :i18n="milestonesI18n"
        />
      </div>

      <!-- 热力图 Tab -->
      <div
        v-if="activeTab === 'heatmap'"
        class="heatmap-tab"
      >
        <HeatmapCard
          :activity-map="heatmapActivityMap"
          :writing-streak="stats?.writingStreak ?? 0"
          :active-days="stats?.activeDays ?? 0"
          :i18n="heatmapI18n"
        />
      </div>

      <!-- 写作活跃度 Tab -->
      <div
        v-if="activeTab === 'activity'"
        class="activity-tab"
      >
        <NotebookActivityTrend
          :on-get-notebook-activity-trend="getNotebookActivityTrend"
          :i18n="activityI18n"
        />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Loader from "@/components/Loader.vue"
import BarChart from "./components/BarChart.vue"
import DocBarChart from "./components/DocBarChart.vue"
import DocChangeSection from "./components/DocChangeSection.vue"
import HeatmapCard from "./components/HeatmapCard.vue"
import MilestonesCard from "./components/MilestonesCard.vue"
import NotebookActivityTrend from "./components/NotebookActivityTrend.vue"
import NotebookBlockTypeChart from "./components/NotebookBlockTypeChart.vue"
import NotebookWordPie from "./components/NotebookWordPie.vue"
import ReportView from "./components/ReportView.vue"
import StatisticsHeader from "./components/StatisticsHeader.vue"
import StatsCardsCompact from "./components/StatsCardsCompact.vue"
import TrendPrediction from "./components/TrendPrediction.vue"
import TrendView from "./components/TrendView.vue"
import ViewModeSection from "./components/ViewModeSection.vue"
import WordRanking from "./components/WordRanking.vue"
import { useHistoryData } from "./composables/useHistoryData"
import { useNotebookStats } from "./composables/useNotebookStats"
import { useStatistics } from "./composables/useStatistics"
import {
  getDateChangedDocs,
  getDateRangeChangeStats,
  getRecentUpdatedDocs,
} from "./queries/docChangeStats"
import { getHeatmapActivityData } from "./queries/heatmapStats"
import { getNotebookActivityTrend } from "./queries/notebookStats"
import {
  getComparisonData,
  getReportData,
  getTrendPrediction,
} from "./queries/reportStats"
import { milestoneTargetOf } from "./utils/milestones"
import { STATISTICS_STORAGE_KEYS } from "./types/storage"

interface Props {
  plugin: Plugin
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
    docBarChartTitle: string
    docChanges: string
    noDocChanges: string
    noRecentDocs?: string
    recentUpdatedDocs?: string
    today: string
    days3: string
    oneMonth: string
    wordRanking?: string
    blockTypeStats?: string
    notebookWordPie?: string
    notebookActivity?: string
    reportTitle?: string
    predictionTitle?: string
    activityHeatmap?: string
    milestones?: string
    tabOverview?: string
    trendTab?: string
    notebookDistributionTab?: string
    notebookBlockTypeTitle?: string
    reportTab?: string
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
    docBarChartTitle: "各笔记本文档数",
    docChanges: "文档变化",
    noDocChanges: "当天无新增或修改",
    noRecentDocs: "暂无最近更新的文档",
    recentUpdatedDocs: "最近更新",
    today: "今天",
    days3: "近3天",
    oneMonth: "近1月",
    wordRanking: "字数排行",
    blockTypeStats: "块类型分布",
    notebookWordPie: "笔记本字数占比",
    notebookActivity: "笔记本写作活跃度",
    reportTitle: "年度/月度报告",
    predictionTitle: "趋势预测",
    activityHeatmap: "活跃热力图",
    milestones: "里程碑",
    tabOverview: "概览",
  }),
})

const activeTab = ref<"overview" | "trend" | "heatmap" | "activity" | "notebookDistribution" | "report" | "milestones">("overview")

const {
  loading,
  stats,
  lastUpdateTime,
  viewMode,
  dayRange,
  monthYearRange,
  selectedYear,
  periodAvgWords,
  chartTitle,
  refreshData: refreshCore,
} = useStatistics()

const {
  historicalData,
  createdChange,
  modifiedChange,
  loadHistoricalData,
} = useHistoryData(props.plugin, stats)

const {
  notebookDocStats,
  docChartLoading,
  notebookWordStats,
  notebookBlockTypeStats,
  loadNotebookDocStats,
  loadNotebookWordStats,
  loadNotebookBlockTypeStats,
} = useNotebookStats()

const trendViewI18n = computed(() => ({
  ...props.i18n,
  title: props.i18n.trendTitle,
  dayOverDay: "日环比",
  weekOverWeek: "周环比",
  monthOverMonth: "月环比",
}))

const heatmapI18n = computed(() => ({
  activityHeatmap: props.i18n.activityHeatmap || "活跃热力图",
  less: "少",
  more: "多",
  last30Days: "近30天",
  activeDaysCount: "天活跃",
  activeDaysLabel: "活跃天数",
  currentStreak: "当前连续",
  longestStreak: "最长连续",
  totalOperations: "总操作次数",
  months3: "3个月",
  months6: "6个月",
  year1: "1年",
  weekdayDistribution: "星期分布",
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日",
  mon: "一",
  wed: "三",
  fri: "五",
}))

const activityI18n = computed(() => ({
  loading: props.i18n.loading || "加载中...",
  noData: "暂无数据",
  activeNotebooks: "活跃笔记本",
  mostActive: "最活跃",
  periodTotalWords: "期间总字数",
  dailyAvgWords: "日均字数",
  notebookRanking: "笔记本排行",
  notebookName: "笔记本",
  totalWords: "总字数",
  activeDaysLabel: "活跃天数",
  dailyAvg: "日均",
  proportion: "占比",
  wordsUnit: props.i18n.wordsUnit || "字",
  days7: props.i18n.days7 || "7天",
  days15: props.i18n.days15 || "15天",
  days30: props.i18n.days30 || "30天",
  days60: "60天",
  days90: "90天",
  days180: "180天",
}))

const milestonesI18n = computed(() => ({
  milestones: props.i18n.milestones || "里程碑",
  showAllMilestones: "显示全部 {count} 个里程碑",
  nextGoal: "下一目标",
  encourageAlmost: "只差一点点，加油！",
  encourageHalfway: "已完成过半，继续努力！",
  encourageStart: "千里之行，始于足下",
  tierCommon: "普通",
  tierRare: "稀有",
  tierEpic: "史诗",
  tierLegendary: "传说",
  catWriting: "写作达人",
  catKnowledge: "知识管理",
  catRich: "内容丰富",
}))

// Milestone badge counts
function countAchieved(type: string, current: number): number {
  let n = 0
  while (milestoneTargetOf(type, n + 1) <= current) n++
  return n
}

const milestonesAchievedCount = computed(() => {
  const s = stats.value
  if (!s) return 0
  const counts: Record<string, number> = {
    notes: s.totalNotes,
    words: s.totalWords,
    tags: s.totalTags,
    backlinks: s.totalBacklinks,
    assets: s.totalAssets,
    images: s.totalImages,
    notebooks: s.notebookCount,
    code: s.codeBlocks,
    streak: s.writingStreak,
    activeDays: s.activeDays,
  }
  return Object.entries(counts).reduce((sum, [type, val]) => sum + countAchieved(type, val), 0)
})

const docBarChartI18n = computed(() => ({
  loading: props.i18n.loading || "加载中...",
  docsUnit: props.i18n.notesUnit || "笔记",
}))

const blockTypeChartI18n = computed(() => ({
  loading: props.i18n.loading || "加载中...",
  docsUnit: "个",
}))

const wordRankingI18n = computed(() => ({
  title: props.i18n.wordRanking || "字数排行",
  loading: props.i18n.loading || "加载中...",
  wordsUnit: props.i18n.wordsUnit || "字",
  emptyText: "暂无数据",
}))

const storagePaths = computed(() => {
  const dataDir = (props.plugin as any).dataDir || ""
  const pluginName = props.plugin.name || ""
  const baseDir = `${dataDir}/storage/petal/${pluginName}`
  return [
    { key: STATISTICS_STORAGE_KEYS.HISTORY, desc: "每日快照 · 概览(日环比) 趋势 热力图", path: `${baseDir}/${STATISTICS_STORAGE_KEYS.HISTORY}.json` },
  ]
})


watch([viewMode, dayRange, monthYearRange, selectedYear], () => {
  refreshData()
})

const notebookStatsLoaded = ref(false)
const heatmapActivityMap = ref(new Map<string, number>())
const heatmapLoaded = ref(false)

async function loadHeatmapData(): Promise<void> {
  heatmapActivityMap.value = await getHeatmapActivityData(12)
  heatmapLoaded.value = true
}

async function refreshData(): Promise<void> {
  loading.value = true
  try {
    await refreshCore()
    await loadHistoricalData()
    if (activeTab.value === 'notebookDistribution' && !notebookStatsLoaded.value) {
      await loadNotebookStats()
    }
    if (activeTab.value === 'heatmap') {
      await loadHeatmapData()
    }
  } catch (error) {
    console.error("刷新统计数据失败:", error)
  } finally {
    loading.value = false
  }
}

async function loadNotebookStats(): Promise<void> {
  if (notebookStatsLoaded.value) return
  await Promise.all([
    loadNotebookDocStats(),
    loadNotebookWordStats(),
    loadNotebookBlockTypeStats(),
  ])
  notebookStatsLoaded.value = true
}

watch(activeTab, (tab) => {
  if (tab === 'notebookDistribution') {
    loadNotebookStats()
  }
  if (tab === 'heatmap' && !heatmapLoaded.value) {
    loadHeatmapData()
  }
})

onMounted(() => {
  refreshData()
  props.onRegisterRefresh?.(refreshData)
})

defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
@use '@/variables' as *;

.tab-bar {
  display: flex;
  gap: 0;
  padding: 0 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.tab-item {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-family: $font-body;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;

  &:hover {
    color: var(--b3-theme-on-surface);
  }

  &.active {
    color: var(--b3-theme-primary);
    font-weight: 700;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 8px;
      right: 8px;
      height: 2px;
      background: var(--b3-theme-primary);
      border-radius: 1px 1px 0 0;
    }
  }
}

.tab-badge {
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  color: var(--b3-theme-primary);
  font-weight: 700;
}

.milestones-tab,
.heatmap-tab,
.activity-tab,
.trend-tab,
.notebook-distribution-tab,
.report-tab {
  padding: 12px;
}

.chart-section {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}

.notebook-distribution-tab {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.dist-section {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 12px;
}

.dist-section-title {
  margin: 0 0 10px 0;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 6px;
}

.loading-wrapper {
  position: relative;
  height: 200px;
}
</style>
