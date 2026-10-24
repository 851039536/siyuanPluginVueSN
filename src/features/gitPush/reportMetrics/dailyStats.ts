// gitPush 报告指标引擎 — K 线日聚合层：每日提交统计 / 7 日均线 / 分桶压缩（纯函数）
import type { DailyCommitStat } from "../types/report"
import type { NumstatCommit } from "./types"
import { formatLocalDate } from "../utils/analysis"

/** 影线外扩量（小时）：实体上下各留 0.5h 形成 K 线影线视觉 */
const WICK_PAD_HOURS = 0.5

/**
 * 从 NumstatCommit[] 按日期聚合每日提交统计（单次 O(n) 遍历，输出按日期升序）。
 * 忽略无法解析的 ISO 时间戳条目；无有效提交时返回空数组。
 */
function aggregateDailyStats(commits: NumstatCommit[]): DailyCommitStat[] {
  const byDate = new Map<string, { open: number, close: number, count: number }>()
  for (const c of commits) {
    const t = Date.parse(c.date)
    if (Number.isNaN(t)) continue
    const d = new Date(t)
    // 本地日历日口径（与 weekday/streak 统计统一，避免提交时区与查看时区不一致导致跨日错位）
    const dateKey = formatLocalDate(d)
    const h = d.getHours() + d.getMinutes() / 60
    let agg = byDate.get(dateKey)
    if (!agg) {
      agg = { open: h, close: h, count: 0 }
      byDate.set(dateKey, agg)
    }
    if (h < agg.open) agg.open = h
    if (h > agg.close) agg.close = h
    agg.count++
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, a]) => ({
      date,
      open: a.open,
      close: a.close,
      // 影线钳位到 [0, 24] 时刻轴范围，避免凌晨/深夜提交时影线越界被 canvas 裁剪
      high: Math.min(24, Math.max(a.open, a.close) + WICK_PAD_HOURS),
      low: Math.max(0, Math.min(a.open, a.close) - WICK_PAD_HOURS),
      count: a.count,
    }))
}

/**
 * 计算每日提交量的 7 日滑动平均（供 K 线图叠加趋势折线）。
 * 对每个活跃日取含当日在内的前 7 个日历日为窗口，缺失日期按 0 计入后求均值（1 位小数）。
 * 输出长度与 daily 一致（每个活跃日一个值），无窗口内提交时值为 0。
 */
export function calcMovingAverage7(daily: DailyCommitStat[]): number[] {
  const byDate = new Map(daily.map((s) => [s.date, s.count]))
  return daily.map((s) => {
    // 本地日历日构造窗口起点：Date.parse("YYYY-MM-DD") 得到 UTC 午夜，
    // 在 UTC 负偏移时区经 formatLocalDate 会前移一天，导致均线窗口与日聚合键错位
    const [y, m, d] = s.date.split("-").map(Number)
    if (!y || !m || !d) return 0
    const cursor = new Date(y, m - 1, d)
    let sum = 0
    for (let offset = 0; offset < 7; offset++) {
      sum += byDate.get(formatLocalDate(cursor)) ?? 0
      cursor.setDate(cursor.getDate() - 1)
    }
    return Math.round((sum / 7) * 10) / 10
  })
}

/**
 * K 线根数上限（超出即分桶聚合）。
 * 依据：蜡烛最小占地 30px，180 根对应 5400px 画布宽，远低于浏览器 canvas 单维度上限（Chrome 65535px）
 * 与面积上限（约 2.68 亿 px）。不设上限时「全部」范围的 5 年仓库（约 1800 天）会生成 54000px 画布，
 * 触发分配失败导致图表白屏。
 */
export const MAX_CANDLES = 180

/**
 * 将每日提交统计按「连续天数」分桶压缩为不超过 maxCandles 根 K 线。
 *
 * 分桶而非抽样的原因：抽样会丢掉区间内的提交量，分桶保证总量守恒（count 求和），
 * 且桶宽固定使横轴时间间隔均匀可读。
 *
 * 合成规则：count 求和；open 取桶首日 open、close 取桶末日 close（保留活跃时间跨度的起止语义）；
 * high 取桶内 max、low 取桶内 min（影线覆盖桶内全部活跃范围）；date 取桶首日（tooltip 与 x 轴标签基准）。
 *
 * @param daily 按日期升序的每日统计
 * @param maxCandles 根数上限（默认 MAX_CANDLES；≤0 时不压缩）
 * @returns list 压缩后的统计（未超阈值时返回原数组引用）；bucketDays 每根 K 线代表的天数（1 表示未聚合）
 */
export function collapseDailyStats(
  daily: DailyCommitStat[],
  maxCandles: number = MAX_CANDLES,
): { list: DailyCommitStat[], bucketDays: number } {
  // 空数组/阈值非法：直接原样返回，bucketDays 取 1 表示「每根 = 1 天」
  if (daily.length === 0 || maxCandles <= 0 || daily.length <= maxCandles) {
    return { list: daily, bucketDays: 1 }
  }
  const bucketDays = Math.ceil(daily.length / maxCandles)
  const list: DailyCommitStat[] = []
  for (let i = 0; i < daily.length; i += bucketDays) {
    const bucket = daily.slice(i, i + bucketDays)
    const first = bucket[0]
    const last = bucket[bucket.length - 1]
    let count = 0
    let high = first.high
    let low = first.low
    for (const s of bucket) {
      count += s.count
      if (s.high > high) { high = s.high }
      if (s.low < low) { low = s.low }
    }
    list.push({ date: first.date, open: first.open, close: last.close, high, low, count })
  }
  return { list, bucketDays }
}

export { aggregateDailyStats }
