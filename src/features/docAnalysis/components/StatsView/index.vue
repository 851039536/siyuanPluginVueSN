<!-- 文档统计概览组件 - 表格化 2 列布局（Hero 汇总 + 各分区统计表格） -->
<template>
  <div class="stats-overview">
    <template v-if="hasAnalyzed">
      <!-- Hero 汇总卡：总文档 + 健康度（问题详情见下方各统计表格） -->
      <HeroCard
        :stats="stats"
        :health-pct="healthPct"
        :health-tooltip="healthTooltip"
      />

      <!-- 统计表格区块：2 列网格布局 -->
      <div class="stats-grid">
        <!-- 卡片类表格（大小/时间/书签/发布，元数据驱动；书签分区追加动态书签值行，发布分区追加平台分布行） -->
        <StatTable
          v-for="section in statSections"
          :key="section.key"
          :title="section.title"
          :icon="section.icon"
          :rows="filterZeroRows(cardRowsMap[section.key])"
          :active-id="activeFilter"
          @select="(id) => handleRowSelect(section.key, id)"
        >
          <template #headerExtra>
            <span
              v-if="section.key === 'publish'"
              class="section-hint"
            >人均 {{ avgPlatformsPerDoc }} 平台 · 覆盖率 {{ coveragePct }}%</span>
          </template>
        </StatTable>

        <!-- 文档质量表 -->
        <StatTable
          title="文档质量"
          icon="mdi:clipboard-check-outline"
          :rows="filterZeroRows(qualityRows)"
          :active-id="activeFilter"
          @select="(id) => $emit('selectCategory', id)"
        />

        <!-- 字数分布表 -->
        <StatTable
          v-if="stats.wordCountDistribution.length > 0"
          title="字数分布"
          icon="mdi:text-short"
          :rows="filterZeroRows(wordCountRows)"
        />

        <!-- 深度分布表 -->
        <StatTable
          v-if="depthStats.depthDistribution.length > 0"
          title="深度分布"
          icon="mdi:chart-bar"
          :rows="filterZeroRows(depthRows)"
          @select="(id) => $emit('selectDepth', Number(id))"
        >
          <template #headerExtra>
            <span class="section-hint">均 {{ depthStats.avgDepth }} 层 · 最深 {{ depthStats.maxDepth }} 层</span>
          </template>
        </StatTable>

      </div>
    </template>

    <div
      v-else
      class="stats-placeholder"
    >
      <Icon
        icon="mdi:chart-box-outline"
        class="placeholder-icon"
      />
      <p>点击「分析」查看文档统计</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  DepthStats,
  DocStats,
  DuplicateNameGroup,
  ExtraRowKind,
  HealthSettings,
  StatSectionDef,
  StatTableRow,
} from "../../types/index"
import { QUALITY_CARDS, STAT_SECTIONS } from "../../types/index"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { useStatsOverview } from "../../composables/useStatsOverview"
import HeroCard from "./HeroCard.vue"
import StatTable from "./StatTable.vue"

interface Props {
  stats: DocStats
  hasAnalyzed: boolean
  activeFilter: string
  depthStats: DepthStats
  effectiveDuplicateGroups: DuplicateNameGroup[]
  healthSettings: HealthSettings
  /** 是否隐藏零值行（设置弹窗持久化，父级传入） */
  hideZero: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "selectCategory", category: string): void
  (e: "selectBookmark", bookmark: string): void
  (e: "selectPlatform", platformId: string): void
  (e: "selectDepth", depth: number): void
}>()

const statSections = STAT_SECTIONS as readonly StatSectionDef[]

/** 统计视图计算逻辑（健康度/卡片值/占比/平台分布） */
const {
  healthPct,
  healthTooltip,
  pctStr,
  toCardRows,
  platformEntries,
  avgPlatformsPerDoc,
  coveragePct,
} = useStatsOverview(props)

/** 书签分布表格行（动态统计，点击下钻该书签文档） */
const bookmarkRows = computed<StatTableRow[]>(() =>
  props.stats.bookmarkDistribution.map((item) => ({
    id: item.value,
    label: item.value || "(空值)",
    count: item.count,
    pct: pctStr(item.count),
    clickable: true,
  })),
)

/** 卡片分区表格行映射（按分区 key 缓存；声明 extraRows 的分区在汇总卡片行后追加动态分布行） */
const cardRowsMap = computed<Record<string, StatTableRow[]>>(() => {
  const map: Record<string, StatTableRow[]> = {}
  for (const section of statSections) {
    const rows = toCardRows(section.cards)
    map[section.key] = section.extraRows ? [...rows, ...EXTRA_ROW_SOURCES[section.extraRows]()] : rows
  }
  return map
})

/** 文档质量表格行 */
const qualityRows = computed(() => toCardRows(QUALITY_CARDS))

/** 平台分布表格行（点击下钻查看该平台已发布文档） */
const platformRows = computed<StatTableRow[]>(() =>
  platformEntries.value.map((e) => ({
    id: e.id,
    label: e.name,
    count: e.count,
    pct: pctStr(e.count),
    clickable: true,
  })),
)

/** 分区动态追加行来源注册表（extraRows 元数据 → 行生成器） */
const EXTRA_ROW_SOURCES: Record<ExtraRowKind, () => StatTableRow[]> = {
  bookmarkDistribution: () => bookmarkRows.value,
  platformDistribution: () => platformRows.value,
}

/** 分区追加行点击下钻事件注册表（extraRows 元数据 → emit 分发） */
const EXTRA_SELECT_DISPATCH: Record<ExtraRowKind, (id: string) => void> = {
  bookmarkDistribution: (id) => emit("selectBookmark", id),
  platformDistribution: (id) => emit("selectPlatform", id),
}

/** 字数分布表格行（不可下钻） */
const wordCountRows = computed<StatTableRow[]>(() =>
  props.stats.wordCountDistribution.map((item) => ({
    id: item.label,
    label: item.label,
    count: item.count,
    pct: pctStr(item.count),
  })),
)

/** 深度分布表格行（可下钻） */
const depthRows = computed<StatTableRow[]>(() =>
  props.depthStats.depthDistribution.map((item) => ({
    id: String(item.depth),
    label: String(item.depth),
    count: item.count,
    pct: pctStr(item.count),
    clickable: true,
  })),
)

/** 表格行点击分流：分区汇总卡片行走 selectCategory，声明 extraRows 的追加行走对应专属下钻事件（id 全部由 STAT_SECTIONS 元数据推导，无硬编码） */
function handleRowSelect(sectionKey: string, id: string) {
  const section = statSections.find((s) => s.key === sectionKey)
  const summaryIds = new Set((section?.cards ?? []).map((c) => c.id))
  if (summaryIds.has(id)) {
    emit("selectCategory", id)
    return
  }
  if (section?.extraRows) {
    EXTRA_SELECT_DISPATCH[section.extraRows](id)
    return
  }
  emit("selectCategory", id)
}

/** 隐藏零值行过滤（开关来自设置弹窗持久化） */
function filterZeroRows(rows: StatTableRow[]): StatTableRow[] {
  return props.hideZero ? rows.filter((r) => r.count > 0) : rows
}
</script>

<style lang="scss" scoped>
@use "../../styles/StatsOverview.scss";
</style>
