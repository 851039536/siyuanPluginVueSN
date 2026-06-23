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
import {
  executeSql,
  formatDateTime,
} from "../queries/executeSql"
import { StatisticsStorage } from "../types/storage"
import { formatDate } from "../utils"

/**
 * 通过 SQL 查询指定日期的新建/修改文档数
 * 替代本地 JSON 快照，数据始终从数据库实时查询
 */
async function getDayCounts(date: Date): Promise<{ created: number, modified: number }> {
  const dateStr = formatDateTime(date).substring(0, 8)
  const rows = await executeSql(`
    SELECT
      (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${dateStr}') as created,
      (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${dateStr}') as modified
  `)
  const row = rows[0] || {}
  return {
    created: Number(row.created || 0),
    modified: Number(row.modified || 0),
  }
}

export function useHistoryData(plugin: Plugin, stats: Ref<StatisticsData | null>): {
  historicalData: Ref<any[]>
  createdChange: ComputedRef<number | null>
  modifiedChange: ComputedRef<number | null>
  notesChange: ComputedRef<number | null>
  wordsChange: ComputedRef<number | null>
  loadHistoricalData: (days?: number) => Promise<void>
} {
  const storage = new StatisticsStorage(plugin)
  const historicalData = ref<any[]>([])

  // 最近有活跃数据的日期（非 0 新增/修改）：回溯最多 7 天，
  // 避免前一天为 0 时显示"骤降/骤升"的误导性对比
  const previousCounts = ref<{ created: number, modified: number } | null>(null)
  let previousLoaded = false
  const MAX_BACKTRACK_DAYS = 7

  async function ensurePreviousActiveDayLoaded(): Promise<void> {
    if (previousLoaded) return
    for (let i = 1; i <= MAX_BACKTRACK_DAYS; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const counts = await getDayCounts(date)
      if (counts.created > 0 || counts.modified > 0) {
        previousCounts.value = counts
        previousLoaded = true
        return
      }
    }
    previousCounts.value = null
    previousLoaded = true
  }

  // 回溯查到最近一个历史快照（totalNotes / totalWords），最多 7 天
  const previousSnapshot = ref<{ totalNotes: number, totalWords: number } | null>(null)
  let previousSnapshotLoaded = false

  async function ensurePreviousSnapshotLoaded(): Promise<void> {
    if (previousSnapshotLoaded) return
    try {
      const historyData = await storage.loadHistory()
      for (let i = 1; i <= MAX_BACKTRACK_DAYS; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateKey = formatDate(date)
        const entry = historyData[dateKey]
        if (entry) {
          previousSnapshot.value = {
            totalNotes: entry.totalNotes ?? 0,
            totalWords: entry.totalWords ?? 0,
          }
          previousSnapshotLoaded = true
          return
        }
      }
    } catch (error) {
      console.error("加载历史快照失败:", error)
    }
    previousSnapshotLoaded = true
  }

  // 触发加载（不阻塞 computed 返回）
  ensurePreviousActiveDayLoaded()
  ensurePreviousSnapshotLoaded()

  const createdChange = computed(() => {
    const prev = previousCounts.value?.created ?? null
    const today = stats.value?.todayCreated
    if (today === undefined) return null
    if (prev === null) return today > 0 ? 100 : null
    if (prev === 0) return today > 0 ? 100 : 0
    return ((today - prev) / prev) * 100
  })

  const modifiedChange = computed(() => {
    const prev = previousCounts.value?.modified ?? null
    const today = stats.value?.todayModified
    if (today === undefined) return null
    if (prev === null) return today > 0 ? 100 : null
    if (prev === 0) return today > 0 ? 100 : 0
    return ((today - prev) / prev) * 100
  })

  const notesChange = computed(() => {
    const prev = previousSnapshot.value?.totalNotes ?? null
    const today = stats.value?.totalNotes
    if (today === undefined) return null
    if (prev === null) return today > 0 ? today : null
    return today - prev
  })

  const wordsChange = computed(() => {
    const prev = previousSnapshot.value?.totalWords ?? null
    const today = stats.value?.totalWords
    if (today === undefined) return null
    if (prev === null) return today > 0 ? today : null
    return today - prev
  })

  /**
   * 将当前 stats 快照写入本地 JSON，供趋势/热力图使用
   * 替代原来的 60 秒定时采集，改为用户主动刷新时写入
   */
  async function saveTodaySnapshot(): Promise<void> {
    const s = stats.value
    if (!s) return
    try {
      const today = new Date()
      const dateKey = formatDate(today)
      const existingData = await storage.loadHistory()
      existingData[dateKey] = {
        date: dateKey,
        dateLabel: `${today.getMonth() + 1}/${today.getDate()}`,
        totalNotes: s.totalNotes,
        totalWords: s.totalWords,
        totalBlocks: s.totalBlocks,
        todayCreated: s.todayCreated,
        todayModified: s.todayModified,
        avgWordsPerDoc: s.avgWordsPerDoc,
      }
      await storage.saveHistory(existingData)
    } catch (error) {
      console.error("保存今日快照失败:", error)
    }
  }

  async function loadHistoricalData(days?: number): Promise<void> {
    // 每次刷新时重置缓存，获取最新数据
    previousLoaded = false
    previousSnapshotLoaded = false
    await ensurePreviousActiveDayLoaded()
    await ensurePreviousSnapshotLoaded()

    // 先写入当天快照，确保趋势/热力图数据是最新的
    await saveTodaySnapshot()

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
    notesChange,
    wordsChange,
    loadHistoricalData,
  }
}
