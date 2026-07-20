<!-- 文档统计概览组件 - 多维度统计卡片 + 分区折叠 + 深度/书签详情 -->
<template>
  <div class="stats-overview">
    <template v-if="hasAnalyzed">
      <!-- Hero：总文档 + 健康度 -->
      <div class="stats-hero">
        <div class="hero-left">
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

      <!-- 问题摘要条 -->
      <div
        v-if="hasIssues"
        class="issue-bar"
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
          v-if="stats.duplicateNameDocs"
          class="issue-item warn"
          @click="$emit('selectCategory', 'duplicate')"
        >
          <span class="issue-value">{{ stats.duplicateNameDocs }}</span>
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

      <!-- 元数据驱动分区 -->
      <StatSection
        v-for="section in statSections"
        :key="section.key"
        :section-key="section.key"
        :title="section.title"
        :icon="section.icon"
        :is-collapsed="collapsedSections.has(section.key)"
        :summary="sectionSummary(section)"
        @toggle="handleSectionToggle"
      >
        <template #headerExtra>
          <!-- 大小分布：隐藏零值 -->
          <button
            v-if="section.key === 'size'"
            class="toolbar-btn"
            :class="{ active: hideZero }"
            title="隐藏零值卡片"
            @click.stop="hideZero = !hideZero"
          >
            <Icon
              :icon="hideZero ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
              :size="13"
            />
            {{ hideZero ? '已隐藏' : '隐藏零值' }}
          </button>
          <!-- 书签：详情按钮 -->
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
            v-for="card in getVisibleCards(section)"
            :key="card.id"
            :card-id="card.id"
            :value="getCardValue(card)"
            :label="cardLabel(card)"
            :color-class="card.colorClass"
            :active="activeFilter === card.id"
            :pct="pctStr(getCardValue(card))"
            :icon-only="card.iconValue"
            @select="(id) => $emit('selectCategory', id)"
          />
        </div>
      </StatSection>

      <!-- 发布状态附加：平台分布柱状图 -->
      <div
        v-if="!collapsedSections.has('publish') && platformEntries.length > 0"
        class="platform-distro"
      >
        <div class="platform-distro-title">
          <span>平台分布</span>
          <span class="platform-metrics">
            人均 {{ avgPlatformsPerDoc }} 平台 · 覆盖率 {{ coveragePct }}%
          </span>
        </div>
        <BarRow
          v-for="entry in platformEntries"
          :key="entry.id"
          :label="entry.name"
          :count="entry.count"
          :pct="entry.pct"
        />
      </div>

      <!-- 字数分布 -->
      <div
        v-if="stats.wordCountDistribution.length > 0"
        class="stat-section"
      >
        <div
          class="section-header"
          @click="handleSectionToggle('wordcount')"
        >
          <Icon
            :icon="collapsedSections.has('wordcount') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:text-short" />字数分布
          <span
            v-if="collapsedSections.has('wordcount')"
            class="section-hint"
          >{{ wordCountSummary }}</span>
        </div>
        <div
          v-show="!collapsedSections.has('wordcount')"
          class="wordcount-chart"
        >
          <BarRow
            v-for="item in stats.wordCountDistribution"
            :key="item.label"
            :label="item.label"
            :count="item.count"
            :pct="wcBarPct(item.count)"
          />
        </div>
      </div>

      <!-- 自定义书签 -->
      <div
        v-if="stats.customBookmarkTop.length > 0"
        class="stat-section"
      >
        <div
          class="section-header"
          @click="handleSectionToggle('customBm')"
        >
          <Icon
            :icon="collapsedSections.has('customBm') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:tag-outline" />书签分类 Top-{{ stats.customBookmarkTop.length }}
        </div>
        <div
          v-show="!collapsedSections.has('customBm')"
          class="wordcount-chart"
        >
          <BarRow
            v-for="item in stats.customBookmarkTop"
            :key="item.value"
            :label="item.value"
            :count="item.count"
            :pct="customBmBarPct(item.count)"
          />
        </div>
      </div>

      <!-- 分割线 -->
      <div class="section-divider" />

      <!-- 深度分析（合并折叠区） -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="handleSectionToggle('advanced')"
        >
          <Icon
            :icon="collapsedSections.has('advanced') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:chart-box-outline" />深度分析
          <span
            v-if="collapsedSections.has('advanced')"
            class="section-hint"
          >{{ advancedSummary }}</span>
        </div>
        <div
          v-show="!collapsedSections.has('advanced')"
          class="advanced-grid"
        >
          <!-- 结构 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon icon="mdi:sitemap-outline" :size="13" />结构
            </div>
            <div class="section-cards">
              <StatCard
                v-if="!hideZero || stats.deepDocs !== 0"
                card-id="deep"
                :value="stats.deepDocs"
                label="深层≥5"
                color-class="depth-color"
                :active="activeFilter === 'deep'"
                :pct="pctStr(stats.deepDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
              <StatCard
                v-if="!hideZero || stats.imageDocs !== 0"
                card-id="hasImage"
                :value="stats.imageDocs"
                :label="`图片(${stats.totalImages})`"
                color-class="img-color"
                :active="activeFilter === 'hasImage'"
                :pct="pctStr(stats.imageDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
            </div>
          </div>

          <!-- 内容质量 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon icon="mdi:star-outline" :size="13" />内容质量
            </div>
            <div class="section-cards">
              <StatCard
                v-if="!hideZero || stats.taggedDocs !== 0"
                card-id="hasTag"
                :value="stats.taggedDocs"
                label="有标签"
                color-class="time-green"
                :active="activeFilter === 'hasTag'"
                :pct="pctStr(stats.taggedDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
              <StatCard
                v-if="!hideZero || stats.taggedDocs !== stats.totalDocs"
                card-id="noTag"
                :value="stats.totalDocs - stats.taggedDocs"
                label="无标签"
                color-class="time-red"
                :active="activeFilter === 'noTag'"
                :pct="pctStr(stats.totalDocs - stats.taggedDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
              <StatCard
                v-if="!hideZero || stats.aliasedDocs !== 0"
                card-id="hasAlias"
                :value="stats.aliasedDocs"
                label="有别名"
                color-class="time-cyan"
                :active="activeFilter === 'hasAlias'"
                :pct="pctStr(stats.aliasedDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
              <StatCard
                v-if="!hideZero || stats.memoedDocs !== 0"
                card-id="hasMemo"
                :value="stats.memoedDocs"
                label="有备注"
                color-class="time-purple"
                :active="activeFilter === 'hasMemo'"
                :pct="pctStr(stats.memoedDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
            </div>
          </div>

          <!-- 引用拓扑 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon icon="mdi:graph-outline" :size="13" />引用拓扑
            </div>
            <div class="section-cards">
              <StatCard
                v-if="!hideZero || stats.refDocs !== 0"
                card-id="hasRef"
                :value="stats.refDocs"
                :label="`含引用(${stats.totalRefs})`"
                color-class="ref-color"
                :active="activeFilter === 'hasRef'"
                :pct="pctStr(stats.refDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
              <StatCard
                v-if="!hideZero || stats.incomingRefDocs !== 0"
                card-id="incomingRef"
                :value="stats.incomingRefDocs"
                label="被引用"
                color-class="time-cyan"
                :active="activeFilter === 'incomingRef'"
                :pct="pctStr(stats.incomingRefDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
              <StatCard
                v-if="!hideZero || stats.orphanDocs !== 0"
                card-id="orphanDoc"
                :value="stats.orphanDocs"
                label="孤文档"
                color-class="zero"
                :active="activeFilter === 'orphanDoc'"
                :pct="pctStr(stats.orphanDocs)"
                @select="(id) => $emit('selectCategory', id)"
              />
            </div>
          </div>

          <!-- 深度分布（跨列） -->
          <div
            v-if="depthStats.depthDistribution.length > 0"
            class="advanced-group advanced-group--full"
          >
            <div class="advanced-group-title">
              <Icon icon="mdi:chart-bar" :size="13" />深度分布
              <span class="advanced-group-hint">均 {{ depthStats.avgDepth }} 层 · 最深 {{ depthStats.maxDepth }} 层</span>
            </div>
            <div class="depth-chart-v2">
              <BarRow
                v-for="item in depthStats.depthDistribution"
                :key="item.depth"
                :label="String(item.depth)"
                :count="item.count"
                :pct="getBarPercent(item.count)"
                clickable
                @click="$emit('selectDepth', item.depth)"
              />
            </div>
          </div>
        </div>
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

  <!-- 书签详情弹出面板 -->
  <Teleport to="body">
    <div
      v-if="bookmarkDetailVisible"
      class="bookmark-detail-overlay"
      @click.self="$emit('showBookmarkDetails')"
    >
      <div class="bookmark-detail-panel">
        <div class="bookmark-detail-header">
          <span class="bookmark-detail-title">
            <Icon icon="mdi:bookmark-outline" />
            全部书签
          </span>
          <button
            class="close-btn"
            @click="$emit('showBookmarkDetails')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="bookmark-detail-body">
          <div
            v-if="bookmarkDetailLoading"
            class="bookmark-detail-loading"
          >
            <Icon icon="mdi:loading" class="spin-icon" /> 加载中...
          </div>
          <div
            v-else-if="bookmarkDetails.length === 0"
            class="bookmark-detail-empty"
          >
            <Icon icon="mdi:bookmark-off-outline" class="empty-icon" />
            <p>暂无书签数据</p>
          </div>
          <div
            v-else
            class="bookmark-detail-list"
          >
            <button
              v-for="item in bookmarkDetails"
              :key="item.value"
              class="bookmark-detail-item"
              @click="$emit('selectBookmark', item.value)"
            >
              <div class="bd-item-left">
                <span class="bd-item-name" :title="item.value">{{ item.value || '(空值)' }}</span>
              </div>
              <span class="bd-item-count">{{ item.count }} 篇</span>
              <Icon icon="mdi:chevron-right" class="bd-item-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  BookmarkDetail,
  DepthStats,
  DocStats,
  StatCardDef,
  StatSectionDef,
} from "../types/index"
import { STAT_SECTIONS } from "../types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  reactive,
  ref,
} from "vue"
import { PLATFORM_META } from "../composables/useDocAnalysis"
import StatCard from "./StatCard.vue"
import StatSection from "./StatSection.vue"
import BarRow from "./BarRow.vue"

interface Props {
  stats: DocStats
  loading: boolean
  hasAnalyzed: boolean
  activeFilter: string
  depthStats: DepthStats
  bookmarkDetails: BookmarkDetail[]
  bookmarkDetailVisible: boolean
  bookmarkDetailLoading: boolean
}

const props = defineProps<Props>()

defineEmits<{
  (e: "selectCategory", category: string): void
  (e: "showBookmarkDetails"): void
  (e: "selectBookmark", bookmark: string): void
  (e: "selectDepth", depth: number): void
}>()

const statSections = STAT_SECTIONS as readonly StatSectionDef[]

const hideZero = ref(false)
const collapsedSections = reactive(new Set<string>(["advanced"]))

function handleSectionToggle(key: string) {
  if (collapsedSections.has(key)) {
    collapsedSections.delete(key)
  }
  else {
    collapsedSections.add(key)
  }
}

// ============================================================
// 健康度
// ============================================================

const _healthBreakdown = computed(() => {
  const s = props.stats
  const total = s.totalDocs
  const excessDupes = Math.max(0, s.duplicateNameDocs - s.duplicateNameGroups)
  const noBmExclude0B = Math.max(0, s.noBookmarkDocs - s.zeroByteDocs)
  const depthGt7 = props.depthStats.depthDistribution
    .filter((d) => d.depth > 7)
    .reduce((sum, d) => sum + d.count, 0)
  const wcGt20000 = (s.wordCountDistribution || [])
    .filter((d) => d.label === ">2万字")
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
  props.stats.zeroByteDocs > 0 || props.stats.duplicateNameDocs > 0
  || props.stats.pendingPublishDocs > 0 || props.stats.orphanDocs > 0,
)

// ============================================================
// 卡片值计算
// ============================================================

function getCardValue(card: StatCardDef): number {
  if (card.resolveValue) return card.resolveValue(props.stats)
  return (props.stats[card.statKey] as number) || 0
}

function cardLabel(card: StatCardDef): string {
  if (card.suffixStatKey) {
    const suffixVal = (props.stats[card.suffixStatKey] as number) || 0
    if (card.id === "duplicate") return `重名(${suffixVal}组)`
  }
  return card.shortLabel
}

function getVisibleCards(section: StatSectionDef): StatCardDef[] {
  if (!hideZero.value) return section.cards
  return section.cards.filter((c) => getCardValue(c) > 0)
}

function pctStr(count: number): string {
  if (!props.stats.totalDocs) return "0%"
  return `${Math.min(100, Math.round((count / props.stats.totalDocs) * 100))}%`
}

function sectionSummary(section: StatSectionDef): string {
  const parts = section.cards
    .filter((c) => getCardValue(c) > 0 && !c.iconValue)
    .map((c) => `${c.shortLabel} ${getCardValue(c)}`)
    .slice(0, 4)
  return parts.join(" · ")
}

// ============================================================
// 平台分布
// ============================================================

const platformEntries = computed(() => {
  const counts = props.stats.platformCounts || {}
  const entries = Object.entries(counts)
    .map(([id, count]) => {
      const meta = PLATFORM_META.value.find((p) => p.id === id)
      return { id, name: meta?.name || id, count }
    })
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
  const max = Math.max(...entries.map((e) => e.count), 1)
  return entries.map((e) => ({ ...e, pct: Math.round((e.count / max) * 100) }))
})

const docsInSystem = computed(() =>
  props.stats.fullPublishDocs + props.stats.partialPublishDocs,
)

const avgPlatformsPerDoc = computed(() => {
  if (docsInSystem.value === 0) return "0"
  const total = Object.values(props.stats.platformCounts || {}).reduce((a, b) => a + b, 0)
  return (total / docsInSystem.value).toFixed(1)
})

const coveragePct = computed(() => {
  if (!props.stats.totalDocs) return 0
  return Math.round((docsInSystem.value / props.stats.totalDocs) * 100)
})

// ============================================================
// 字数分布 / 书签分类柱状图
// ============================================================

const wordCountSummary = computed(() => {
  const dist = props.stats.wordCountDistribution || []
  if (dist.length === 0) return ""
  return dist.map((d) => `${d.label.split("字")[0]} ${d.count}`).join(" · ")
})

const maxWordCount = computed(() => {
  const counts = props.stats.wordCountDistribution.map((d) => d.count)
  return Math.max(...counts, 1)
})

function wcBarPct(count: number): number {
  return Math.round((count / maxWordCount.value) * 100)
}

const maxCustomBm = computed(() => {
  const counts = props.stats.customBookmarkTop.map((d) => d.count)
  return Math.max(...counts, 1)
})

function customBmBarPct(count: number): number {
  return Math.round((count / maxCustomBm.value) * 100)
}

// ============================================================
// 深度分布柱状图
// ============================================================

const maxDepthCount = computed(() => {
  const counts = props.depthStats.depthDistribution.map((d) => d.count)
  return Math.max(...counts, 1)
})

function getBarPercent(count: number): string {
  return `${Math.round((count / maxDepthCount.value) * 100)}%`
}

// ============================================================
// 深度分析摘要
// ============================================================

const advancedSummary = computed(() => {
  const s = props.stats
  const d = props.depthStats
  const parts: string[] = []
  if (s.deepDocs) parts.push(`深层 ${s.deepDocs}`)
  if (s.imageDocs) parts.push(`有图 ${s.imageDocs}`)
  if (s.taggedDocs) parts.push(`有标签 ${s.taggedDocs}`)
  if (s.orphanDocs) parts.push(`孤文档 ${s.orphanDocs}`)
  if (d.avgDepth) parts.push(`均深 ${d.avgDepth}`)
  return parts.join(" · ")
})
</script>

<style lang="scss" scoped>
@use "../styles/StatsOverview.scss";
</style>
