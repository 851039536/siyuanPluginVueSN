<!-- 文档统计概览组件 - 表格化 2 列布局（Hero 汇总 + 九个表格区块） -->
<template>
  <div class="stats-overview">
    <template v-if="hasAnalyzed">
      <!-- Hero 汇总卡：总文档 + 健康度 + 问题速览（健康度配置已在设置弹窗） -->
      <HeroCard
        :stats="stats"
        :health-pct="healthPct"
        :health-tooltip="healthTooltip"
        :has-issues="hasIssues"
        :effective-dup-docs="effectiveDupDocs"
        @selectCategory="$emit('selectCategory', $event)"
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
  effectiveDupDocs,
  healthPct,
  healthTooltip,
  hasIssues,
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

/** 卡片分区表格行映射（按分区 key 缓存；书签分区在汇总行后追加全部具体书签值行，发布分区在汇总行后追加平台分布行） */
const cardRowsMap = computed<Record<string, StatTableRow[]>>(() => {
  const map: Record<string, StatTableRow[]> = {}
  for (const section of statSections) {
    const rows = toCardRows(section.cards)
    if (section.key === "bookmark") { map[section.key] = [...rows, ...bookmarkRows.value]; continue }
    if (section.key === "publish") { map[section.key] = [...rows, ...platformRows.value]; continue }
    map[section.key] = rows
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

/** 发布状态分区汇总行 id（完整发布/部分发布/未发布，走 selectCategory 分类下钻） */
const PUBLISH_SUMMARY_IDS = new Set(["fullPublish", "partialPublish", "noPublish"])

/** 表格行点击分流：书签分区区分汇总行与具体书签值；发布分区区分汇总行与平台分布行；其余分区统一 selectCategory */
function handleRowSelect(sectionKey: string, id: string) {
  if (sectionKey === "bookmark") {
    if (id === "hasBookmark" || id === "noBookmark") {
      emit("selectCategory", id)
      return
    }
    emit("selectBookmark", id)
    return
  }
  if (sectionKey === "publish") {
    if (PUBLISH_SUMMARY_IDS.has(id)) {
      emit("selectCategory", id)
      return
    }
    emit("selectPlatform", id)
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
