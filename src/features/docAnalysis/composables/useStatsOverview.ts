/**
 * 文档分析功能 - StatsOverview 视图计算逻辑（健康度/卡片值/表格行/平台分布）
 */
import { computed } from "vue"
import type {
  CardValueContext,
  DeductionKey,
  DeductionRow,
  DepthStats,
  DocStats,
  DuplicateNameGroup,
  HealthSettings,
  StatCardDef,
  StatTableRow,
} from "../types/index"
import { DEDUCTION_OPTIONS } from "../types/index"
import { PLATFORM_META } from "./platformMeta"

/** useStatsOverview 入参（仅取计算逻辑需要的 props 字段） */
export interface UseStatsOverviewProps {
  stats: DocStats
  depthStats: DepthStats
  /** 过滤后的重名组（由 useDocStats 的 effectiveDuplicateGroups 提供，过滤逻辑唯一出处） */
  effectiveDuplicateGroups: DuplicateNameGroup[]
  /** 健康度设置（启用的扣分项） */
  healthSettings: HealthSettings
}

/**
 * StatsOverview 视图计算 composable（须在组件 setup 中调用，内部 computed 随组件响应式更新）
 */
export function useStatsOverview(props: UseStatsOverviewProps) {
  // ============================================================
  // 重名统计（消费 useDocStats 的 effectiveDuplicateGroups 过滤结果）
  // ============================================================

  const effectiveDupDocs = computed(() =>
    props.effectiveDuplicateGroups.reduce((sum, g) => sum + g.count, 0),
  )

  const effectiveDupGroupCount = computed(() =>
    props.effectiveDuplicateGroups.length,
  )

  /** 卡片计算上下文（resolveValue/suffixValue/DEDUCTION_OPTIONS resolve 动态取值共用） */
  const valueCtx = computed<CardValueContext>(() => ({
    effectiveDupDocs: effectiveDupDocs.value,
    effectiveDupGroupCount: effectiveDupGroupCount.value,
  }))

  // ============================================================
  // 健康度
  // ============================================================

  const _healthBreakdown = computed(() => {
    const total = props.stats.totalDocs
    const enabled = new Set(props.healthSettings.enabledDeductions)
    const counts = new Map<DeductionKey, number>()
    let issues = 0
    for (const opt of DEDUCTION_OPTIONS) {
      const count = opt.resolve(props.stats, valueCtx.value, props.depthStats)
      counts.set(opt.key, count)
      if (enabled.has(opt.key)) issues += count
    }
    return { total, issues, counts }
  })

  const healthPct = computed(() => {
    const { total, issues } = _healthBreakdown.value
    if (!total) return 100
    return Math.round(((total - Math.min(total, issues)) / total) * 100)
  })

  const healthTooltip = computed(() => {
    const { total, issues, counts } = _healthBreakdown.value
    if (!total) return "暂无数据"
    const healthy = Math.max(0, total - Math.min(total, issues))
    const enabled = new Set(props.healthSettings.enabledDeductions)
    const lines = DEDUCTION_OPTIONS
      .filter((opt) => enabled.has(opt.key))
      .map((opt) => `  ${opt.label} ${counts.get(opt.key) ?? 0}`)
    return [
      `健康文档 ${healthy} / ${total}（同一文档可能有多类问题，故百分比可能偏低）`,
      `扣分项:`,
      ...lines,
    ].join("\n")
  })

  /** 各扣分项当前值明细（供 HeroCard 弹出面板渲染，禁用项也展示数值） */
  const deductionRows = computed<DeductionRow[]>(() => {
    const { counts } = _healthBreakdown.value
    const enabled = new Set(props.healthSettings.enabledDeductions)
    return DEDUCTION_OPTIONS.map((opt) => ({
      key: opt.key,
      label: opt.label,
      count: counts.get(opt.key) ?? 0,
      enabled: enabled.has(opt.key),
    }))
  })

  const hasIssues = computed(() =>
    props.stats.zeroByteDocs > 0 || effectiveDupDocs.value > 0
    || props.stats.orphanDocs > 0,
  )

  /** 健康文档数（总文档 - 启用扣分项合计，供 HeroCard 面板展示，与健康度百分比口径一致） */
  const healthyDocs = computed(() => {
    const { total, issues } = _healthBreakdown.value
    return Math.max(0, total - Math.min(total, issues))
  })

  // ============================================================
  // 卡片值计算
  // ============================================================

  function getCardValue(card: StatCardDef): number {
    if (card.resolveValue) return card.resolveValue(props.stats, valueCtx.value)
    return card.statKey ? ((props.stats[card.statKey] as number) || 0) : 0
  }

  function cardLabel(card: StatCardDef): string {
    if (card.suffixValue) return `${card.shortLabel}(${card.suffixValue(props.stats, valueCtx.value)})`
    if (card.suffixStatKey) return `${card.shortLabel}(${props.stats[card.suffixStatKey]})`
    return card.shortLabel
  }

  /** 数量占总文档数百分比（平台分布可超 100%，故不加 100 上限） */
  function pctStr(count: number): string {
    if (!props.stats.totalDocs) return "0%"
    return `${Math.round((count / props.stats.totalDocs) * 100)}%`
  }

  /** 将卡片元数据映射为表格行（label/count/pct/colorClass/clickable） */
  function toCardRows(cards: StatCardDef[]): StatTableRow[] {
    return cards.map((card) => {
      const count = getCardValue(card)
      return {
        id: card.id,
        label: cardLabel(card),
        count,
        pct: pctStr(count),
        colorClass: card.colorClass,
        clickable: true,
      }
    })
  }

  // ============================================================
  // 平台分布
  // ============================================================

  const platformEntries = computed(() => {
    const counts = props.stats.platformCounts
    return Object.entries(counts)
      .map(([id, count]) => {
        const meta = PLATFORM_META.value.find((p) => p.id === id)
        return { id, name: meta?.name || id, count }
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
  })

  const docsInSystem = computed(() =>
    props.stats.fullPublishDocs + props.stats.partialPublishDocs,
  )

  const avgPlatformsPerDoc = computed(() => {
    if (docsInSystem.value === 0) return "0"
    const total = Object.values(props.stats.platformCounts).reduce((a, b) => a + b, 0)
    return (total / docsInSystem.value).toFixed(1)
  })

  const coveragePct = computed(() => {
    if (!props.stats.totalDocs) return 0
    return Math.round((docsInSystem.value / props.stats.totalDocs) * 100)
  })

  return {
    effectiveDupDocs,
    healthPct, healthTooltip, hasIssues, deductionRows, healthyDocs,
    getCardValue, cardLabel, pctStr, toCardRows,
    platformEntries, docsInSystem, avgPlatformsPerDoc, coveragePct,
  }
}
