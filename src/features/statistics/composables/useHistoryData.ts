import type { Plugin } from "siyuan"
import type {
  ComputedRef,
  Ref,
} from "vue"
import type { StatisticsData } from "../types"
import {
  computed,
  ref,
} from "vue"
import { getStatistics } from "../queries"
import { StatisticsStorage } from "../types/storage"
import {
  formatDate,
  padZero,
} from "../utils"

export function useHistoryData(plugin: Plugin, stats: Ref<StatisticsData | null>): {
  historicalData: Ref<any[]>
  createdChange: ComputedRef<number | null>
  modifiedChange: ComputedRef<number | null>
  loadHistoricalData: (days?: number) => Promise<void>
} {
  const storage = new StatisticsStorage(plugin)
  const historicalData = ref<any[]>([])

  const yesterdayCreated = computed(() => {
    if (!historicalData.value || historicalData.value.length < 2) return null
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${padZero(yesterday.getMonth() + 1)}-${padZero(yesterday.getDate())}`

    const yesterdayData = historicalData.value.find(
      (item: any) => item.date === yesterdayStr,
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
      (item: any) => item.date === yesterdayStr,
    )
    return yesterdayData?.todayModified ?? null
  })

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

  async function loadHistoricalData(days?: number): Promise<void> {
    try {
      const data = await getHistoricalStatistics(days)
      historicalData.value = [...data].reverse()
    } catch (error) {
      console.error("加载历史数据失败:", error)
    }
  }

  async function getHistoricalStatistics(days?: number): Promise<any[]> {
    try {
      const historyData = await storage.loadHistory()
      const today = new Date()
      const result: any[] = []
      let lastKnownStats: {
        totalNotes: number
        totalWords: number
        totalBlocks: number
        avgWordsPerDoc: number
      } | null = null

      let daysToProcess = days
      if (days === undefined) {
        const dateKeys = Object.keys(historyData).sort()
        if (dateKeys.length > 0) {
          const earliestDate = new Date(dateKeys[0])
          const diffTime = today.getTime() - earliestDate.getTime()
          daysToProcess = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        } else {
          daysToProcess = 30
        }
      }

      for (let i = (daysToProcess || 30) - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dateKey = formatDate(date)
        const isToday = i === 0

        const dayData = historyData[dateKey]
        const isValidData = dayData && (dayData.totalWords > 0 || dayData.totalNotes > 0)

        if (isValidData) {
          const record = createHistoryRecord(
            date,
            dayData.totalNotes ?? 0,
            dayData.totalWords ?? 0,
            dayData.totalBlocks ?? 0,
            dayData.todayCreated ?? 0,
            dayData.todayModified ?? 0,
            dayData.avgWordsPerDoc ?? 0,
          )
          result.push(record)
          lastKnownStats = {
            totalNotes: record.totalNotes,
            totalWords: record.totalWords,
            totalBlocks: record.totalBlocks,
            avgWordsPerDoc: record.avgWordsPerDoc,
          }
        } else if (isToday) {
          try {
            const currentStats = await getStatistics("day", {
              dayRange: 7,
              monthYearRange: 1,
              selectedYear: today.getFullYear(),
            })
            const record = createHistoryRecord(
              date,
              currentStats.totalNotes,
              currentStats.totalWords,
              currentStats.totalBlocks,
              currentStats.todayCreated,
              currentStats.todayModified,
              currentStats.avgWordsPerDoc,
            )
            result.push(record)
            lastKnownStats = {
              totalNotes: record.totalNotes,
              totalWords: record.totalWords,
              totalBlocks: record.totalBlocks,
              avgWordsPerDoc: record.avgWordsPerDoc,
            }
          } catch (error) {
            console.error("获取今日实时数据失败:", error)
            const record = lastKnownStats
              ? createHistoryRecord(
                  date,
                  lastKnownStats.totalNotes,
                  lastKnownStats.totalWords,
                  lastKnownStats.totalBlocks,
                  0,
                  0,
                  lastKnownStats.avgWordsPerDoc,
                )
              : createHistoryRecord(date, 0, 0, 0, 0, 0, 0)
            result.push(record)
          }
        } else {
          const record = lastKnownStats
            ? createHistoryRecord(
                date,
                lastKnownStats.totalNotes,
                lastKnownStats.totalWords,
                lastKnownStats.totalBlocks,
                0,
                0,
                lastKnownStats.avgWordsPerDoc,
              )
            : createHistoryRecord(date, 0, 0, 0, 0, 0, 0)
          result.push(record)
        }
      }

      return result
    } catch (error) {
      console.error("获取历史统计数据失败:", error)
      return []
    }
  }

  function createHistoryRecord(
    date: Date,
    totalNotes: number,
    totalWords: number,
    totalBlocks: number,
    todayCreated: number,
    todayModified: number,
    avgWordsPerDoc: number,
  ): {
    date: string
    dateLabel: string
    totalNotes: number
    totalWords: number
    totalBlocks: number
    todayCreated: number
    todayModified: number
    avgWordsPerDoc: number
  } {
    return {
      date: formatDate(date),
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      totalNotes,
      totalWords,
      totalBlocks,
      todayCreated,
      todayModified,
      avgWordsPerDoc,
    }
  }

  return {
    historicalData,
    createdChange,
    modifiedChange,
    loadHistoricalData,
  }
}
