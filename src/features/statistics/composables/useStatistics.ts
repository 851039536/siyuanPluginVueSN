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
 * 并发防重由 dockPreload 注册表 state（loading）承担，此处仅维护面板 UI 的 loading
 */
export async function refreshStatisticsData(): Promise<void> {
  loading.value = true
  try {
    stats.value = await getStatistics(viewMode.value, {
      dayRange: dayRange.value,
      monthYearRange: monthYearRange.value,
      selectedYear: selectedYear.value,
    })
    lastUpdateTime.value = new Date().toLocaleString("zh-CN")
  } finally {
    loading.value = false
  }
}

// 仅刷新时段统计（柱状图数据）：切换时间范围时避免重跑全量统计
// 请求时序计数：快速切换视图/范围时丢弃过期响应，防止旧数据覆盖新结果
let periodSeq = 0
export async function refreshPeriodStatistics(): Promise<void> {
  if (!stats.value) return
  const seq = ++periodSeq
  const period = await getPeriodStats(viewMode.value, {
    dayRange: dayRange.value,
    monthYearRange: monthYearRange.value,
    selectedYear: selectedYear.value,
  })
  if (seq !== periodSeq) return
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
