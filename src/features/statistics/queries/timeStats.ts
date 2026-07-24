// 时间维度统计（日/周/月/年聚合）

import type {
  AggregationRow,
  DailyWordCount,
} from "../types"
import { padZero } from "../utils"
import {
  executeSql,
  formatDateTime,
} from "./executeSql"

export async function getWordCountAggregation(
  startDate: string,
  endDate: string,
  subStrLen: number,
  groupField: string,
): Promise<AggregationRow[]> {
  const sql = `
    SELECT
      substr(created, 1, ${subStrLen}) as ${groupField},
      SUM(LENGTH(content)) as total
    FROM blocks
    WHERE type = 'p'
      AND content IS NOT NULL
      AND content != ''
      AND created >= '${startDate}'
      AND created <= '${endDate}'
    GROUP BY substr(created, 1, ${subStrLen})
    ORDER BY ${groupField}
    LIMIT 1024
  `
  return await executeSql<AggregationRow>(sql)
}

export async function getDailyStats(days: number): Promise<DailyWordCount[]> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - days + 1)
  startDate.setHours(0, 0, 0, 0)

  const startDateStr = formatDateTime(startDate)
  const endDateStr = formatDateTime(today)

  const queryResult = await getWordCountAggregation(startDateStr, endDateStr, 8, "date")

  const dateMap = new Map<string, number>()
  queryResult.forEach((row) => {
    const dateStr = String(row.date)
    const year = Number.parseInt(dateStr.substring(0, 4))
    const month = Number.parseInt(dateStr.substring(4, 6))
    const day = Number.parseInt(dateStr.substring(6, 8))
    const formattedDate = `${year}-${padZero(month)}-${padZero(day)}`
    dateMap.set(formattedDate, row.total || 0)
  })

  const result: DailyWordCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const dateStr = `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
    const words = dateMap.get(dateStr) || 0

    result.push({
      date: dateStr,
      words,
      dateLabel: `${date.getMonth() + 1}/${date.getDate()} ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}`,
    })
  }

  return result
}

export async function getWeeklyStats(weeks: number): Promise<DailyWordCount[]> {
  const today = new Date()
  const firstWeekStart = new Date(today)
  const dayOfWeek = firstWeekStart.getDay() || 7
  firstWeekStart.setDate(today.getDate() - dayOfWeek + 1 - (weeks - 1) * 7)
  firstWeekStart.setHours(0, 0, 0, 0)

  const lastWeekEnd = new Date(today)
  const currentDayOfWeek = lastWeekEnd.getDay() || 7
  lastWeekEnd.setDate(today.getDate() - currentDayOfWeek + 7)
  lastWeekEnd.setHours(23, 59, 59, 999)

  const startDate = formatDateTime(firstWeekStart)
  const endDate = formatDateTime(lastWeekEnd)

  const queryResult = await getWordCountAggregation(startDate, endDate, 8, "date")

  const dateMap = new Map<string, number>()
  queryResult.forEach((row) => {
    dateMap.set(String(row.date), row.total || 0)
  })

  const result: DailyWordCount[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(today)
    const dow = weekStart.getDay() || 7
    weekStart.setDate(today.getDate() - dow + 1 - i * 7)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    let weekWords = 0
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + d)
      const dayStr = formatDateTime(day).substring(0, 8)
      weekWords += dateMap.get(dayStr) || 0
    }

    result.push({
      date: `${weekStart.getFullYear()}-${padZero(weekStart.getMonth() + 1)}-${padZero(weekStart.getDate())}`,
      words: weekWords,
      dateLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
    })
  }

  return result
}

export async function getMonthlyStatsRange(years: number): Promise<DailyWordCount[]> {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const startYear = currentYear - years + 1
  const startDate = `${startYear}0101000000`
  const endDate = formatDateTime(today)

  const queryResult = await getWordCountAggregation(startDate, endDate, 6, "month")

  const monthMap = new Map<string, number>()
  queryResult.forEach((row) => {
    monthMap.set(String(row.month), row.total || 0)
  })

  const result: DailyWordCount[] = []
  for (let y = startYear; y <= currentYear; y++) {
    const startM = 1
    const endM = y === currentYear ? currentMonth : 12

    for (let m = startM; m <= endM; m++) {
      const monthStr = padZero(m)
      const monthKey = `${y}${monthStr}`
      const words = monthMap.get(monthKey) || 0

      result.push({
        date: `${y}-${monthStr}`,
        words,
        dateLabel: `${y}/${m}`,
      })
    }
  }

  return result
}

export async function getYearlyStats(selectedYear: number): Promise<DailyWordCount[]> {
  const baseYear = selectedYear
  const startYear = baseYear - 4
  const startDate = `${startYear}0101000000`
  const endDate = `${baseYear}1231235959`

  const queryResult = await getWordCountAggregation(startDate, endDate, 4, "year")

  const yearMap = new Map<string, number>()
  queryResult.forEach((row) => {
    yearMap.set(String(row.year), row.total || 0)
  })

  const result: DailyWordCount[] = []
  for (let i = 4; i >= 0; i--) {
    const year = baseYear - i
    const words = yearMap.get(String(year)) || 0

    result.push({
      date: `${year}`,
      words,
      dateLabel: `${year}年`,
    })
  }

  return result
}
