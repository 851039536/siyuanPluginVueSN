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

    <!-- Tab 栏 -->
    <div class="tab-bar">
      <button
        :class="['tab-item', { active: activeTab === 'overview' }]"
        @click="activeTab = 'overview'"
      >
        {{ i18n.tabOverview || '概览' }}
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'heatmap' }]"
        @click="activeTab = 'heatmap'"
      >
        {{ i18n.activityHeatmap || '活跃热力图' }}
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'activity' }]"
        @click="activeTab = 'activity'"
      >
        {{ i18n.notebookActivity || '写作活跃度' }}
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'milestones' }]"
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
          :i18n="statsCardsI18n"
        />

        <!-- 文档变化详情（日期范围 + 柱状图 + 详情列表） -->
        <DocChangeSection
          :on-get-date-changed-docs="getDateChangedDocs"
          :on-get-date-range-change-stats="getDateRangeChangeStats"
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

        <!-- 可折叠：字数排行 -->
        <CollapsibleSection
          :title="`🏆 ${i18n.wordRanking || '字数排行'}`"
          :default-expanded="false"
        >
          <WordRanking
            v-if="viewMode !== 'trend'"
            :chart-data="chartData"
            :i18n="wordRankingI18n"
          />
        </CollapsibleSection>

        <!-- 可折叠：各笔记本文档数 -->
        <CollapsibleSection
          :title="`📂 ${i18n.docBarChartTitle}`"
          :default-expanded="false"
        >
          <DocBarChart
            :title="i18n.docBarChartTitle"
            :chart-data="notebookDocStats"
            :loading="docChartLoading"
            :i18n="docBarChartI18n"
          />
        </CollapsibleSection>

        <!-- 可折叠：块类型分布 -->
        <CollapsibleSection
          :title="`🧩 ${i18n.blockTypeStats || '块类型分布'}`"
          :badge="stats.blockTypeStats.length > 0 ? `${stats.blockTypeStats.length}种` : ''"
          :default-expanded="false"
        >
          <DocBarChart
            :title="i18n.blockTypeStats || '块类型分布'"
            :chart-data="stats.blockTypeStats.map(item => ({
              name: item.label,
              count: item.count,
            }))"
            :i18n="blockTypeChartI18n"
          />
        </CollapsibleSection>

        <!-- 可折叠：笔记本字数占比饼图 -->
        <CollapsibleSection
          :title="`🥧 ${i18n.notebookWordPie || '笔记本字数占比'}`"
          :badge="notebookWordStats.length > 0 ? `${notebookWordStats.length}` : ''"
          :default-expanded="false"
        >
          <NotebookWordPie
            :data="notebookWordStats"
          />
        </CollapsibleSection>

        <!-- 可折叠：年度/月度报告 -->
        <CollapsibleSection
          :title="`📊 ${i18n.reportTitle || '年度/月度报告'}`"
          :default-expanded="false"
        >
          <ReportView
            :on-get-report-data="getReportData"
          />
        </CollapsibleSection>

        <!-- 可折叠：趋势预测 -->
        <CollapsibleSection
          :title="`🔮 ${i18n.predictionTitle || '趋势预测'}`"
          :default-expanded="false"
        >
          <TrendPrediction
            :on-get-trend-prediction="getTrendPrediction"
          />
        </CollapsibleSection>
      </div>

      <!-- 里程碑 Tab -->
      <div
        v-show="activeTab === 'milestones'"
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
        v-show="activeTab === 'heatmap'"
        class="heatmap-tab"
      >
        <HeatmapCard
          :historical-data="historicalData"
          :writing-streak="stats?.writingStreak ?? 0"
          :active-days="stats?.activeDays ?? 0"
          :i18n="heatmapI18n"
        />
      </div>

      <!-- 写作活跃度 Tab -->
      <div
        v-show="activeTab === 'activity'"
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
import BarChart from "./components/BarChart.vue"
import CollapsibleSection from "./components/CollapsibleSection.vue"
import DocBarChart from "./components/DocBarChart.vue"
import DocChangeSection from "./components/DocChangeSection.vue"
import HeatmapCard from "./components/HeatmapCard.vue"
import MilestonesCard from "./components/MilestonesCard.vue"
import NotebookActivityTrend from "./components/NotebookActivityTrend.vue"
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
import { useReport } from "./composables/useReport"
import { useStatistics } from "./composables/useStatistics"

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
    wordRanking?: string
    blockTypeStats?: string
    notebookWordPie?: string
    notebookActivity?: string
    reportTitle?: string
    predictionTitle?: string
    activityHeatmap?: string
    milestones?: string
    tabOverview?: string
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

const activeTab = ref<"overview" | "heatmap" | "activity" | "milestones">("activity")

const {
  loading,
  stats,
  lastUpdateTime,
  viewMode,
  dayRange,
  monthYearRange,
  selectedYear,
  chartData,
  updateInterval,
  periodAvgWords,
  chartTitle,
  refreshData: refreshCore,
} = useStatistics()

const {
  historicalData,
  yesterdayCreated: _yesterdayCreated,
  yesterdayModified: _yesterdayModified,
  createdChange,
  modifiedChange,
  loadHistoricalData,
} = useHistoryData(props.plugin, stats)

const {
  notebookDocStats,
  docChartLoading,
  notebookWordStats,
  loadNotebookDocStats,
  loadNotebookWordStats,
} = useNotebookStats()

const {
  getDateChangedDocs,
  getDateRangeChangeStats,
  getNotebookActivityTrend,
  getReportData,
  getTrendPrediction,
} = useReport()

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
// 公式：计算每种类型的已达成里程碑数
function milestoneTargetOf(type: string, n: number): number {
  const g = Math.floor((n - 1) / 3)
  const r = (n - 1) % 3
  switch (type) {
    case "notes": return 10 + g * 30 + r * 10
    case "notebooks": return n * 5
    case "words": return (g * 2 + r + 1) * 10000
    case "code": return 10 + (n - 1) * 30
    case "tags": return 10 + (n - 1) * 30
    case "backlinks": return 10 + g * 50 + r * 20
    case "assets": return 10 + g * 20 + r * 10
    case "images": return 10 + (n - 1) * 30
    case "streak": return Math.round(3 * Math.pow(1.5, n - 1))
    case "activeDays": return Math.round(10 * Math.pow(1.5, n - 1))
    default: return n * 10
  }
}

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

const docChangeI18n = computed(() => props.i18n)

watch([viewMode, dayRange, monthYearRange, selectedYear], () => {
  refreshData()
})

async function refreshData(): Promise<void> {
  loading.value = true
  try {
    await refreshCore()
    await loadHistoricalData()
    await loadNotebookDocStats()
    await loadNotebookWordStats()
  } catch (error) {
    console.error("刷新统计数据失败:", error)
  } finally {
    loading.value = false
  }
}

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
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  font-family: $font-body;
  font-weight: 500;
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
    font-weight: 600;

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
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.milestones-tab,
.heatmap-tab,
.activity-tab {
  padding: 12px;
}
</style>
