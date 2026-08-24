<!-- 文档统计概览组件 - 表格化 2 列布局（Hero 汇总 + 工具栏 + 九个表格区块） -->
<template>
  <div class="stats-overview">
    <template v-if="hasAnalyzed">
      <!-- Hero 汇总卡：总文档 + 健康度 + 问题速览 -->
      <div class="stats-hero">
        <div class="hero-top">
          <div class="hero-left">
            <span class="hero-label">总文档</span>
            <span class="hero-value">{{ stats.totalDocs }}</span>
          </div>
          <div class="hero-right">
            <span class="hero-health-label">健康度</span>
            <div
              class="hero-health-bar"
              :title="healthTooltip"
            >
              <div
                class="hero-health-fill"
                :style="{ width: `${healthPct}%` }"
              />
            </div>
            <span
              class="hero-health-value"
              :title="healthTooltip"
            >{{ healthPct }}%</span>
            <span
              class="hero-health-info"
              :title="healthTooltip"
            >
              <Icon icon="mdi:information-outline" />
            </span>
          </div>
        </div>
        <!-- 问题速览（徽章行） -->
        <div
          v-if="hasIssues"
          class="hero-issues"
        >
          <div
            v-if="stats.zeroByteDocs"
            class="issue-item critical"
            @click="$emit('selectCategory', '0B')"
          >
            <span class="issue-value">{{ stats.zeroByteDocs }}</span>
            <span class="issue-label">0B空</span>
          </div>
          <div
            v-if="effectiveDupDocs > 0"
            class="issue-item warn"
            @click="$emit('selectCategory', 'duplicate')"
          >
            <span class="issue-value">{{ effectiveDupDocs }}</span>
            <span class="issue-label">重名</span>
          </div>
          <div
            v-if="stats.pendingPublishDocs"
            class="issue-item accent"
            @click="$emit('selectCategory', 'pendingPublish')"
          >
            <span class="issue-value">{{ stats.pendingPublishDocs }}</span>
            <span class="issue-label">待发布</span>
          </div>
          <div
            v-if="stats.orphanDocs"
            class="issue-item critical"
            @click="$emit('selectCategory', 'orphanDoc')"
          >
            <span class="issue-value">{{ stats.orphanDocs }}</span>
            <span class="issue-label">孤文档</span>
          </div>
        </div>
      </div>

      <!-- 统计工具栏：名称排除 + 隐藏零值 -->
      <div class="stats-toolbar">
        <button
          v-if="effectiveDupDocs > 0"
          class="toolbar-btn name-filter-btn"
          title="名称排除"
          @click="dupFilterModalVisible = true"
        >
          <Icon
            icon="mdi:filter-remove-outline"
            :size="13"
          />
          <span
            v-if="duplicateNameFilter.length > 0"
            class="toolbar-badge"
          >{{ duplicateNameFilter.length }}</span>
        </button>
        <button
          v-if="duplicateNameFilter.length > 0"
          class="toolbar-btn"
          title="清除全部排除名称"
          @click="$emit('update:duplicateNameFilter', [])"
        >
          <Icon icon="mdi:close" :size="13" />
        </button>
        <!-- 隐藏零值开关（作用于全部表格） -->
        <button
          class="toolbar-btn hide-zero-btn"
          :class="{ active: hideZero }"
          title="隐藏零值行"
          @click.stop="hideZero = !hideZero"
        >
          <Icon
            :icon="hideZero ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
            :size="13"
          />
        </button>
      </div>

      <!-- 统计表格区块：2 列网格布局 -->
      <div class="stats-grid">
        <!-- 卡片类表格（大小/时间/书签/发布，元数据驱动） -->
        <StatTable
          v-for="section in statSections"
          :key="section.key"
          :title="section.title"
          :icon="section.icon"
          :rows="filterZeroRows(cardRowsMap[section.key])"
          :active-id="activeFilter"
          @select="(id) => $emit('selectCategory', id)"
        >
          <template
            v-if="section.key === 'bookmark'"
            #headerExtra
          >
            <button
              class="bookmark-detail-btn"
              title="查看全部书签"
              @click.stop="$emit('showBookmarkDetails')"
            >
              <Icon icon="mdi:format-list-bulleted" :size="13" />详情
            </button>
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

        <!-- 平台分布表 -->
        <StatTable
          v-if="platformEntries.length > 0"
          title="平台分布"
          icon="mdi:chart-bar"
          :rows="filterZeroRows(platformRows)"
        >
          <template #headerExtra>
            <span class="section-hint">人均 {{ avgPlatformsPerDoc }} 平台 · 覆盖率 {{ coveragePct }}%</span>
          </template>
        </StatTable>

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

        <!-- 书签分类表 -->
        <StatTable
          v-if="stats.customBookmarkTop.length > 0"
          :title="`书签分类 Top-${stats.customBookmarkTop.length}`"
          icon="mdi:tag-outline"
          :rows="filterZeroRows(customBookmarkRows)"
        />
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

    <!-- 书签详情弹出面板 -->
    <BookmarkDetailModal
      :visible="bookmarkDetailVisible"
      :loading="bookmarkDetailLoading"
      :details="bookmarkDetails"
      @close="$emit('showBookmarkDetails')"
      @select="(value) => $emit('selectBookmark', value)"
    />

    <!-- 重名排除管理弹窗 -->
    <DuplicateNameFilterModal
      :visible="dupFilterModalVisible"
      :names="duplicateNameFilter"
      @close="dupFilterModalVisible = false"
      @save="(names) => $emit('update:duplicateNameFilter', names)"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  BookmarkDetail,
  DepthStats,
  DocStats,
  DuplicateNameGroup,
  StatSectionDef,
  StatTableRow,
} from "../../types/index"
import { QUALITY_CARDS, STAT_SECTIONS } from "../../types/index"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { useStatsOverview } from "../../composables/useStatsOverview"
import StatTable from "./StatTable.vue"
import BookmarkDetailModal from "./BookmarkDetailModal.vue"
import DuplicateNameFilterModal from "./DuplicateNameFilterModal.vue"

interface Props {
  stats: DocStats
  hasAnalyzed: boolean
  activeFilter: string
  depthStats: DepthStats
  bookmarkDetails: BookmarkDetail[]
  bookmarkDetailVisible: boolean
  bookmarkDetailLoading: boolean
  effectiveDuplicateGroups: DuplicateNameGroup[]
  duplicateNameFilter: string[]
}

const props = defineProps<Props>()

defineEmits<{
  (e: "selectCategory", category: string): void
  (e: "showBookmarkDetails"): void
  (e: "selectBookmark", bookmark: string): void
  (e: "selectDepth", depth: number): void
  (e: "update:duplicateNameFilter", value: string[]): void
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

/** 隐藏零值开关（作用于全部表格） */
const hideZero = ref(false)

/** 重名排除管理弹窗可见性 */
const dupFilterModalVisible = ref(false)

/** 卡片分区表格行映射（按分区 key 缓存） */
const cardRowsMap = computed<Record<string, StatTableRow[]>>(() => {
  const map: Record<string, StatTableRow[]> = {}
  for (const section of statSections) {
    map[section.key] = toCardRows(section.cards)
  }
  return map
})

/** 文档质量表格行 */
const qualityRows = computed(() => toCardRows(QUALITY_CARDS))

/** 平台分布表格行（不可下钻） */
const platformRows = computed<StatTableRow[]>(() =>
  platformEntries.value.map((e) => ({
    id: e.id,
    label: e.name,
    count: e.count,
    pct: pctStr(e.count),
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

/** 书签分类表格行（不可下钻） */
const customBookmarkRows = computed<StatTableRow[]>(() =>
  props.stats.customBookmarkTop.map((item) => ({
    id: item.value,
    label: item.value || "(空值)",
    count: item.count,
    pct: pctStr(item.count),
  })),
)

/** 隐藏零值行过滤（作用于全部表格） */
function filterZeroRows(rows: StatTableRow[]): StatTableRow[] {
  return hideZero.value ? rows.filter((r) => r.count > 0) : rows
}
</script>

<style lang="scss" scoped>
@use "../../styles/StatsOverview.scss";
</style>
