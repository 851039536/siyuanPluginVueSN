import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
  DailyWordCount,
  StatisticsData,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import { getStatistics } from "../queries"

export function useStatistics(): {
  loading: Ref<boolean>
  stats: Ref<StatisticsData | null>
  lastUpdateTime: Ref<string>
  viewMode: Ref<"day" | "week" | "month" | "year">
  dayRange: Ref<7 | 15 | 30 | 90 | 180 | 365>
  monthYearRange: Ref<1 | 2 | 3>
  selectedYear: Ref<number>
  chartData: Ref<DailyWordCount[]>
  updateInterval: Ref<number>
  periodAvgWords: ComputedRef<number>
  chartTitle: ComputedRef<string>
  refreshData: () => Promise<void>
} {
  const loading = ref(false)
  const stats = ref<StatisticsData | null>(null)
  const lastUpdateTime = ref("")
  const viewMode = ref<"day" | "week" | "month" | "year">("day")
  const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
  const monthYearRange = ref<1 | 2 | 3>(1)
  const selectedYear = ref<number>(new Date().getFullYear())
  const chartData = ref<DailyWordCount[]>([])
  const updateInterval = ref(60)

  const periodAvgWords = computed(() => {
    if (!chartData.value || chartData.value.length === 0) return 0
    const totalWords = chartData.value.reduce((sum, item) => sum + item.words, 0)
    const days = chartData.value.length
    return days > 0 ? Math.round(totalWords / days) : 0
  })

  const chartTitle = computed(() => {
    return stats.value?.currentPeriod || ""
  })

  async function refreshData(): Promise<void> {
    stats.value = await getStatistics(viewMode.value, {
      dayRange: dayRange.value,
      monthYearRange: monthYearRange.value,
      selectedYear: selectedYear.value,
    })
    chartData.value = stats.value.dailyStats || []
    lastUpdateTime.value = new Date().toLocaleString("zh-CN")
  }

  return {
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
    refreshData,
  }
}
