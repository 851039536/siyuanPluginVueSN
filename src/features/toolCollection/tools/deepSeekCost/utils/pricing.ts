/**
 * DeepSeek 成本计算 - 价格常量与纯计算函数
 * 数据来源：DeepSeek 官方定价页（2026-08 更新，以官网为准）
 */

/** 模型价格配置（元 / 百万 tokens） */
export interface ModelPrice {
  /** 模型唯一标识 */
  id: string
  /** 模型名称 */
  name: string
  /** 输入（缓存命中）单价，元/百万 tokens */
  cacheHit: number
  /** 输入（缓存未命中）单价，元/百万 tokens */
  cacheMiss: number
  /** 输出单价，元/百万 tokens */
  output: number
}

/** DeepSeek 模型价格表 */
export const DEEPSEEK_PRICES: ModelPrice[] = [
  {
    id: "flash",
    name: "deepseek-v4-flash",
    cacheHit: 0.02,
    cacheMiss: 1,
    output: 2,
  },
  {
    id: "pro",
    name: "deepseek-v4-pro",
    cacheHit: 0.025,
    cacheMiss: 3,
    output: 6,
  },
]

/** 高峰时段价格倍率 */
export const PEAK_MULTIPLIER = 2

/** 高峰时段（北京时间）：9:00-12:00、14:00-18:00 */
const PEAK_RANGES: Array<{ start: number; end: number }> = [
  { start: 9, end: 12 },
  { start: 14, end: 18 },
]

/** 判断给定时间是否处于高峰时段 */
export function isPeakHour(date: Date): boolean {
  const hour = date.getHours()
  return PEAK_RANGES.some((r) => hour >= r.start && hour < r.end)
}

/** 成本计算结果 */
export interface CostBreakdown {
  /** 命中缓存输入费用 */
  cacheHitCost: number
  /** 未命中缓存输入费用 */
  cacheMissCost: number
  /** 输出费用 */
  outputCost: number
  /** 总费用 */
  total: number
  /** 输入缓存命中率 0~1 */
  hitRate: number
  /** 相比全部未命中可节省金额 */
  saved: number
}

/**
 * 计算模型调用成本
 * @param cacheHitTokens 命中缓存输入 token 数
 * @param cacheMissTokens 未命中缓存输入 token 数
 * @param outputTokens 输出 token 数
 * @param price 模型价格
 * @param peak 是否高峰时段
 */
export function calcCost(
  cacheHitTokens: number,
  cacheMissTokens: number,
  outputTokens: number,
  price: ModelPrice,
  peak: boolean,
): CostBreakdown {
  const mult = peak ? PEAK_MULTIPLIER : 1
  const cacheHitCost = (cacheHitTokens / 1_000_000) * price.cacheHit * mult
  const cacheMissCost = (cacheMissTokens / 1_000_000) * price.cacheMiss * mult
  const outputCost = (outputTokens / 1_000_000) * price.output * mult
  const inputTokens = cacheHitTokens + cacheMissTokens
  const hitRate = inputTokens > 0 ? cacheHitTokens / inputTokens : 0
  // 节省 = 命中部分按「未命中价 - 命中价」的差额
  const saved = (cacheHitTokens / 1_000_000) * (price.cacheMiss - price.cacheHit) * mult
  return {
    cacheHitCost,
    cacheMissCost,
    outputCost,
    total: cacheHitCost + cacheMissCost + outputCost,
    hitRate,
    saved,
  }
}

/** 格式化金额：<0.01 保留 4 位，否则保留 2 位，去掉无意义尾零 */
export function formatCost(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (Math.abs(value) < 0.01) {
    return value
      .toFixed(4)
      .replace(/0+$/, "")
      .replace(/\.$/, "")
  }
  return value
    .toFixed(2)
    .replace(/0+$/, "")
    .replace(/\.$/, "")
}

/** 格式化 token 数（千分位） */
export function formatTokens(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

/** 格式化百分比 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}
