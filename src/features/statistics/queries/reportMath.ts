// 报告纯计算逻辑：与思源 API 解耦，便于离线单元测试
//
// 背景：reportStats.ts 依赖 executeSql（进而依赖运行时 `siyuan` 包，其 exports 字段
// 在 Vitest 的 node 条件下不可解析）。故把不含 IO 的派生逻辑抽到本模块：
// 既让测试可直接导入，也把「公式」与「取数」分层。
import {
  parseYmd,
  toDashedYmd,
} from "../utils"

/**
 * 按日聚合行（与 SQL 的 `substr(created,1,8) as date, SUM(length) as words` 对齐）。
 * 只约束本模块真正读取的字段；调用方传入更宽的行类型（如 DateWordsRow 带 created）
 * 也可直接兼容。
 */
export interface DailyWordsRow {
  date: string
  words?: number
}

/** 时段核心指标中的派生部分 */
export interface DerivedPeriodStats {
  totalWords: number
  activeDays: number
  maxWordsDay: { date: string, words: number }
  longestStreak: number
}

/** 由日期序列求最长连续段（相邻日相差恰好 1 天，跨月/跨年/闰日均视为连续） */
export function longestStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort()
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
}

/**
 * 由「按日聚合」结果派生时段核心指标。
 *
 * 原实现对同一批 `type='p' AND length>0` 行扫描 4 次（SUM / COUNT DISTINCT / GROUP BY / DISTINCT），
 * 每次都要重建临时 B 树。现改为一次 GROUP BY 取回（日期, 字数），其余指标在此派生：
 * - totalWords    = Σ words
 * - activeDays    = 行数（GROUP BY 日期后每行即一个活跃日）
 * - maxWordsDay   = 取 words 最大行
 * - longestStreak = 对日期序列求最长连续段
 * 实测（33 万块真实库）并行 4 条 1234ms → 单条 688ms，且 6 组用例结果逐字段一致。
 *
 * 前提：入参必须已按日期去重（SQL 侧 GROUP BY 保证）。若上游改为不清洗的明细行，
 * activeDays 会因重复日而多计——故此处对连续段做了 Set 去重，对 activeDays 不做补偿。
 */
export function derivePeriodStatsFromDaily(rows: DailyWordsRow[]): DerivedPeriodStats {
  if (!rows || rows.length === 0) {
    return {
      totalWords: 0,
      activeDays: 0,
      maxWordsDay: {
        date: "",
        words: 0,
      },
      longestStreak: 0,
    }
  }

  let totalWords = 0
  let maxRow: DailyWordsRow | null = null
  const dates: string[] = []

  for (const row of rows) {
    const words = Number(row.words || 0)
    totalWords += words
    if (!maxRow || words > Number(maxRow.words || 0)) maxRow = row
    dates.push(String(row.date))
  }

  return {
    totalWords,
    activeDays: rows.length,
    maxWordsDay: {
      date: toDashedYmd(String(maxRow!.date)),
      words: Number(maxRow!.words || 0),
    },
    longestStreak: longestStreakFromDates(dates),
  }
}

/**
 * 未来 days 天的字数预测总和（逐日累加，与 weeklyProjection 口径一致）。
 *
 * 修复说明：原实现为 `(slope*(n+30)+intercept)*30`——取「第 n+30 天」这**一天**的预测值
 * 再乘 30，相当于假设未来每天都写到第 30 天的水平；上升趋势下显著高估
 * （真实库实测 222,049 vs 正确的 170,339，高估 30%）。且原式用 `slope > 0 ?` 分支，
 * 下降趋势时改走 `meanY*30`，导致同一指标在涨/跌时用两套算法。现统一为逐日累加。
 */
export function projectSum(
  slope: number,
  intercept: number,
  n: number,
  days: number,
): number {
  let sum = 0
  for (let i = 0; i < days; i++) {
    sum += Math.max(0, slope * (n + i) + intercept)
  }
  return Math.round(sum)
}

/** 线性回归结果 */
export interface LinearFit {
  slope: number
  intercept: number
  rSquared: number
}

/** 最小二乘线性拟合（x 为 0..n-1 的序号），用于趋势预测 */
export function linearFit(ys: number[]): LinearFit {
  const n = ys.length
  if (n < 2) {
    return {
      slope: 0,
      intercept: n === 1 ? ys[0] : 0,
      rSquared: 0,
    }
  }

  const meanX = (n - 1) / 2
  const meanY = ys.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    const dx = i - meanX
    numerator += dx * (ys[i] - meanY)
    denominator += dx * dx
  }

  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = meanY - slope * meanX

  const ssRes = ys.reduce((sum, y, i) => sum + (y - (slope * i + intercept)) ** 2, 0)
  const ssTot = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0)
  const rSquared = ssTot !== 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0

  return {
    slope,
    intercept,
    rSquared,
  }
}
