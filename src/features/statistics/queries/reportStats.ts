// 报告查询（年度/月度 + 趋势预测线性回归 + 对比分析）

import type {
  ComparisonData,
  DailyWordCount,
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
} from "../utils"
import {
  executeSql,
  formatDateTime,
} from "./executeSql"
import { getMostProductiveNotebook } from "./notebookStats"
import {
  derivePeriodStatsFromDaily as derivePeriodStatsCore,
  linearFit,
  projectSum,
} from "./reportMath"

/**
 * 由「按日聚合」结果派生时段核心指标。
 * 实现已抽至 reportMath.ts（与思源 API 解耦，便于离线单测），此处仅作类型适配转发。
 */
export function derivePeriodStatsFromDaily(
  rows: DateWordsRow[],
): Pick<PeriodCore, "totalWords" | "activeDays" | "maxWordsDay" | "longestStreak"> {
  return derivePeriodStatsCore(rows)
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

/**
 * 加载时段核心指标。
 * 原先为 6 项并行查询，其中 4 项重复扫描同一批段落行；
 * 现合并为「1 条按日聚合 + createdCount + 笔记本」3 项并行，其余指标由聚合结果派生。
 */
async function loadPeriodCore(startStr: string, endStr: string): Promise<PeriodCore> {
  const [dailyRows, createdRows, mostProductiveNotebook] = await Promise.all([
    executeSql<DateWordsRow>(`
      SELECT substr(created, 1, 8) as date, SUM(length) as words
      FROM blocks
      WHERE type = 'p' AND length > 0
        AND created >= '${startStr}' AND created <= '${endStr}'
      GROUP BY substr(created, 1, 8)
      ORDER BY date ASC
      LIMIT 1024
    `),
    executeSql<ScalarRow>(`
      SELECT COUNT(*) as cnt
      FROM blocks
      WHERE type = 'd'
        AND created >= '${startStr}' AND created <= '${endStr}'
    `),
    getMostProductiveNotebook(startStr, endStr),
  ])

  return {
    ...derivePeriodStatsFromDaily(dailyRows),
    totalNotesCreated: Number(createdRows[0]?.cnt || 0),
    mostProductiveNotebook,
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
        period: { kind: "year", year: reportYear },
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

      // 日均分母：当月（未过完）按已过天数，其余月份按整月天数。
      // 原实现恒用整月天数（lastDay），导致当月报告的日均被低估——
      // 实测 2026-10-16：整月 31 天 vs 已过 16 天，日均 1451 vs 2810（差 1.94 倍）。
      // 年度报告对「当年」已按已过天数计算，此处对齐同一口径。
      const isCurrentMonth = today.getFullYear() === reportYear && today.getMonth() + 1 === reportMonth
      const daysInPeriod = isCurrentMonth ? today.getDate() : lastDay

      return {
        period: { kind: "month", year: reportYear, month: reportMonth },
        totalWords: core.totalWords,
        totalNotesCreated: core.totalNotesCreated,
        avgDailyWords: daysInPeriod > 0 ? Math.round(core.totalWords / daysInPeriod) : 0,
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
      period: { kind: "year", year: reportYear },
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

    // 简单线性回归：y = mx + b（实现见 reportMath.linearFit）
    const ys = historical.map((h) => h.words)
    const {
      slope,
      intercept,
      rSquared,
    } = linearFit(ys)

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
    // 下月预计 = 未来 30 天逐日预测求和，与 weeklyProjection 口径一致（详见 reportMath.projectSum）
    const monthlyProjection = projectSum(slope, intercept, n, 30)

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
    periodA: a.period,
    periodB: b.period,
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
