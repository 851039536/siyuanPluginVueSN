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
        <section class="dist-section">
          <DocBarChart
            :title="i18n.docBarChartTitle"
            :chart-data="notebookDocStats"
            :loading="docChartLoading"
            :i18n="i18n"
          />
        </section>

        <section class="dist-section">
          <DocBarChart
            :title="i18n.blockTypeStats"
            :chart-data="stats.blockTypeStats.map(item => ({
              name: item.label,
              count: item.count,
            }))"
            :i18n="i18n"
          />
        </section>

        <section class="dist-section">
          <h3 class="dist-section-title">
            {{ i18n.notebookBlockTypeTitle }}
          </h3>
          <NotebookBlockTypeChart
            :data="notebookBlockTypeStats"
          />
        </section>

        <section class="dist-section">
          <h3 class="dist-section-title">
            {{ i18n.notebookWordPie }}
          </h3>
          <NotebookWordPie
            :data="notebookWordStats"
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
import { milestoneTargetOfWithRules } from "./utils/milestones"
import { STATISTICS_STORAGE_KEYS } from "./types/storage"
import { PluginStorage } from "@/utils/pluginStorage"
import { STORAGE_KEY_MILESTONE_RULES } from "./types/milestoneRules"

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
  { id: 'overview', labelKey: 'tabOverview' },
  { id: 'heatmap', labelKey: 'activityHeatmap' },
  { id: 'activity', labelKey: 'notebookActivity' },
  { id: 'trend', labelKey: 'trendTab' },
  { id: 'notebookDistribution', labelKey: 'notebookDistributionTab' },
  { id: 'report', labelKey: 'reportTab' },
  { id: 'milestones', labelKey: 'milestones' },
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

const milestonesAchievedCount = computed(() => {
  const s = stats.value
  if (!s) return 0
  const fields: Array<{ type: string, val: number }> = [
    { type: 'notes', val: s.totalNotes },
    { type: 'words', val: s.totalWords },
    { type: 'tags', val: s.totalTags },
    { type: 'backlinks', val: s.totalBacklinks },
    { type: 'assets', val: s.totalAssets },
    { type: 'images', val: s.totalImages },
    { type: 'notebooks', val: s.notebookCount },
    { type: 'code', val: s.codeBlocks },
    { type: 'streak', val: s.writingStreak },
    { type: 'activeDays', val: s.activeDays },
  ]
  return fields.reduce((sum, { type, val }) => {
    let n = 0
    while (milestoneTargetOfWithRules(type, n + 1, customRules.value) <= val) n++
    return sum + n
  }, 0)
})

const customRules = ref<Record<string, number[]>>({})

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
const heatmapNotebooks = ref<Array<{ id: string, name: string }>>([])

async function refreshData(): Promise<void> {
  loading.value = true
  try {
    await refreshCore()
    await loadHistoricalData()
    if (activeTab.value === 'notebookDistribution' && !notebookStatsLoaded.value) {
      await loadNotebookStats()
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

// ========== Main Container ==========
.statistics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-family: $font-body;

  --stat-color-success: #2da44e;
  --stat-color-danger: #cf222e;
  --stat-color-warning: #d97706;
}

// ========== Scrollable Content ==========
.statistics-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  background: var(--b3-theme-background);

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--b3-border-color);
    border-radius: 4px;
    &:hover {
      background: var(--b3-theme-on-surface);
      opacity: 0.2;
    }
  }
}

// ========== Chart Section (Overview tab) ==========
.chart-section {
  padding: 6px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;

  .section-title {
    margin-bottom: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;

    &::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: var(--b3-theme-primary);
      border-radius: 4px;
    }
  }
}

// ========== Tab Bar ==========

.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  padding: 0 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
  overflow-x: auto;
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
  font-family: stats.$font-mono;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  color: var(--b3-theme-primary);
  font-weight: 700;
}

.notebook-distribution-tab {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: stretch;
}

.dist-section {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 12px;
}

.dist-section-title {
  margin: 0 0 10px 0;
  font-family: stats.$font-mono;
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
