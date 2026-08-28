<!-- 数据统计主面板：Tab 切换（概览/热力图/活跃度/趋势/分布/报告/里程碑） -->
<template>
  <div class="statistics-panel">
    <!-- 顶部操作栏 -->
    <StatisticsHeader
      :loading="loading"
      :last-update-time="lastUpdateTime"
      :storage-paths="storagePaths"
      :auto-refresh-interval="autoRefreshInterval"
      :i18n="i18n"
      @refresh="refreshData"
      @autoRefreshChange="handleAutoRefreshChange"
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

    <!-- 主要内容：各 Tab 入口容器 -->
    <div
      v-else-if="stats"
      class="statistics-content"
    >
      <OverviewTab
        v-show="activeTab === 'overview'"
        v-model="viewMode"
        v-model:day-range="dayRange"
        v-model:month-year-range="monthYearRange"
        v-model:selected-year="selectedYear"
        :stats="stats"
        :changes="{
          createdChange,
          modifiedChange,
          notesChange,
          wordsChange,
        }"
        :period-avg-words="periodAvgWords"
        :queries="overviewQueries"
        :i18n="i18n"
      />

      <HeatmapTab
        v-show="activeTab === 'heatmap'"
        :stats="stats"
        :queries="heatmapQueries"
        :i18n="i18n"
      />

      <ActivityTab
        v-show="activeTab === 'activity'"
        :get-notebook-activity-trend="getNotebookActivityTrend"
        :i18n="i18n"
      />

      <TrendTab
        v-show="activeTab === 'trend'"
        :historical-data="historicalData"
        :get-trend-prediction="getTrendPrediction"
        :i18n="i18n"
      />

      <DistributionTab
        v-show="activeTab === 'notebookDistribution'"
        :active="activeTab === 'notebookDistribution'"
        :i18n="i18n"
      />

      <ReportTab
        v-show="activeTab === 'report'"
        :get-report-data="getReportData"
        :get-comparison-data="getComparisonData"
        :i18n="i18n"
      />

      <MilestonesTab
        v-show="activeTab === 'milestones'"
        :plugin="plugin"
        :stats="stats"
        :i18n="i18n"
      />
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
import ActivityTab from "./components/NotebookActivity/index.vue"
import DistributionTab from "./components/NotebookDistribution/index.vue"
import HeatmapTab from "./components/heatmap/index.vue"
import MilestonesTab from "./components/milestones/index.vue"
import OverviewTab from "./components/overview/index.vue"
import ReportTab from "./components/report/index.vue"
import TrendTab from "./components/trend/index.vue"
import StatisticsHeader from "./components/common/StatisticsHeader.vue"
import { useHistoryData } from "./composables/useHistoryData"
import { useMilestoneStorage } from "./composables/useMilestoneStorage"
import { useStatistics } from "./composables/useStatistics"
import {
  getDateChangedDocs,
  getDateRangeChangeStats,
  getDeletedDocs,
  getDeletedDocsInRange,
  getRecentUpdatedDocs,
} from "./queries/docChangeStats"
import {
  getHeatmapActivityData,
  getHeatmapDailyDetail,
} from "./queries/heatmapStats"
import { getNotebookActivityTrend } from "./queries/notebookStats"
import {
  getComparisonData,
  getReportData,
  getTrendPrediction,
} from "./queries/reportStats"
import { MILESTONE_FIELD_MAP, MILESTONE_TYPES } from "./types/milestoneRules"
import {
  DEFAULT_STATISTICS_SETTINGS,
  STATISTICS_STORAGE_KEYS,
  StatisticsStorage,
  type StatisticsSettings,
} from "./types/storage"
import { countMilestonesReached } from "./utils/milestones"

interface Props {
  plugin: Plugin
  onRegisterRefresh?: (fn: () => Promise<void>) => void
  onAutoRefreshChange?: (settings: StatisticsSettings) => void
  i18n?: Record<string, any>
}

const props = defineProps<Props>()

const i18n = computed(() => props.i18n || {})

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
  refreshData: refreshCore,
  refreshPeriodOnly,
} = useStatistics()

const {
  historicalData,
  createdChange,
  modifiedChange,
  notesChange,
  wordsChange,
  loadHistoricalData,
} = useHistoryData(props.plugin, stats)

// 里程碑自定义规则：与编辑弹窗共享同一份 composable 状态
const { customRules, initMilestoneStorage } = useMilestoneStorage()

const milestonesAchievedCount = computed(() => {
  const s = stats.value
  if (!s) return 0
  return MILESTONE_TYPES.reduce((sum, mt) => {
    const val = Number(s[MILESTONE_FIELD_MAP[mt.key]] ?? 0)
    return sum + countMilestonesReached(mt.key, val, customRules.value)
  }, 0)
})

// 下发给子入口的查询函数聚合对象
const overviewQueries = {
  getDateChangedDocs,
  getDateRangeChangeStats,
  getRecentUpdatedDocs,
  getDeletedDocs,
  getDeletedDocsInRange,
}

const heatmapQueries = {
  getHeatmapActivityData,
  getHeatmapDailyDetail,
}

const storagePaths = computed(() => {
  const dataDir = (props.plugin as any).dataDir || ""
  const pluginName = props.plugin.name || ""
  const baseDir = `${dataDir}/storage/petal/${pluginName}`
  return [
    {
      key: STATISTICS_STORAGE_KEYS.HISTORY,
      desc: i18n.value.historyStorageDesc,
      path: `${baseDir}/${STATISTICS_STORAGE_KEYS.HISTORY}.json`,
    },
  ]
})

// ============================================================
// 定时自动刷新
// ============================================================

/** 当前自动刷新间隔（分钟，0 = 关闭），Header 下拉绑定值 */
const autoRefreshInterval = ref(0)

/** 启动时读取持久化设置：启用则立即应用定时器（加载起点在面板挂载，而非设置面板） */
async function initAutoRefresh(): Promise<void> {
  try {
    const settings = await new StatisticsStorage(props.plugin).loadSettings()
    autoRefreshInterval.value = settings.autoRefreshEnabled
      ? settings.refreshInterval
      : 0
    props.onAutoRefreshChange?.(settings)
  } catch (error) {
    console.error("加载统计自动刷新设置失败:", error)
  }
}

/** Header 下拉变更：interval 0 = 关闭，否则按分钟启动定时器 */
function handleAutoRefreshChange(interval: number): void {
  const settings: StatisticsSettings = {
    autoRefreshEnabled: interval > 0,
    refreshInterval: interval > 0 ? interval : DEFAULT_STATISTICS_SETTINGS.refreshInterval,
  }
  autoRefreshInterval.value = interval
  new StatisticsStorage(props.plugin)
    .saveSettings(settings)
    .catch((error) => {
      console.error("保存统计自动刷新设置失败:", error)
    })
  props.onAutoRefreshChange?.(settings)
}

// 切换视图模式/时间范围时只重查时段统计（柱状图），避免重跑全量统计导致卡顿
watch([viewMode, dayRange, monthYearRange, selectedYear], async () => {
  loading.value = true
  try {
    await refreshPeriodOnly()
  } catch (error) {
    console.error("刷新时段统计失败:", error)
  } finally {
    loading.value = false
  }
})

let refreshSeq = 0

async function refreshData(): Promise<void> {
  const seq = ++refreshSeq
  loading.value = true
  try {
    await refreshCore()
    if (seq !== refreshSeq) return
    await loadHistoricalData()
  } catch (error) {
    console.error("刷新统计数据失败:", error)
  } finally {
    if (seq === refreshSeq) {
      loading.value = false
    }
  }
}

onMounted(async () => {
  refreshData()
  props.onRegisterRefresh?.(refreshData)
  await initMilestoneStorage(props.plugin)
  await initAutoRefresh()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as stats;
</style>
