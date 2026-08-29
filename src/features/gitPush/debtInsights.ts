// gitPush 技术债务洞察纯函数模块：趋势推断 + 近期共变耦合 + 严重度汇总（无 Vue 响应式，与 reportMetrics 同层）
//
// 数据来源说明（透明标注启发式边界）：
// - 趋势为"单快照推断"：复用 recencyBonus 的 7d/30d 阈值语义，从 lastModified 距今天数 + 修改次数派生方向，
//   而非真正的双周期对比（CodeScene 趋势分析需跨周期快照，当前 CodeReportData 仅含本周期聚合）
// - 耦合为"近期共变"代理信号：lastModified 日期相同的债务文件聚类（同日修改≈同批提交），
//   非完整 commit 级共现矩阵，UI 文案已标注为启发式推断
import type { DebtFileRow, DebtSeverity } from "./types"
import { DEBT_SEVERITY_ORDER } from "./types"

// ── 趋势推断 ──

/** 趋势方向（由 lastModified 距今天数 + 修改次数派生） */
export type DebtTrend = "rising" | "steady" | "settling" | "calm"

/** 趋势元数据（labelKey 驱动 i18n，color 驱动徽章着色，arrow 为方向箭头字符） */
export const DEBT_TREND_META: Record<DebtTrend, { labelKey: string, color: string, arrow: string }> = {
  rising: { labelKey: "reportDebtTrendRising", color: "#ef4444", arrow: "↑" },
  steady: { labelKey: "reportDebtTrendSteady", color: "#f59e0b", arrow: "→" },
  settling: { labelKey: "reportDebtTrendSettling", color: "#3b82f6", arrow: "→" },
  calm: { labelKey: "reportDebtTrendCalm", color: "#10b981", arrow: "↓" },
}

/** 判定"活跃恶化"的修改次数门槛（近 7 天内改动 ≥ 该次数视为频繁改动） */
const RISING_MOD_THRESHOLD = 3

/** 距今天数（ISO 不可解析返回 Infinity，便于落入 calm 分支） */
function daysSince(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / (24 * 60 * 60 * 1000)
}

/**
 * 趋势推断：单快照从 lastModified 距今天数 + 修改次数派生方向。
 * 复用 recencyBonus 阈值语义：近 7 天频繁改动 → 活跃恶化；近 30 天 → 持续活跃；
 * 31-90 天 → 趋于稳定；更久（或无日期）→ 可能改善。
 */
export function inferDebtTrend(row: Pick<DebtFileRow, "lastModified" | "modCount">): DebtTrend {
  const days = daysSince(row.lastModified)
  if (days <= 7 && row.modCount >= RISING_MOD_THRESHOLD) return "rising"
  if (days <= 30) return "steady"
  if (days <= 90) return "settling"
  return "calm"
}

// ── 近期共变耦合 ──

/** 近期共变文件信息（与某文件 lastModified 日期相同的债务文件；DebtFileRow 的展示投影） */
export type CoupledFile = Pick<DebtFileRow, "path" | "modCount" | "riskScore" | "severity">

/** 关联日期键：取 ISO 日期部分（YYYY-MM-DD），空串统一为无效键 */
function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * 建立按 lastModified 日期聚类的共变索引（O(n) 单次遍历，取代逐文件 filter+sort 的 O(n² log n) 预计算）。
 * get(path) 按需取该文件的近期共变列表（同日期聚类、排除自身、按修改次数降序），无共变返回空数组。
 */
export function createCoupledIndex(files: DebtFileRow[]): { get(path: string): CoupledFile[] } {
  const byDate = new Map<string, DebtFileRow[]>()
  for (const f of files) {
    const key = dateKey(f.lastModified)
    if (!key) continue
    const list = byDate.get(key)
    if (list) list.push(f)
    else byDate.set(key, [f])
  }
  const byPath = new Map(files.map((f) => [f.path, f]))
  return {
    get(path: string): CoupledFile[] {
      const self = byPath.get(path)
      if (!self) return []
      const peers = (byDate.get(dateKey(self.lastModified)) ?? [])
        .filter((p) => p.path !== path)
        .sort((a, b) => b.modCount - a.modCount)
      return peers.map((p) => ({ path: p.path, modCount: p.modCount, riskScore: p.riskScore, severity: p.severity }))
    },
  }
}

// ── 严重度汇总 ──

/**
 * 严重度分布条目（汇总条数据源；pct 为四舍五入整数百分比）。
 * 与 HotspotLevelSummary 结构同构但语义域不同（严重度分布 vs 热度等级分布），
 * 各自仅一处使用，按 Rule of Three 保留独立定义。
 */
export interface SeverityDistItem {
  severity: DebtSeverity
  /** 该严重度文件数 */
  count: number
  /** 占比（0~100） */
  pct: number
}

/** 严重度分布：仅含 count>0 的条目，按 DEBT_SEVERITY_ORDER 顺序；空列表返回空数组 */
export function buildSeverityDist(files: DebtFileRow[]): SeverityDistItem[] {
  const total = files.length
  if (total === 0) return []
  return DEBT_SEVERITY_ORDER
    .map((sev) => {
      const count = files.filter((f) => f.severity === sev).length
      return { severity: sev, count, pct: Math.round((count / total) * 100) }
    })
    .filter((d) => d.count > 0)
}

/** 优先治理清单：按风险评分降序取前 N（默认 3；N≤0 返回空数组） */
export function buildTopDebts(files: DebtFileRow[], limit = 3): DebtFileRow[] {
  if (limit <= 0) return []
  return [...files].sort((a, b) => b.riskScore - a.riskScore).slice(0, limit)
}
