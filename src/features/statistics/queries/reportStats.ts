// 报告查询（年度/月度 + 趋势预测线性回归 + 对比分析）

import type {
  ComparisonData,
  DailyWordCount,
  DateOnlyRow,
  DateWordsRow,
  MonthWordsRow,
  ReportData,
  ScalarRow,
  TrendPrediction,
} from "../types"
import {
  formatDate,
  formatYmd,
  padZero,
  parseYmd,
  toDashedYmd,
} from "../utils"
import {
  executeSql,
  formatDateTime,
} from "./executeSql"
import { getMostProductiveNotebook } from "./notebookStats"

async function calcLongestStreak(startStr: string, endStr: string): Promise<number> {
  try {
    const rows = await executeSql<DateOnlyRow>(`
      SELECT DISTINCT substr(created, 1, 8) as date
      FROM blocks
      WHERE type = 'p' AND length > 0
        AND created >= '${startStr}' AND created <= '${endStr}'
      ORDER BY date ASC
      LIMIT 1024
    `)

    if (!rows || rows.length === 0) return 0

    const activeDates = new Set(rows.map((r) => String(r.date)))
    const sorted = [...activeDates].sort()
    let longest = 1
    let current = 1

    for (let i = 1; i < sorted.length; i++) {
      const diff = (parseYmd(sorted[i]).getTime() - parseYmd(sorted[i - 1]).getTime()) / 86400000

      if (diff === 1) {
        current++
        longest = Math.max(longest, current)
      } else {
        current = 1
      }
    }

    return longest
  } catch {
    return 0
  }
}

/** 时段核心指标（年度/月度报告共用） */
interface PeriodCore {
  totalWords: number
  totalNotesCreated: number
  activeDays: number
  maxWordsDay: { date: string, words: number }
  mostProductiveNotebook: { name: string, words: number }
  longestStreak: number
}

/** 加载时段核心指标：六项查询相互独立，并行执行 */
async function loadPeriodCore(startStr: string, endStr: string): Promise<PeriodCore> {
  const [wordRows, createdRows, activeRows, maxDayRows, mostProductiveNotebook, longestStreak] = await Promise.all([
    executeSql<ScalarRow>(`
      SELECT SUM(length) as total_words
      FROM blocks
      WHERE type = 'p' AND length > 0
        AND created >= '${startStr}' AND created <= '${endStr}'
    `),
    executeSql<ScalarRow>(`
      SELECT COUNT(*) as cnt
      FROM blocks
      WHERE type = 'd'
        AND created >= '${startStr}' AND created <= '${endStr}'
    `),
    executeSql<ScalarRow>(`
      SELECT COUNT(DISTINCT substr(created, 1, 8)) as active_days
      FROM blocks
      WHERE type = 'p' AND length > 0
        AND created >= '${startStr}' AND created <= '${endStr}'
    `),
    executeSql<DateWordsRow>(`
      SELECT substr(created, 1, 8) as date, SUM(length) as words
      FROM blocks
      WHERE type = 'p' AND length > 0
        AND created >= '${startStr}' AND created <= '${endStr}'
      GROUP BY substr(created, 1, 8)
      ORDER BY words DESC
      LIMIT 1
    `),
    getMostProductiveNotebook(startStr, endStr),
    calcLongestStreak(startStr, endStr),
  ])

  const maxWordsDay = maxDayRows.length > 0
    ? {
        date: toDashedYmd(String(maxDayRows[0].date)),
        words: Number(maxDayRows[0].words || 0),
      }
    : {
        date: "",
        words: 0,
      }

  return {
    totalWords: Number(wordRows[0]?.total_words || 0),
    totalNotesCreated: Number(createdRows[0]?.cnt || 0),
    activeDays: Number(activeRows[0]?.active_days || 0),
    maxWordsDay,
    mostProductiveNotebook,
    longestStreak,
  }
}

export async function getReportData(year?: number, month?: number): Promise<ReportData> {
  const today = new Date()
  const reportYear = year || today.getFullYear()
  const reportMonth = month

  try {
    if (!reportMonth) {
      // === 年度报告 ===
      const yearStartStr = `${reportYear}0101000000`
      const yearEndStr = `${reportYear}1231235959`

      const [core, monthlyRows] = await Promise.all([
        loadPeriodCore(yearStartStr, yearEndStr),
        executeSql<MonthWordsRow>(`
          SELECT substr(created, 1, 6) as month,
            SUM(length) as words,
            COUNT(DISTINCT CASE WHEN type='d' THEN root_id END) as created
          FROM blocks
          WHERE (type = 'p' OR type = 'd')
            AND created >= '${yearStartStr}' AND created <= '${yearEndStr}'
          GROUP BY substr(created, 1, 6)
          ORDER BY month ASC
        `),
      ])

      const monthlyBreakdown: Array<{ month: string, words: number, created: number }> = []
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${reportYear}${padZero(m)}`
        const row = (monthlyRows || []).find((r) => String(r.month) === monthKey)
        monthlyBreakdown.push({
          month: `${reportYear}/${padZero(m)}`,
          words: Number(row?.words || 0),
          created: Number(row?.created || 0),
        })
      }

      // 当年按已过天数计日均；往年按全年天数（闰年 366）
      const daysInYear = today.getFullYear() === reportYear
        ? Math.ceil((today.getTime() - new Date(reportYear, 0, 1).getTime()) / 86400000) + 1
        : (new Date(reportYear, 1, 29).getDate() === 29 ? 366 : 365)

      return {
        periodLabel: `${reportYear}年`,
        totalWords: core.totalWords,
        totalNotesCreated: core.totalNotesCreated,
        avgDailyWords: daysInYear > 0 ? Math.round(core.totalWords / daysInYear) : 0,
        activeDays: core.activeDays,
        maxWordsDay: core.maxWordsDay,
        mostProductiveNotebook: core.mostProductiveNotebook,
        longestStreak: core.longestStreak,
        monthlyBreakdown,
      }
    } else {
      // === 月度报告 ===
      const monthStartStr = `${reportYear}${padZero(reportMonth)}01000000`
      const lastDay = new Date(reportYear, reportMonth, 0).getDate()
      const monthEndStr = `${reportYear}${padZero(reportMonth)}${padZero(lastDay)}235959`

      const [core, dailyRows] = await Promise.all([
        loadPeriodCore(monthStartStr, monthEndStr),
        executeSql<DateWordsRow>(`
          SELECT substr(created, 1, 8) as date,
            SUM(length) as words,
            COUNT(DISTINCT CASE WHEN type='d' THEN root_id END) as created
          FROM blocks
          WHERE (type = 'p' OR type = 'd')
            AND created >= '${monthStartStr}' AND created <= '${monthEndStr}'
          GROUP BY substr(created, 1, 8)
          ORDER BY date ASC
        `),
      ])

      const monthlyBreakdown = (dailyRows || []).map((r) => {
        const d = String(r.date)
        return {
          month: `${d.substring(4, 6)}/${d.substring(6, 8)}`,
          words: Number(r.words || 0),
          created: Number(r.created || 0),
        }
      })

      return {
        periodLabel: `${reportYear}年${reportMonth}月`,
        totalWords: core.totalWords,
        totalNotesCreated: core.totalNotesCreated,
        avgDailyWords: lastDay > 0 ? Math.round(core.totalWords / lastDay) : 0,
        activeDays: core.activeDays,
        maxWordsDay: core.maxWordsDay,
        mostProductiveNotebook: core.mostProductiveNotebook,
        longestStreak: core.longestStreak,
        monthlyBreakdown,
      }
    }
  } catch (error) {
    console.error("获取报告数据失败:", error)
    return {
      periodLabel: "",
      totalWords: 0,
      totalNotesCreated: 0,
      avgDailyWords: 0,
      activeDays: 0,
      maxWordsDay: {
        date: "",
        words: 0,
      },
      mostProductiveNotebook: {
        name: "",
        words: 0,
      },
      longestStreak: 0,
      monthlyBreakdown: [],
    }
  }
}

export async function getTrendPrediction(): Promise<TrendPrediction> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 29)
  startDate.setHours(0, 0, 0, 0)

  const startStr = formatDateTime(startDate)
  const endStr = formatDateTime(today)

  try {
    const rows = await executeSql<DateWordsRow>(`
      SELECT substr(created, 1, 8) as date, SUM(length) as words
      FROM blocks
      WHERE type = 'p' AND length > 0
        AND created >= '${startStr}' AND created <= '${endStr}'
      GROUP BY substr(created, 1, 8)
      ORDER BY date ASC
    `)

    const wordMap = new Map<string, number>()
    if (rows) {
      for (const row of rows) {
        wordMap.set(String(row.date), Number(row.words || 0))
      }
    }

    const historical: DailyWordCount[] = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)

      historical.push({
        date: formatDate(date),
        words: wordMap.get(formatYmd(date)) || 0,
        dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      })
    }

    const n = historical.length
    if (n < 2) {
      return {
        historical,
        predicted: [],
        slope: 0,
        intercept: 0,
        rSquared: 0,
        weeklyProjection: 0,
        monthlyProjection: 0,
      }
    }

    // 简单线性回归：y = mx + b
    const xs = historical.map((_, i) => i)
    const ys = historical.map((h) => h.words)
    const meanX = xs.reduce((a, b) => a + b, 0) / n
    const meanY = ys.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denominator = 0
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX
      numerator += dx * (ys[i] - meanY)
      denominator += dx * dx
    }

    const slope = denominator !== 0 ? numerator / denominator : 0
    const intercept = meanY - slope * meanX

    const yPred = xs.map((x) => slope * x + intercept)
    const ssRes = ys.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0)
    const ssTot = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0)
    const rSquared = ssTot !== 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0

    const predicted: DailyWordCount[] = []
    for (let i = 0; i < 7; i++) {
      const idx = n + i
      const predWords = Math.max(0, Math.round(slope * idx + intercept))
      const predDate = new Date(today)
      predDate.setDate(today.getDate() + i + 1)

      predicted.push({
        date: formatDate(predDate),
        words: predWords,
        dateLabel: `${predDate.getMonth() + 1}/${predDate.getDate()}`,
      })
    }

    const weeklyProjection = predicted.reduce((s, p) => s + p.words, 0)
    const monthlyProjection = Math.round(
      slope > 0 ? (slope * (n + 30) + intercept) * 30 : (meanY * 30),
    )

    return {
      historical,
      predicted,
      slope,
      intercept,
      rSquared,
      weeklyProjection,
      monthlyProjection,
    }
  } catch (error) {
    console.error("获取趋势预测失败:", error)
    return {
      historical: [],
      predicted: [],
      slope: 0,
      intercept: 0,
      rSquared: 0,
      weeklyProjection: 0,
      monthlyProjection: 0,
    }
  }
}

export async function getComparisonData(
  yearA: number,
  monthA: number | undefined,
  yearB: number,
  monthB: number | undefined,
): Promise<ComparisonData> {
  const [a, b] = await Promise.all([
    getReportData(yearA, monthA),
    getReportData(yearB, monthB),
  ])
  return {
    periodALabel: a.periodLabel,
    periodBLabel: b.periodLabel,
    a,
    b,
    deltas: {
      totalWords: b.totalWords - a.totalWords,
      totalNotesCreated: b.totalNotesCreated - a.totalNotesCreated,
      avgDailyWords: b.avgDailyWords - a.avgDailyWords,
      activeDays: b.activeDays - a.activeDays,
      longestStreak: b.longestStreak - a.longestStreak,
    },
  }
}
