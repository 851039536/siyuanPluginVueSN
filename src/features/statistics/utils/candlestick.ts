// K 线数据计算：历史快照 → OHLC 蜡烛（优先日内采样，缺失时日增量近似）+ 收盘 7 日均线 + 快照采样合并
import type { HistoricalDataItem } from "../types"
import type { KLineMetric, OhlcSample } from "../types/storage"

/** K 线支持的指标清单（累计型指标，与 storage 的 KLineMetric 保持一致） */
export const KLINE_METRICS: KLineMetric[] = ["totalWords", "totalNotes"]

/** K 线最大根数：超过时仅取最近 N 天（画布宽度随根数线性增长） */
export const STAT_MAX_CANDLES = 180

/** 无采样近似时的影线外扩比例（相对实体跨度） */
const APPROX_SPREAD_RATIO = 0.15

/** 无采样近似时的影线最小外扩量（数值为 0 时保证影线可见） */
const APPROX_SPREAD_MIN = 1

/** 单根蜡烛数据 */
export interface StatCandle {
  date: string
  dateLabel: string
  open: number
  high: number
  low: number
  close: number
  /** 相对前日收盘的涨跌方向（首日记平） */
  direction: "up" | "down" | "flat"
  /** true = 无日内采样、由日增量近似而来（tooltip 中追加提示） */
  approx: boolean
}

/**
 * 快照写入时合并日内采样：
 * 已有采样 → open 保持首次值、high/low 外扩包络当前值；
 * 无采样 → 三者均取当前值。一天内多次刷新自然形成采样序列。
 */
export function mergeOhlcSamples(
  prev: Partial<Record<KLineMetric, OhlcSample>> | undefined,
  current: Record<KLineMetric, number>,
): Partial<Record<KLineMetric, OhlcSample>> {
  const result: Partial<Record<KLineMetric, OhlcSample>> = {}
  for (const metric of KLINE_METRICS) {
    const value = current[metric]
    const sample = prev?.[metric]
    result[metric] = sample
      ? {
          open: sample.open,
          high: Math.max(sample.high, value),
          low: Math.min(sample.low, value),
        }
      : { open: value, high: value, low: value }
  }
  return result
}

/**
 * 历史快照 → 蜡烛序列（升序，最多保留最近 STAT_MAX_CANDLES 天）：
 * 有日内采样时优先使用（校正 high/low 保证包络 open/close）；
 * 缺失采样（旧数据/补缺日）时以「前日收盘为开盘」近似，影线按实体跨度固定比例外扩。
 * 上游 historicalData 为降序（最新在前），此处先按日期升序归一，不依赖输入顺序。
 */
export function buildStatCandles(items: HistoricalDataItem[], metric: KLineMetric): StatCandle[] {
  const ascending = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const source = ascending.length > STAT_MAX_CANDLES
    ? ascending.slice(ascending.length - STAT_MAX_CANDLES)
    : ascending
  const candles: StatCandle[] = []
  source.forEach((item, idx) => {
    const close = Number(item[metric] ?? 0)
    const prevClose = idx > 0 ? Number(source[idx - 1][metric] ?? 0) : null
    const sample = item.ohlc?.[metric]
    let open: number
    let high: number
    let low: number
    let approx = false
    if (sample) {
      open = sample.open
      high = Math.max(sample.high, open, close)
      low = Math.min(sample.low, open, close)
    } else {
      approx = true
      open = prevClose ?? close
      const spread = Math.max(Math.abs(close - open) * APPROX_SPREAD_RATIO, APPROX_SPREAD_MIN)
      high = Math.max(open, close) + spread
      low = Math.min(open, close) - spread
    }
    low = Math.max(0, low)
    const direction = prevClose === null || close === prevClose
      ? "flat"
      : close > prevClose ? "up" : "down"
    candles.push({
      date: item.date,
      dateLabel: item.dateLabel,
      open,
      high,
      low,
      close,
      direction,
      approx,
    })
  })
  return candles
}

/** 收盘价 7 日均线（窗口含当日；前 6 日返回 null，配合 spanGaps 跳过） */
export function calcCloseMa7(candles: StatCandle[]): (number | null)[] {
  return candles.map((_, i) => {
    if (i < 6) return null
    let sum = 0
    for (let j = i - 6; j <= i; j++) sum += candles[j].close
    return Math.round(sum / 7)
  })
}
