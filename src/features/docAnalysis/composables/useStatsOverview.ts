/**
 * 文档分析功能 - StatsOverview 视图计算逻辑（健康度/卡片值/柱状图比例/平台分布）
 */
import { computed } from "vue"
import type {
  DepthStats,
  DocStats,
  DuplicateNameGroup,
  StatCardDef,
} from "../types/index"
import { PLATFORM_META } from "./platformMeta"
import { WC_TOP_BIN_LABEL } from "../utils/docStatsAnalyzer"
import { filterDuplicateGroups } from "../utils"

/** useStatsOverview 入参（仅取计算逻辑需要的 props 字段） */
export interface UseStatsOverviewProps {
  stats: DocStats
  depthStats: DepthStats
  duplicateGroups: DuplicateNameGroup[]
  duplicateNameFilter: string[]
}

/**
 * StatsOverview 视图计算 composable（须在组件 setup 中调用，内部 computed 随组件响应式更新）
 */
export function useStatsOverview(props: UseStatsOverviewProps) {
  // ============================================================
  // 重名过滤
  // ============================================================

  const effectiveDupGroups = computed(() =>
    filterDuplicateGroups(props.duplicateGroups, props.duplicateNameFilter),
  )

  const effectiveDupDocs = computed(() =>
    effectiveDupGroups.value.reduce((sum, g) => sum + g.count, 0),
  )

  const effectiveDupGroupCount = computed(() =>
    effectiveDupGroups.value.length,
  )

  // ============================================================
  // 健康度
  // ============================================================

  const _healthBreakdown = computed(() => {
    const s = props.stats
    const total = s.totalDocs
    const excessDupes = Math.max(0, effectiveDupDocs.value - effectiveDupGroupCount.value)
    const noBmExclude0B = Math.max(0, s.noBookmarkDocs - s.zeroByteDocs)
    const depthGt7 = props.depthStats.depthDistribution
      .filter((d) => d.depth > 7)
      .reduce((sum, d) => sum + d.count, 0)
    const wcGt20000 = s.wordCountDistribution
      .filter((d) => d.label === WC_TOP_BIN_LABEL)
      .reduce((sum, d) => sum + d.count, 0)
    const issues = s.zeroByteDocs
      + excessDupes
      + s.unusedDocs
      + noBmExclude0B
      + s.partialPublishDocs
      + depthGt7
      + wcGt20000
    return { total, excessDupes, noBmExclude0B, depthGt7, wcGt20000, issues }
  })

  const healthPct = computed(() => {
    const { total, issues } = _healthBreakdown.value
    if (!total) return 100
    return Math.round(((total - Math.min(total, issues)) / total) * 100)
  })

  const healthTooltip = computed(() => {
    const {
      total,
      excessDupes,
      noBmExclude0B,
      depthGt7,
      wcGt20000,
      issues,
    } = _healthBreakdown.value
    if (!total) return "暂无数据"
    const healthy = Math.max(0, total - Math.min(total, issues))
    return [
      `健康文档 ${healthy} / ${total}（同一文档可能有多类问题，故百分比可能偏低）`,
      `扣分项:`,
      `  0B空 ${props.stats.zeroByteDocs}`,
      `  重名超出 ${excessDupes}`,
      `  不使用 ${props.stats.unusedDocs}`,
      `  无书签(排除0B) ${noBmExclude0B}`,
      `  部分发布 ${props.stats.partialPublishDocs}`,
      `  深度>7 ${depthGt7}`,
      `  字数>2万 ${wcGt20000}`,
    ].join("\n")
  })

  const hasIssues = computed(() =>
    props.stats.zeroByteDocs > 0 || effectiveDupDocs.value > 0
    || props.stats.pendingPublishDocs > 0 || props.stats.orphanDocs > 0,
  )

  // ============================================================
  // 卡片值计算
  // ============================================================

  function getCardValue(card: StatCardDef): number {
    if (card.id === "duplicate") return effectiveDupDocs.value
    if (card.resolveValue) return card.resolveValue(props.stats)
    return (props.stats[card.statKey] as number) || 0
  }

  function cardLabel(card: StatCardDef): string {
    if (card.id === "duplicate") return `重名(${effectiveDupGroupCount.value}组)`
    if (card.suffixStatKey) return `${card.shortLabel}(${props.stats[card.suffixStatKey]})`
    return card.shortLabel
  }

  /** 按 hideZero 开关过滤可见卡片（概览分区与质量 Tab 共用） */
  function filterVisibleCards(cards: StatCardDef[], hideZero: boolean): StatCardDef[] {
    if (!hideZero) return cards
    return cards.filter((c) => getCardValue(c) > 0)
  }

  /** 卡片底部占比条（字符串百分比，供 StatCard 的 width 直接使用） */
  function pctStr(count: number): string {
    if (!props.stats.totalDocs) return "0%"
    return `${Math.min(100, Math.round((count / props.stats.totalDocs) * 100))}%`
  }

  // ============================================================
  // 横向柱状图（平台/字数/书签/深度）共用比例计算
  // ============================================================

  /** 数据集最大计数（空集兜底为 1，避免除零） */
  function maxCount(items: { count: number }[]): number {
    return Math.max(...items.map((i) => i.count), 1)
  }

  /** 相对最大值的百分比（BarRow 直接使用数值宽度） */
  function barPct(max: number, count: number): number {
    return Math.round((count / max) * 100)
  }

  // ============================================================
  // 平台分布
  // ============================================================

  const platformEntries = computed(() => {
    const counts = props.stats.platformCounts
    const entries = Object.entries(counts)
      .map(([id, count]) => {
        const meta = PLATFORM_META.value.find((p) => p.id === id)
        return { id, name: meta?.name || id, count }
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
    const max = maxCount(entries)
    return entries.map((e) => ({ ...e, pct: barPct(max, e.count) }))
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

  // ============================================================
  // 字数分布 / 书签分类 / 深度分布柱状图
  // ============================================================

  const maxWordCount = computed(() => maxCount(props.stats.wordCountDistribution))

  const maxCustomBm = computed(() => maxCount(props.stats.customBookmarkTop))

  const maxDepthCount = computed(() => maxCount(props.depthStats.depthDistribution))

  return {
    effectiveDupGroups, effectiveDupDocs, effectiveDupGroupCount,
    healthPct, healthTooltip, hasIssues,
    getCardValue, cardLabel, filterVisibleCards, pctStr,
    maxCount, barPct,
    platformEntries, docsInSystem, avgPlatformsPerDoc, coveragePct,
    maxWordCount, maxCustomBm, maxDepthCount,
  }
}
