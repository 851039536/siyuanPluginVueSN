// 统计数据模块级单例状态：core 启动预载与 Dock 面板共享同一份数据
import type {
  ComputedRef,
  Ref,
} from "vue"
import type { StatisticsData } from "../types"
import {
  computed,
  ref,
} from "vue"
import { getPeriodStats, getStatistics } from "../queries"
// 状态栏任务为统一入口（AGENTS.md 允许跨功能使用），刷新过程在底部状态栏可见
import { useStatusBarTask } from "@/features/statusBar/composables/useStatusBarTask"

// 状态栏任务：启动预载 / 手动刷新 / 定时刷新共用同一任务（模块级 store 去重）
const statusTask = useStatusBarTask("statistics-refresh", "mdi:chart-bar")

/** 状态栏文案 i18n（由 core/面板注入，来源为 statistics 分片） */
let statusI18n: Record<string, any> = {}

/** 注入状态栏文案（core 启动时注入 plugin.i18n.statistics，面板可重复覆盖） */
export function setStatisticsI18n(i18n: Record<string, any>): void {
  statusI18n = i18n
}

const loading = ref(false)
const stats = ref<StatisticsData | null>(null)
const lastUpdateTime = ref("")
const viewMode = ref<"day" | "week" | "month" | "year">("day")
const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
const monthYearRange = ref<1 | 2 | 3>(1)
const selectedYear = ref<number>(new Date().getFullYear())

const periodAvgWords = computed(() => {
  const dailyStats = stats.value?.dailyStats
  if (!dailyStats || dailyStats.length === 0) return 0
  const totalWords = dailyStats.reduce((sum, item) => sum + item.words, 0)
  return Math.round(totalWords / dailyStats.length)
})

/**
 * 全量刷新：core 启动预载、手动刷新、定时刷新共用入口。
 * loading 防重：启动预载与面板打开并发时避免重复全量查询
 */
export async function refreshStatisticsData(): Promise<void> {
  if (loading.value) return
  loading.value = true
  statusTask.progress({ label: statusI18n.statusRefreshing })
  try {
    stats.value = await getStatistics(viewMode.value, {
      dayRange: dayRange.value,
      monthYearRange: monthYearRange.value,
      selectedYear: selectedYear.value,
    })
    lastUpdateTime.value = new Date().toLocaleString("zh-CN")
    statusTask.complete(statusI18n.statusRefreshDone)
  } catch (error) {
    console.error("刷新统计数据失败:", error)
    statusTask.fail(statusI18n.statusRefreshFailed)
  } finally {
    loading.value = false
  }
}

// 仅刷新时段统计（柱状图数据）：切换时间范围时避免重跑全量统计
export async function refreshPeriodStatistics(): Promise<void> {
  if (!stats.value) return
  const period = await getPeriodStats(viewMode.value, {
    dayRange: dayRange.value,
    monthYearRange: monthYearRange.value,
    selectedYear: selectedYear.value,
  })
  stats.value = {
    ...stats.value,
    ...period,
  }
}

export function useStatistics(): {
  loading: Ref<boolean>
  stats: Ref<StatisticsData | null>
  lastUpdateTime: Ref<string>
  viewMode: Ref<"day" | "week" | "month" | "year">
  dayRange: Ref<7 | 15 | 30 | 90 | 180 | 365>
  monthYearRange: Ref<1 | 2 | 3>
  selectedYear: Ref<number>
  periodAvgWords: ComputedRef<number>
  refreshData: () => Promise<void>
  refreshPeriodOnly: () => Promise<void>
} {
  return {
    loading,
    stats,
    lastUpdateTime,
    viewMode,
    dayRange,
    monthYearRange,
    selectedYear,
    periodAvgWords,
    refreshData: refreshStatisticsData,
    refreshPeriodOnly: refreshPeriodStatistics,
  }
}
