/**
 * 文档分析功能 - StatsOverview 视图计算逻辑（健康度/卡片值/表格行/平台分布）
 */
import { computed } from "vue"
import type {
  CardValueContext,
  DepthStats,
  DocStats,
  DuplicateNameGroup,
  StatCardDef,
  StatTableRow,
} from "../types/index"
import { PLATFORM_META } from "./platformMeta"
import { WC_TOP_BIN_LABEL } from "../utils/docStatsAnalyzer"

/** useStatsOverview 入参（仅取计算逻辑需要的 props 字段） */
export interface UseStatsOverviewProps {
  stats: DocStats
  depthStats: DepthStats
  /** 过滤后的重名组（由 useDocStats 的 effectiveDuplicateGroups 提供，过滤逻辑唯一出处） */
  effectiveDuplicateGroups: DuplicateNameGroup[]
}

/**
 * StatsOverview 视图计算 composable（须在组件 setup 中调用，内部 computed 随组件响应式更新）
 */
export function useStatsOverview(props: UseStatsOverviewProps) {
  // ============================================================
  // 重名统计（消费 useDocStats 的 effectiveDuplicateGroups 过滤结果）
  // ============================================================

  const effectiveDupGroups = computed(() => props.effectiveDuplicateGroups)

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

  /** 卡片计算上下文（resolveValue/suffixValue 动态取值） */
  const valueCtx = computed<CardValueContext>(() => ({
    effectiveDupDocs: effectiveDupDocs.value,
    effectiveDupGroupCount: effectiveDupGroupCount.value,
  }))

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
    effectiveDupGroups, effectiveDupDocs, effectiveDupGroupCount,
    healthPct, healthTooltip, hasIssues,
    getCardValue, cardLabel, pctStr, toCardRows,
    platformEntries, docsInSystem, avgPlatformsPerDoc, coveragePct,
  }
}
