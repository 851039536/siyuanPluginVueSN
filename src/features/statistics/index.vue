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
        v-for="tab in TAB_CONFIGS"
        :key="tab.id"
        class="tab-item"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ i18n[tab.labelKey] }}
        <span
          v-if="tab.id === 'milestones' && stats"
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
      <div v-show="activeTab === 'overview'">
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
          :notes-change="notesChange"
          :words-change="wordsChange"
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
            :i18n="i18n"
          />
        </div>

      </div>

      <!-- 趋势 Tab -->
      <div
        v-show="activeTab === 'trend'"
        class="trend-tab"
      >
        <TrendView
          :historical-data="historicalData"
          :i18n="i18n"
        />
        <TrendPrediction
          :on-get-trend-prediction="getTrendPrediction"
        />
      </div>

      <!-- 笔记分布 Tab -->
      <div
        v-show="activeTab === 'notebookDistribution'"
        class="notebook-distribution-tab"
      >
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
            :chart-data="stats.blockTypeStats.map(item => ({
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
          <NotebookWordPie
            :data="notebookWordStats"
          />
        </section>

        <!-- 底部全宽：堆叠条形图 -->
        <section class="dist-section dist-bottom">
          <h3 class="dist-section-title">
            {{ i18n.notebookBlockTypeTitle }}
          </h3>
          <NotebookBlockTypeChart
            :data="notebookBlockTypeStats"
          />
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

      <!-- 报告 Tab -->
      <div
        v-show="activeTab === 'report'"
        class="report-tab"
      >
        <ReportView
          :on-get-report-data="getReportData"
          :on-get-comparison-data="getComparisonData"
        />
      </div>

      <!-- 里程碑 Tab -->
      <div
        v-show="activeTab === 'milestones'"
        class="milestones-tab"
      >
        <MilestonesCard
          :plugin="plugin"
          :total-notes="stats.totalNotes"
          :total-words="stats.totalWords"
          :total-blocks="stats.totalBlocks"
          :total-tags="stats.totalTags"
          :total-backlinks="stats.totalBacklinks"
          :total-assets="stats.totalAssets"
          :total-images="stats.totalImages"
          :notebook-count="stats.notebookCount"
          :code-blocks="stats.codeBlocks"
          :writing-streak="stats.writingStreak"
          :active-days="stats.activeDays"
          :i18n="i18n"
        />
      </div>

      <!-- 热力图 Tab -->
      <div
        v-show="activeTab === 'heatmap'"
        class="heatmap-tab"
      >
        <HeatmapCard
          :on-get-activity-data="getHeatmapActivityData"
          :on-get-daily-detail="getHeatmapDailyDetail"
          :notebooks="heatmapNotebooks"
          :writing-streak="stats?.writingStreak ?? 0"
          :active-days="stats?.activeDays ?? 0"
          :i18n="i18n"
        />
      </div>

      <!-- 写作活跃度 Tab -->
      <div
        v-show="activeTab === 'activity'"
        class="activity-tab"
      >
        <NotebookActivityTrend
          :on-get-notebook-activity-trend="getNotebookActivityTrend"
          :i18n="i18n"
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
import { PluginStorage } from "@/utils/pluginStorage"
import BarChart from "./components/BarChart.vue"
import DocBarChart from "./components/DocBarChart.vue"
import DocChangeSection from "./components/DocChangeSection.vue"
import HeatmapCard from "./components/HeatmapCard.vue"
import MilestonesCard from "./components/MilestonesCard.vue"
import NotebookActivityTrend from "./components/NotebookActivityTrend.vue"
import NotebookBlockTypeChart from "./components/NotebookBlockTypeChart.vue"
import NotebookTable from "./components/NotebookTable.vue"
import NotebookWordPie from "./components/NotebookWordPie.vue"
import ReportView from "./components/ReportView.vue"
import StatisticsHeader from "./components/StatisticsHeader.vue"
import StatsCardsCompact from "./components/StatsCardsCompact.vue"
import TrendPrediction from "./components/TrendPrediction.vue"
import TrendView from "./components/TrendView.vue"
import ViewModeSection from "./components/ViewModeSection.vue"
import WordRanking from "./components/WordRanking.vue"
import { useHistoryData } from "./composables/useHistoryData"
import { provideNotebookHover } from "./composables/useNotebookHover"
import { useNotebookStats } from "./composables/useNotebookStats"
import { useStatistics } from "./composables/useStatistics"
import {
  getDateChangedDocs,
  getDateRangeChangeStats,
  getRecentUpdatedDocs,
} from "./queries/docChangeStats"
import {
  getHeatmapActivityData,
  getHeatmapDailyDetail,
  getHeatmapNotebooks,
} from "./queries/heatmapStats"
import { getNotebookActivityTrend } from "./queries/notebookStats"
import {
  getComparisonData,
  getReportData,
  getTrendPrediction,
} from "./queries/reportStats"
import { MILESTONE_TYPES, STORAGE_KEY_MILESTONE_RULES } from "./types/milestoneRules"
import { STATISTICS_STORAGE_KEYS } from "./types/storage"
import { countMilestonesReached } from "./utils/milestones"
import type { StatisticsData } from "./types"

/** Milestone 类型 → StatisticsData 字段名映射 */
const MILESTONE_FIELD_MAP: Record<string, keyof StatisticsData> = {
  notes: "totalNotes",
  words: "totalWords",
  blocks: "totalBlocks",
  tags: "totalTags",
  backlinks: "totalBacklinks",
  assets: "totalAssets",
  images: "totalImages",
  notebooks: "notebookCount",
  code: "codeBlocks",
  streak: "writingStreak",
  activeDays: "activeDays",
}

interface Props {
  plugin: Plugin
  onRegisterRefresh?: (fn: () => Promise<void>) => void
  i18n?: Record<string, any>
}

const props = defineProps<Props>()

// ── Unified i18n defaults for the entire statistics feature ──
const STATS_DEFAULT_LABELS: Record<string, string> = {
  loading: "加载中...",
  refresh: "刷新",
  lastUpdate: "最后更新",
  wordsUnit: "字",
  notesUnit: "笔记",
  overview: "总览",
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
  moreStats: "详细统计",
  tabOverview: "概览",
  activityHeatmap: "活跃热力图",
  notebookActivity: "写作活跃度",
  trendTab: "趋势",
  notebookDistributionTab: "笔记分布",
  reportTab: "报告",
  milestones: "里程碑",
  day: "日",
  week: "周",
  month: "月",
  year: "年",
  avgLabel: "日均字数",
  totalLabel: "总字数",
  days7: "7天",
  days15: "15天",
  days30: "30天",
  quarter: "季度",
  halfYear: "半年",
  fullYear: "整年",
  last1Year: "最近一年",
  last2Years: "最近两年",
  last3Years: "最近三年",
  title: "趋势分析",
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
  dayOverDay: "日环比",
  weekOverWeek: "周环比",
  monthOverMonth: "月环比",
  docBarChartTitle: "各笔记本文档数",
  docChanges: "文档变化",
  noDocChanges: "当天无新增或修改",
  noRecentDocs: "暂无最近更新的文档",
  recentUpdatedDocs: "最近更新",
  today: "今天",
  days3: "近3天",
  oneMonth: "近1月",
  wordRanking: "字数排行",
  emptyText: "暂无数据",
  blockTypeStats: "块类型分布",
  notebookWordPie: "笔记本字数占比",
  notebookBlockTypeTitle: "各笔记本块类型分布",
  reportTitle: "年度/月度报告",
  predictionTitle: "趋势预测",
  docsUnit: "篇",
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
  metricDocsModified: "修改文档",
  metricDocsCreated: "新增文档",
  metricBlockEdits: "编辑块",
  allNotebooks: "全部笔记本",
  noData: "暂无数据",
  activeNotebooks: "活跃笔记本",
  mostActive: "最活跃",
  periodTotalWords: "期间总字数",
  dailyAvgWords: "日均字数",
  notebookRanking: "笔记本排行",
  notebookName: "笔记本",
  dailyAvg: "日均",
  proportion: "占比",
  days60: "60天",
  days90: "90天",
  days180: "180天",
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
}

const i18n = computed(() => ({
  ...STATS_DEFAULT_LABELS,
  ...(props.i18n || {}),
}))

const TAB_CONFIGS = [
  {
    id: 'overview',
    labelKey: 'tabOverview',
  },
  {
    id: 'heatmap',
    labelKey: 'activityHeatmap',
  },
  {
    id: 'activity',
    labelKey: 'notebookActivity',
  },
  {
    id: 'trend',
    labelKey: 'trendTab',
  },
  {
    id: 'notebookDistribution',
    labelKey: 'notebookDistributionTab',
  },
  {
    id: 'report',
    labelKey: 'reportTab',
  },
  {
    id: 'milestones',
    labelKey: 'milestones',
  },
] as const

type TabId = typeof TAB_CONFIGS[number]['id']

const activeTab = ref<TabId>("overview")

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
  notesChange,
  wordsChange,
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

const milestonesAchievedCount = computed(() => {
  const s = stats.value
  if (!s) return 0
  return MILESTONE_TYPES.reduce((sum, mt) => {
    const val = Number(s[MILESTONE_FIELD_MAP[mt.key]] ?? 0)
    return sum + countMilestonesReached(mt.key, val, customRules.value)
  }, 0)
})

const customRules = ref<Record<string, number[]>>({})

const storagePaths = computed(() => {
  const dataDir = (props.plugin as any).dataDir || ""
  const pluginName = props.plugin.name || ""
  const baseDir = `${dataDir}/storage/petal/${pluginName}`
  return [
    {
      key: STATISTICS_STORAGE_KEYS.HISTORY,
      desc: "每日快照 · 概览(日环比) 趋势 热力图",
      path: `${baseDir}/${STATISTICS_STORAGE_KEYS.HISTORY}.json`,
    },
  ]
})


watch([viewMode, dayRange, monthYearRange, selectedYear], () => {
  refreshData()
})

let notebookStatsLoaded = false
let refreshSeq = 0
const heatmapNotebooks = ref<Array<{ id: string, name: string }>>([])

async function refreshData(): Promise<void> {
  const seq = ++refreshSeq
  loading.value = true
  try {
    await refreshCore()
    if (seq !== refreshSeq) return
    await loadHistoricalData()
    if (seq !== refreshSeq) return
    if (activeTab.value === 'notebookDistribution' && !notebookStatsLoaded) {
      await loadNotebookStats()
    }
  } catch (error) {
    console.error("刷新统计数据失败:", error)
  } finally {
    if (seq === refreshSeq) {
      loading.value = false
    }
  }
}

async function loadNotebookStats(): Promise<void> {
  if (notebookStatsLoaded) return
  await Promise.all([
    loadNotebookDocStats(),
    loadNotebookWordStats(),
    loadNotebookBlockTypeStats(),
  ])
  notebookStatsLoaded = true
}

watch(activeTab, (tab) => {
  if (tab === 'notebookDistribution') {
    loadNotebookStats()
  }
})

onMounted(async () => {
  refreshData()
  props.onRegisterRefresh?.(refreshData)
  heatmapNotebooks.value = await getHeatmapNotebooks()
  const storage = new PluginStorage(props.plugin)
  const rules = await storage.load<Record<string, number[]>>(STORAGE_KEY_MILESTONE_RULES)
  if (rules) customRules.value = rules
})

defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
@use '@/variables' as *;
@use "./styles/index.scss" as stats;
</style>
