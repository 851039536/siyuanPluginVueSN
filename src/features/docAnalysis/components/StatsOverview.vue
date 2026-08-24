<!-- 文档统计概览组件 - 统一平铺面板（Hero 汇总卡 + 工具栏 + 分区卡片 + 图表） -->
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

      <!-- 统计工具栏：Tab 切换 + 名称排除 + 隐藏零值 -->
      <div class="stats-toolbar">
        <button
          v-for="tab in statsTabs"
          :key="tab.key"
          class="stats-tab-btn"
          :class="{ active: activeStatsTab === tab.key }"
          @click="activeStatsTab = tab.key"
        >
          <Icon
            :icon="tab.icon"
            :size="13"
          />
          {{ tab.label }}
        </button>
        <!-- 名称排除（仅在有重名文档时可用） -->
        <button
          v-if="stats.duplicateNameDocs > 0"
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
        <!-- 隐藏零值开关（概览/质量 Tab 共用） -->
        <button
          class="toolbar-btn hide-zero-btn"
          :class="{ active: hideZero }"
          title="隐藏零值卡片"
          @click.stop="hideZero = !hideZero"
        >
          <Icon
            :icon="hideZero ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
            :size="13"
          />
        </button>
      </div>

      <!-- Tab: 概览 — 元数据驱动分区 -->
      <div v-show="activeStatsTab === 'overview'">
        <StatSection
          v-for="section in statSections"
          :key="section.key"
          :title="section.title"
          :icon="section.icon"
        >
          <template #headerExtra>
            <button
              v-if="section.key === 'bookmark'"
              class="bookmark-detail-btn"
              title="查看全部书签"
              @click.stop="$emit('showBookmarkDetails')"
            >
              <Icon icon="mdi:format-list-bulleted" :size="13" />详情
            </button>
          </template>
          <div class="section-cards">
            <StatCard
              v-for="card in filterVisibleCards(section.cards, hideZero)"
              :key="card.id"
              :card-id="card.id"
              :value="getCardValue(card)"
              :label="cardLabel(card)"
              :color-class="card.colorClass"
              :active="activeFilter === card.id"
              :pct="pctStr(getCardValue(card))"
              @select="(id) => $emit('selectCategory', id)"
            />
          </div>
        </StatSection>
      </div>

      <!-- Tab: 分布 — 平台 + 字数 + 书签分类 -->
      <div v-show="activeStatsTab === 'distribution'">
        <!-- 平台分布柱状图 -->
        <StatSection
          v-if="platformEntries.length > 0"
          title="平台分布"
          icon="mdi:chart-bar"
        >
          <template #headerExtra>
            <span class="section-hint">人均 {{ avgPlatformsPerDoc }} 平台 · 覆盖率 {{ coveragePct }}%</span>
          </template>
          <div class="bar-chart">
            <BarRow
              v-for="entry in platformEntries"
              :key="entry.id"
              :label="entry.name"
              :count="entry.count"
              :pct="entry.pct"
            />
          </div>
        </StatSection>

        <!-- 字数分布 -->
        <StatSection
          v-if="stats.wordCountDistribution.length > 0"
          title="字数分布"
          icon="mdi:text-short"
        >
          <div class="bar-chart">
            <BarRow
              v-for="item in stats.wordCountDistribution"
              :key="item.label"
              :label="item.label"
              :count="item.count"
              :pct="barPct(maxWordCount, item.count)"
            />
          </div>
        </StatSection>

        <!-- 自定义书签 -->
        <StatSection
          v-if="stats.customBookmarkTop.length > 0"
          :title="`书签分类 Top-${stats.customBookmarkTop.length}`"
          icon="mdi:tag-outline"
        >
          <div class="bar-chart">
            <BarRow
              v-for="item in stats.customBookmarkTop"
              :key="item.value"
              :label="item.value"
              :count="item.count"
              :pct="barPct(maxCustomBm, item.count)"
            />
          </div>
        </StatSection>
      </div>

      <!-- Tab: 质量 — 文档质量 + 深度分布 -->
      <div v-show="activeStatsTab === 'quality'">
        <!-- 文档质量 -->
        <StatSection
          title="文档质量"
          icon="mdi:clipboard-check-outline"
        >
          <div class="section-cards">
            <StatCard
              v-for="card in filterVisibleCards(QUALITY_CARDS, hideZero)"
              :key="card.id"
              :card-id="card.id"
              :value="getCardValue(card)"
              :label="cardLabel(card)"
              :color-class="card.colorClass"
              :active="activeFilter === card.id"
              :pct="pctStr(getCardValue(card))"
              @select="(id) => $emit('selectCategory', id)"
            />
          </div>
        </StatSection>
        <StatSection
          v-if="depthStats.depthDistribution.length > 0"
          title="深度分布"
          icon="mdi:chart-bar"
        >
          <template #headerExtra>
            <span class="section-hint">均 {{ depthStats.avgDepth }} 层 · 最深 {{ depthStats.maxDepth }} 层</span>
          </template>
          <div class="bar-chart">
            <BarRow
              v-for="item in depthStats.depthDistribution"
              :key="item.depth"
              :label="String(item.depth)"
              :count="item.count"
              :pct="barPct(maxDepthCount, item.count)"
              clickable
              @click="$emit('selectDepth', item.depth)"
            />
          </div>
        </StatSection>
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
} from "../types/index"
import { QUALITY_CARDS, STAT_SECTIONS } from "../types/index"
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import { useStatsOverview } from "../composables/useStatsOverview"
import StatCard from "./StatCard.vue"
import StatSection from "./StatSection.vue"
import BarRow from "./BarRow.vue"
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
  duplicateGroups: DuplicateNameGroup[]
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

/** 统计视图计算逻辑（健康度/卡片值/柱状图比例/平台分布/重名过滤） */
const {
  effectiveDupDocs,
  healthPct,
  healthTooltip,
  hasIssues,
  getCardValue,
  cardLabel,
  filterVisibleCards,
  pctStr,
  barPct,
  platformEntries,
  avgPlatformsPerDoc,
  coveragePct,
  maxWordCount,
  maxCustomBm,
  maxDepthCount,
} = useStatsOverview(props)

/** 隐藏零值开关（概览/质量 Tab 共用） */
const hideZero = ref(false)

const activeStatsTab = ref("overview")
const statsTabs = [
  { key: "overview", label: "概览", icon: "mdi:view-dashboard-outline" },
  { key: "distribution", label: "分布", icon: "mdi:chart-bar" },
  { key: "quality", label: "质量", icon: "mdi:chart-box-outline" },
]

/** 重名排除管理弹窗可见性 */
const dupFilterModalVisible = ref(false)

</script>

<style lang="scss" scoped>
@use "../styles/StatsOverview.scss";
</style>
