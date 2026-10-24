// gitPush 报告指标引擎 — 评分层：技术债务风险分 / 代码热点热度分（纯函数）
//
// 评分公式说明（确定性可复现，聚焦 churn 原始指标，思路参考 code-maat）：
// - 技术债务风险分 risk = clamp(sqrt(修改次数)*10 + 参与人数*6 + 近期修改加分)，sqrt 使 churn 边际收益递减避免高分区饱和；
//   仅统计修改 ≥门槛次（默认 3，可由偏好配置）的文件（低于门槛视为正常迭代）
// - 热度 heat = 修改次数*2.2 + 参与人数*7 + 近期修改加分（recencyBonus 与债务评分共用）；阈值 热点≥75 / 温热≥45 / 冷却≥25
import type { DebtSeverity, HotspotLevel } from "../types/report"
import { parseIsoMs } from "./parseNumstat"

/** 整数钳位到 [0, 100] */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** 债务门槛：修改次数低于该值的文件视为正常迭代，不构成技术债务（1-2 次提交是常态演进，参考 code-maat churn 阈值思路） */
export const DEBT_MIN_MOD_COUNT = 3

/**
 * ISO 时间距今天数（无法解析返回 -1）。
 * 作为「相对天数」口径的单一来源：recencyBonus 分档与本模块的索引覆盖范围判据
 * （sinceCoveredDays）共用，避免一处按天数、一处按日历月导致边界不一致。
 */
export function daysSince(iso: string): number {
  const ms = parseIsoMs(iso)
  if (ms <= 0) return -1
  return (Date.now() - ms) / (24 * 60 * 60 * 1000)
}

/**
 * 近期修改加分（3 天+8 / 7 天+5 / 30 天+2，仅对可解析的 ISO 时间生效）。
 * 供热度评分与技术债务评分共用：同一改动量，近期发生比久远发生更值得关注（债务"恶化趋势"信号）。
 */
function recencyBonus(lastModified: string): number {
  const diffDays = daysSince(lastModified)
  if (diffDays < 0) return 0
  if (diffDays <= 3) return 8
  if (diffDays <= 7) return 5
  if (diffDays <= 30) return 2
  return 0
}

/**
 * 风险评分（技术债务"评分"列）：sqrt(修改次数)*10 + 参与人数*6 + 近期修改加分，clamp 0~100。
 * sqrt 使 churn 边际收益递减，避免线性公式在活跃文件上过早饱和（modCount 25/40/100 仍可区分）。
 */
export function debtRiskScore(modCount: number, authorCount: number, lastModified: string): number {
  return clamp100(Math.sqrt(modCount) * 10 + authorCount * 6 + recencyBonus(lastModified))
}

/** 严重度分级（基于统一风险分分档）：≥50 严重 / ≥30 高 / ≥15 中 / 其余 低 */
export function debtSeverity(riskScore: number): DebtSeverity {
  if (riskScore >= 50) return "severe"
  if (riskScore >= 30) return "high"
  if (riskScore >= 15) return "medium"
  return "low"
}

/** 技术债务问题总数（严重度计数合计；面板 Tab 徽章与 TechDebtSection 表头徽章/空态共用，消除双份 reduce） */
export function countDebtFiles(debtSummary: Record<DebtSeverity, number>): number {
  return Object.values(debtSummary).reduce((sum, n) => sum + n, 0)
}

/** 严重度零值计数（buildReportData 与 buildEmptyReport 共用，消除双份手写对象） */
export function emptyDebtSummary(): Record<DebtSeverity, number> {
  return { severe: 0, high: 0, medium: 0, low: 0 }
}

// ── 代码热点 ──

/** 热点等级分档阈值（hot/warm/cool 三条分界线；cold 为低于 cool 线的余集） */
export interface HeatThresholds {
  /** 热点线（≥ 该热度为 hot） */
  hot: number
  /** 温热线 */
  warm: number
  /** 冷却线 */
  cool: number
}

/**
 * 固定阈值（样本不足/分位退化时的回退档）：≥75 热点 / ≥45 温热 / ≥25 冷却 / 其余冷门。
 * 与 utils.heatLevel 热力图 0~4 级同名不同义，故用 hotspotLevel 命名区分。
 */
export const FIXED_HEAT_THRESHOLDS: HeatThresholds = { hot: 75, warm: 45, cool: 25 }

/**
 * 按仓库内热度分布的分位数动态分桶（对齐 GitHub 贡献图"相对本仓库活跃度"的强度语义）。
 *
 * 固定阈值的问题：低活跃仓库永远到不了 hot、高活跃仓库几乎天天满级——等级失去区分度。
 * 分位方案：hot=P90 / warm=P70 / cool=P40（nearest-rank，对小样本稳健），
 * 使每档在任何仓库都保有合理稀疏度。
 *
 * 退化回退固定档：样本 <8 个（分位统计无意义）或阈值退化（相邻两线差 <1，即
 * 大量并列热度把分位挤到同一值）时，等级会塌成非此即彼，此时用 FIXED_HEAT_THRESHOLDS。
 */
export function quantileHeatThresholds(heats: number[]): HeatThresholds {
  if (heats.length < 8) return FIXED_HEAT_THRESHOLDS
  const sorted = [...heats].sort((a, b) => a - b)
  const nearestRank = (q: number): number => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]
  const hot = nearestRank(0.9)
  const warm = nearestRank(0.7)
  const cool = nearestRank(0.4)
  // 阈值退化判定：任一相邻两线差 <1 时等级无区分度（clamp100 后的整数热度易并列）
  if (hot - warm < 1 || warm - cool < 1) return FIXED_HEAT_THRESHOLDS
  return { hot, warm, cool }
}

/** 热点等级分级（阈值由调用方按分布求出后传入，见 quantileHeatThresholds） */
export function hotspotLevel(heat: number, thresholds: HeatThresholds = FIXED_HEAT_THRESHOLDS): HotspotLevel {
  if (heat >= thresholds.hot) return "hot"
  if (heat >= thresholds.warm) return "warm"
  if (heat >= thresholds.cool) return "cool"
  return "cold"
}

/** 热度评分：修改次数*2.2 + 参与人数*7 + 近期修改加分（recencyBonus 与债务评分共用），clamp 0~100 */
export function heatScore(modCount: number, authorCount: number, lastModified: string): number {
  return clamp100(modCount * 2.2 + authorCount * 7 + recencyBonus(lastModified))
}

/** 优化建议文案（按热点文件数占比阈值选择，返回键由调用方取 i18n） */
export function suggestionKey(hotPct: number, warmPct: number): "reportSugNormal" | "reportSugAttention" | "reportSugWarning" {
  if (hotPct >= 10) return "reportSugWarning"
  if (hotPct > 0 || warmPct >= 20) return "reportSugAttention"
  return "reportSugNormal"
}
