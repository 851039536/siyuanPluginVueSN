<template>
  <div class="stats-overview">
    <div
      v-if="collapsible"
      class="stats-header"
      :class="{ collapsed: isCollapsed }"
      @click="toggleCollapse"
    >
      <div class="header-left">
        <Icon
          :icon="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'"
          class="collapse-icon"
        />
        <span class="stats-title">文档统计概览</span>
      </div>
      <button
        class="analyze-btn"
        :disabled="loading"
        @click.stop="$emit('analyze')"
      >
        <Icon
          :icon="loading ? 'mdi:loading' : 'mdi:chart-bar'"
          :class="{ 'spin-icon': loading }"
        />
        {{ loading ? '分析中...' : '分析' }}
      </button>
    </div>

    <template v-if="hasAnalyzed && (!isCollapsed || !collapsible)">
      <!-- Hero：总文档 + 健康度 -->
      <div class="stats-hero">
        <div class="hero-left">
          <span class="hero-value">{{ stats.totalDocs }}</span>
          <span class="hero-label">总文档</span>
        </div>
        <div class="hero-right">
          <span class="hero-health-label">健康度</span>
          <div class="hero-health-bar">
            <div
              class="hero-health-fill"
              :style="{ width: healthPct + '%' }"
            ></div>
          </div>
          <span class="hero-health-value">{{ healthPct }}%</span>
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
          @click="$emit('select-category', '0B')"
        >
          <span class="issue-value">{{ stats.zeroByteDocs }}</span>
          <span class="issue-label">0B空</span>
        </div>
        <div
          v-if="stats.duplicateNameDocs"
          class="issue-item warn"
          @click="$emit('select-category', 'duplicate')"
        >
          <span class="issue-value">{{ stats.duplicateNameDocs }}</span>
          <span class="issue-label">重名</span>
        </div>
        <div
          v-if="stats.pendingPublishDocs"
          class="issue-item accent"
          @click="$emit('select-category', 'pendingPublish')"
        >
          <span class="issue-value">{{ stats.pendingPublishDocs }}</span>
          <span class="issue-label">待发布</span>
        </div>
        <div
          v-if="stats.orphanDocs"
          class="issue-item critical"
          @click="$emit('select-category', 'orphanDoc')"
        >
          <span class="issue-value">{{ stats.orphanDocs }}</span>
          <span class="issue-label">孤文档</span>
        </div>
      </div>

      <!-- 大小分布 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('size')"
        >
          <Icon
            :icon="isSectionCollapsed('size') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:harddisk" />大小分布
          <button
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
        </div>
        <div
          v-show="!isSectionCollapsed('size')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.zeroByteDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === '0B' }"
            @click="$emit('select-category', '0B')"
          >
            <span class="card-value zero">{{ stats.zeroByteDocs }}</span>
            <span class="card-unit">0B空</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.zeroByteDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.smallDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'small' }"
            @click="$emit('select-category', 'small')"
          >
            <span class="card-value small">{{ stats.smallDocs }}</span>
            <span class="card-unit">&lt;1KB</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.smallDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.mediumDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'medium' }"
            @click="$emit('select-category', 'medium')"
          >
            <span class="card-value medium">{{ stats.mediumDocs }}</span>
            <span class="card-unit">1~10KB</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.mediumDocs) }"
            ></span>
          </div>
          <div
            v-if="!hideZero || stats.duplicateNameDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'duplicate' }"
            @click="$emit('select-category', 'duplicate')"
          >
            <span class="card-value dup">{{ stats.duplicateNameDocs }}</span>
            <span class="card-unit">重名({{ stats.duplicateNameGroups }}组)</span>
            <span
              class="card-percent"
              :style="{ width: pct(stats.duplicateNameDocs) }"
            ></span>
          </div>
        </div>
      </div>

      <!-- 更新时间 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('time')"
        >
          <Icon
            :icon="isSectionCollapsed('time') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:clock-outline" />更新时间
        </div>
        <div
          v-show="!isSectionCollapsed('time')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.updatedIn7Days"
            class="stat-card"
            :class="{ active: activeFilter === '7days' }"
            @click="$emit('select-category', '7days')"
          >
            <span class="card-value time-green">{{ stats.updatedIn7Days }}</span>
            <span class="card-unit">7天内</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedIn30Days"
            class="stat-card"
            :class="{ active: activeFilter === '30days' }"
            @click="$emit('select-category', '30days')"
          >
            <span class="card-value time-yellow">{{ stats.updatedIn30Days }}</span>
            <span class="card-unit">7~30天</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedIn1To2Months"
            class="stat-card"
            :class="{ active: activeFilter === '1to2month' }"
            @click="$emit('select-category', '1to2month')"
          >
            <span class="card-value time-cyan">{{ stats.updatedIn1To2Months }}</span>
            <span class="card-unit">1~2月</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedIn2To3Months"
            class="stat-card"
            :class="{ active: activeFilter === '2to3month' }"
            @click="$emit('select-category', '2to3month')"
          >
            <span class="card-value time-orange">{{ stats.updatedIn2To3Months }}</span>
            <span class="card-unit">2~3月</span>
          </div>
          <div
            v-if="!hideZero || stats.updatedOverHalfYear !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'halfYear' }"
            @click="$emit('select-category', 'halfYear')"
          >
            <span class="card-value time-red">{{ stats.updatedOverHalfYear }}</span>
            <span class="card-unit">半年+</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'customTime' }"
            @click="$emit('select-category', 'customTime')"
          >
            <span class="card-value time-purple"><Icon icon="mdi:calendar-range" /></span>
            <span class="card-unit">自定义</span>
          </div>
        </div>
      </div>

      <!-- 书签 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('bookmark')"
        >
          <Icon
            :icon="isSectionCollapsed('bookmark') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:bookmark-outline" />书签
          <button
            class="bookmark-detail-btn"
            title="查看全部书签"
            @click.stop="$emit('show-bookmark-details')"
          >
            <Icon
              icon="mdi:format-list-bulleted"
              :size="13"
            />详情
          </button>
        </div>
        <div
          v-show="!isSectionCollapsed('bookmark')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.pendingPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'pendingPublish' }"
            @click="$emit('select-category', 'pendingPublish')"
          >
            <span class="card-value pending-color">{{ stats.pendingPublishDocs }}</span>
            <span class="card-unit">待发布</span>
            <button
              v-if="stats.pendingPublishDocs > 0"
              class="card-action-btn"
              title="批量发布"
              @click.stop="$emit('batch-publish', 'pendingPublish')"
            >
              <Icon icon="mdi:publish" />
            </button>
          </div>
          <div
            v-if="!hideZero || stats.publishedDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'published' }"
            @click="$emit('select-category', 'published')"
          >
            <span class="card-value published-color">{{ stats.publishedDocs }}</span>
            <span class="card-unit">已发布</span>
          </div>
          <div
            v-if="!hideZero || stats.unusedDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'unused' }"
            @click="$emit('select-category', 'unused')"
          >
            <span class="card-value unused-color">{{ stats.unusedDocs }}</span>
            <span class="card-unit">不使用</span>
          </div>
          <div
            v-if="!hideZero || stats.noneBookmarkDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'noneBookmark' }"
            @click="$emit('select-category', 'noneBookmark')"
          >
            <span class="card-value none-bookmark-color">{{ stats.noneBookmarkDocs }}</span>
            <span class="card-unit">无</span>
          </div>
          <div
            v-if="!hideZero || stats.bookmarkedDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'hasBookmark' }"
            @click="$emit('select-category', 'hasBookmark')"
          >
            <span class="card-value bookmark-color">{{ stats.bookmarkedDocs }}</span>
            <span class="card-unit">有书签</span>
          </div>
          <div
            v-if="!hideZero || stats.noBookmarkDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'noBookmark' }"
            @click="$emit('select-category', 'noBookmark')"
          >
            <span class="card-value no-bookmark-color">{{ stats.noBookmarkDocs }}</span>
            <span class="card-unit">无书签</span>
          </div>
        </div>
      </div>

      <!-- 发布状态 -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('publish')"
        >
          <Icon
            :icon="isSectionCollapsed('publish') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:cloud-check-outline" />发布状态
        </div>
        <div
          v-show="!isSectionCollapsed('publish')"
          class="section-cards"
        >
          <div
            v-if="!hideZero || stats.fullPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'fullPublish' }"
            @click="$emit('select-category', 'fullPublish')"
          >
            <span class="card-value full-publish-color">{{ stats.fullPublishDocs }}</span>
            <span class="card-unit">完整发布</span>
          </div>
          <div
            v-if="!hideZero || stats.partialPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'partialPublish' }"
            @click="$emit('select-category', 'partialPublish')"
          >
            <span class="card-value partial-publish-color">{{ stats.partialPublishDocs }}</span>
            <span class="card-unit">部分发布</span>
          </div>
          <div
            v-if="!hideZero || stats.noPublishDocs !== 0"
            class="stat-card"
            :class="{ active: activeFilter === 'noPublish' }"
            @click="$emit('select-category', 'noPublish')"
          >
            <span class="card-value no-publish-color">{{ stats.noPublishDocs }}</span>
            <span class="card-unit">未发布</span>
          </div>
        </div>
      </div>

      <!-- 分割线 -->
      <div class="section-divider"></div>

      <!-- 深度分析（合并折叠区：结构 + 内容质量 + 引用拓扑 + 深度分布） -->
      <div class="stat-section">
        <div
          class="section-header"
          @click="toggleSection('advanced')"
        >
          <Icon
            :icon="isSectionCollapsed('advanced') ? 'mdi:chevron-right' : 'mdi:chevron-down'"
            class="section-toggle-icon"
          />
          <Icon icon="mdi:chart-box-outline" />深度分析
          <span
            v-if="isSectionCollapsed('advanced')"
            class="section-hint"
          >{{ advancedSummary }}</span>
        </div>
        <div
          v-show="!isSectionCollapsed('advanced')"
          class="advanced-grid"
        >
          <!-- 结构 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon
                icon="mdi:sitemap-outline"
                :size="13"
              />结构
            </div>
            <div class="section-cards">
              <div
                v-if="!hideZero || stats.deepDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'deep' }"
                @click="$emit('select-category', 'deep')"
              >
                <span class="card-value depth-color">{{ stats.deepDocs }}</span>
                <span class="card-unit">深层≥5</span>
              </div>
              <div
                v-if="!hideZero || stats.imageDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasImage' }"
                @click="$emit('select-category', 'hasImage')"
              >
                <span class="card-value img-color">{{ stats.imageDocs }}</span>
                <span class="card-unit">图片({{ stats.totalImages }})</span>
              </div>
            </div>
          </div>

          <!-- 内容质量 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon
                icon="mdi:star-outline"
                :size="13"
              />内容质量
            </div>
            <div class="section-cards">
              <div
                v-if="!hideZero || stats.taggedDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasTag' }"
                @click="$emit('select-category', 'hasTag')"
              >
                <span class="card-value time-green">{{ stats.taggedDocs }}</span>
                <span class="card-unit">有标签</span>
              </div>
              <div
                v-if="!hideZero || stats.taggedDocs !== stats.totalDocs"
                class="stat-card"
                :class="{ active: activeFilter === 'noTag' }"
                @click="$emit('select-category', 'noTag')"
              >
                <span class="card-value time-red">{{ stats.totalDocs - stats.taggedDocs }}</span>
                <span class="card-unit">无标签</span>
              </div>
              <div
                v-if="!hideZero || stats.aliasedDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasAlias' }"
                @click="$emit('select-category', 'hasAlias')"
              >
                <span class="card-value time-cyan">{{ stats.aliasedDocs }}</span>
                <span class="card-unit">有别名</span>
              </div>
              <div
                v-if="!hideZero || stats.memoedDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasMemo' }"
                @click="$emit('select-category', 'hasMemo')"
              >
                <span class="card-value time-purple">{{ stats.memoedDocs }}</span>
                <span class="card-unit">有备注</span>
              </div>
            </div>
          </div>

          <!-- 引用拓扑 -->
          <div class="advanced-group">
            <div class="advanced-group-title">
              <Icon
                icon="mdi:graph-outline"
                :size="13"
              />引用拓扑
            </div>
            <div class="section-cards">
              <div
                v-if="!hideZero || stats.refDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'hasRef' }"
                @click="$emit('select-category', 'hasRef')"
              >
                <span class="card-value ref-color">{{ stats.refDocs }}</span>
                <span class="card-unit">含引用({{ stats.totalRefs }})</span>
              </div>
              <div
                v-if="!hideZero || stats.incomingRefDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'incomingRef' }"
                @click="$emit('select-category', 'incomingRef')"
              >
                <span class="card-value time-cyan">{{ stats.incomingRefDocs }}</span>
                <span class="card-unit">被引用</span>
              </div>
              <div
                v-if="!hideZero || stats.orphanDocs !== 0"
                class="stat-card"
                :class="{ active: activeFilter === 'orphanDoc' }"
                @click="$emit('select-category', 'orphanDoc')"
              >
                <span class="card-value zero">{{ stats.orphanDocs }}</span>
                <span class="card-unit">孤文档</span>
              </div>
            </div>
          </div>

          <!-- 深度分布（跨列） -->
          <div
            v-if="depthStats.depthDistribution.length > 0"
            class="advanced-group advanced-group--full"
          >
            <div class="advanced-group-title">
              <Icon
                icon="mdi:chart-bar"
                :size="13"
              />深度分布
              <span class="advanced-group-hint">均 {{ depthStats.avgDepth }} 层 · 最深 {{ depthStats.maxDepth }} 层</span>
            </div>
            <div class="depth-chart-v2">
              <div
                v-for="item in depthStats.depthDistribution"
                :key="item.depth"
                class="depth-bar-v2"
              >
                <span class="depth-bar-label">{{ item.depth }}</span>
                <div class="depth-bar-track">
                  <div
                    class="depth-bar-fill"
                    :style="{ width: getBarPercent(item.count) }"
                  ></div>
                </div>
                <span class="depth-bar-count">{{ item.count }}</span>
              </div>
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
      @click.self="$emit('show-bookmark-details')"
    >
      <div class="bookmark-detail-panel">
        <div class="bookmark-detail-header">
          <span class="bookmark-detail-title">
            <Icon icon="mdi:bookmark-outline" />
            全部书签
          </span>
          <button
            class="close-btn"
            @click="$emit('show-bookmark-details')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="bookmark-detail-body">
          <div
            v-if="bookmarkDetailLoading"
            class="bookmark-detail-loading"
          >
            <Icon
              icon="mdi:loading"
              class="spin-icon"
            />
            加载中...
          </div>
          <div
            v-else-if="bookmarkDetails.length === 0"
            class="bookmark-detail-empty"
          >
            <Icon
              icon="mdi:bookmark-off-outline"
              class="empty-icon"
            />
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
              @click="$emit('select-bookmark', item.value)"
            >
              <div class="bd-item-left">
                <span
                  class="bd-item-name"
                  :title="item.value"
                >{{ item.value || '(空值)' }}</span>
              </div>
              <span class="bd-item-count">{{ item.count }} 篇</span>
              <Icon
                icon="mdi:chevron-right"
                class="bd-item-arrow"
              />
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
} from "../types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  reactive,
  ref,
} from "vue"

interface Props {
  stats: DocStats
  loading: boolean
  hasAnalyzed: boolean
  activeFilter: string
  depthStats: DepthStats
  bookmarkDetails: BookmarkDetail[]
  bookmarkDetailVisible: boolean
  bookmarkDetailLoading: boolean
  collapsible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: true,
})

defineEmits<{
  (e: "analyze"): void
  (e: "select-category", category: string): void
  (e: "batch-publish", category: string): void
  (e: "show-bookmark-details"): void
  (e: "select-bookmark", bookmark: string): void
}>()

/** 折叠状态 */
const isCollapsed = ref(false)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

/** 隐藏零值卡片 */
const hideZero = ref(false)

/** 分区折叠状态（深度分析默认折叠） */
const collapsedSections = reactive(new Set<string>(["advanced"]))

function toggleSection(key: string) {
  if (collapsedSections.has(key)) {
    collapsedSections.delete(key)
  }
  else {
    collapsedSections.add(key)
  }
}

function isSectionCollapsed(key: string): boolean {
  return collapsedSections.has(key)
}

/** 健康度百分比（0-100） */
const healthPct = computed(() => {
  const total = props.stats.totalDocs
  if (!total) return 100
  const issues = props.stats.zeroByteDocs + props.stats.duplicateNameDocs
    + props.stats.orphanDocs + props.stats.updatedOverHalfYear + props.stats.unusedDocs
  return Math.max(0, Math.min(100, Math.round((1 - issues / total) * 100)))
})

/** 是否有问题项需要显示 */
const hasIssues = computed(() =>
  props.stats.zeroByteDocs > 0 || props.stats.duplicateNameDocs > 0
  || props.stats.pendingPublishDocs > 0 || props.stats.orphanDocs > 0,
)

/** 深度分析折叠时的摘要文本 */
const advancedSummary = computed(() => {
  const parts: string[] = []
  if (props.stats.deepDocs) parts.push(`深层 ${props.stats.deepDocs}`)
  if (props.stats.imageDocs) parts.push(`有图 ${props.stats.imageDocs}`)
  if (props.stats.taggedDocs) parts.push(`有标签 ${props.stats.taggedDocs}`)
  if (props.stats.orphanDocs) parts.push(`孤文档 ${props.stats.orphanDocs}`)
  if (props.depthStats.avgDepth) parts.push(`均深 ${props.depthStats.avgDepth}`)
  return parts.join(" · ")
})

/** 计算卡片百分比进度条宽度 */
function pct(count: number): string {
  if (!props.stats.totalDocs || props.stats.totalDocs === 0) return "0%"
  return `${Math.min(100, Math.round((count / props.stats.totalDocs) * 100))}%`
}

/** 计算深度分布柱状图宽度百分比 */
const maxDepthCount = computed(() => {
  const counts = props.depthStats.depthDistribution.map((d) => d.count)
  return Math.max(...counts, 1)
})

function getBarPercent(count: number): string {
  return `${Math.round((count / maxDepthCount.value) * 100)}%`
}
</script>

<style lang="scss" scoped>
@use "../styles/codex-tokens" as *;

.stats-overview {
  padding: 8px 12px;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  cursor: pointer;
  user-select: none;

  &.collapsed {
    margin-bottom: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .collapse-icon {
    font-size: 15px;
    color: var(--b3-theme-on-surface-variant);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .stats-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .analyze-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 10px;
    border: 1px solid var(--b3-theme-primary);
    border-radius: $da-radius;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-size: 12px;
    cursor: pointer;

    &:hover:not(:disabled) { opacity: 0.85; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }

    .spin-icon {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// ============ Hero 区域 ============
.stats-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: $da-radius;

  .hero-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .hero-value {
    font-size: 24px;
    font-weight: 800;
    font-family: $da-mono;
    color: var(--b3-theme-on-background);
    line-height: 1;
  }

  .hero-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.45;
    margin-top: 2px;
  }

  .hero-right {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .hero-health-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.45;
    white-space: nowrap;
  }

  .hero-health-bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--b3-theme-surface-light);
    overflow: hidden;
    min-width: 40px;
  }

  .hero-health-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--b3-theme-primary);
    transition: width 0.5s ease;
  }

  .hero-health-value {
    font-size: 14px;
    font-weight: 700;
    font-family: $da-mono;
    color: var(--b3-theme-primary);
    white-space: nowrap;
  }
}

// ============ 问题摘要条 ============
.issue-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;

  .issue-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 2px;
    border-radius: $da-radius;
    border: 1px solid var(--b3-border-color);
    cursor: pointer;
    transition: border-color 0.15s;

    &:hover {
      border-color: var(--b3-theme-primary);
    }

    &.critical {
      border-color: var(--b3-theme-error, #ef4444);
      .issue-value { color: var(--b3-theme-error, #ef4444); }
    }

    &.warn {
      border-color: var(--b3-theme-warning, #f59e0b);
      .issue-value { color: var(--b3-theme-warning, #f59e0b); }
    }

    &.accent {
      border-color: var(--b3-theme-info, #a855f7);
      .issue-value { color: var(--b3-theme-info, #a855f7); }
    }
  }

  .issue-value {
    font-size: 16px;
    font-weight: 700;
    font-family: $da-mono;
    line-height: 1;
  }

  .issue-label {
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 2px;
  }
}

// ============ 分割线 ============
.section-divider {
  border-top: 1px dashed var(--b3-border-color);
  margin: 6px 0;
}

// ============ 分区 ============
.stat-section {
  padding: 8px 0;
  border-bottom: 1px solid var(--b3-border-color-light, rgba(0,0,0,0.04));

  &:last-child {
    border-bottom: none;
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
  margin-bottom: 6px;
  cursor: pointer;
  user-select: none;

  &:hover {
    color: var(--b3-theme-primary);
  }

  .section-toggle-icon {
    font-size: 14px;
    color: var(--b3-theme-on-surface-variant);
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .section-hint {
    font-weight: 400;
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-left: auto;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: $da-radius;
    background: transparent;
    color: var(--b3-theme-on-surface-variant);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    opacity: 1;
    cursor: pointer;
    white-space: nowrap;
    margin-left: auto;

    &:hover {
      background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
    }

    &.active {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
    }
  }
}

// ============ 卡片行 ============
.section-cards {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

// ============ 深度分析网格 ============
.advanced-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.advanced-group {
  border: 1px solid var(--b3-border-color);
  border-radius: $da-radius;
  padding: 8px;

  &--full {
    grid-column: 1 / -1;
  }

  .advanced-group-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.45;
    margin-bottom: 6px;
  }

  .advanced-group-hint {
    font-weight: 400;
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-left: auto;
    letter-spacing: 0;
    text-transform: none;
  }

  .section-cards {
    gap: 4px;
  }

  .stat-card {
    min-width: 48px;
    padding: 6px 4px 5px;
  }
}

.stat-card {
  flex: 1;
  min-width: 54px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 5px 6px;
  border-radius: $da-radius;
  background: transparent;
  cursor: pointer;
  border: 1px solid var(--b3-border-color);
  overflow: hidden;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
  }

  .card-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--b3-theme-on-background);
    line-height: 1.2;
    position: relative;
    z-index: 1;

    &.zero { color: var(--b3-theme-error, #ef4444); }
    &.small { color: var(--b3-theme-warning, #f59e0b); }
    &.medium { color: var(--b3-theme-info, #3b82f6); }
    &.dup { color: var(--b3-theme-info, #a855f7); }
    &.time-green { color: var(--b3-theme-success, #22c55e); }
    &.time-yellow { color: var(--b3-theme-warning, #f59e0b); }
    &.time-red { color: var(--b3-theme-error, #ef4444); }
    &.time-cyan { color: var(--b3-theme-info, #06b6d4); }
    &.time-orange { color: var(--b3-theme-warning, #f97316); }
    &.time-purple { color: var(--b3-theme-info, #a855f7); }
    &.depth-color { color: var(--b3-theme-info, #06b6d4); }
    &.ref-color { color: var(--b3-theme-info, #8b5cf6); }
    &.img-color { color: var(--b3-theme-warning, #f97316); }
    &.bookmark-color { color: var(--b3-theme-warning, #eab308); }
    &.no-bookmark-color { color: var(--b3-theme-on-surface-variant, #9ca3af); }
    &.none-bookmark-color { color: var(--b3-theme-on-surface-variant, #6b7280); }
    &.pending-color { color: var(--b3-theme-warning, #f59e0b); }
    &.published-color { color: var(--b3-theme-success, #22c55e); }
    &.unused-color { color: var(--b3-theme-on-surface-variant, #9ca3af); }
    &.full-publish-color { color: var(--b3-theme-success, #22c55e); }
    &.partial-publish-color { color: var(--b3-theme-warning, #f59e0b); }
    &.no-publish-color { color: var(--b3-theme-on-surface-variant, #9ca3af); }
  }

  .card-unit {
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 2px;
    white-space: nowrap;
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .card-percent {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--b3-theme-primary);
    opacity: 0.15;
    border-radius: 0 0 6px 6px;
    transition: width 0.3s ease;
  }

  .card-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-top: 3px;
    border: none;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    cursor: pointer;
    font-size: 11px;
    position: relative;
    z-index: 1;

    &:hover { opacity: 0.85; }
  }
}

// ============ 深度分布图（水平条） ============
.depth-chart-v2 {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.depth-bar-v2 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.depth-bar-label {
  width: 18px;
  font-size: 10px;
  font-weight: 600;
  font-family: $da-mono;
  color: var(--b3-theme-on-surface-variant);
  text-align: right;
  flex-shrink: 0;
}

.depth-bar-track {
  flex: 1;
  height: 12px;
  border-radius: 6px;
  background: var(--b3-theme-surface-light);
  overflow: hidden;
}

.depth-bar-fill {
  height: 100%;
  border-radius: 6px;
  background: var(--b3-theme-primary);
  opacity: 0.6;
  min-width: 4px;
  transition: width 0.3s ease;
}

.depth-bar-count {
  width: 24px;
  font-size: 10px;
  font-family: $da-mono;
  color: var(--b3-theme-on-surface-variant);
  flex-shrink: 0;
}

// ============ 占位状态 ============
.stats-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 13px;
  gap: 8px;

  .placeholder-icon {
    font-size: 40px;
    opacity: 0.3;
  }

  p { margin: 0; }
}

// ============ 书签详情按钮 ============
.bookmark-detail-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 3px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
  }
}

// ============ 书签详情弹出面板 ============
.bookmark-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-detail-panel {
  width: 400px;
  max-width: 92vw;
  max-height: 70vh;
  background: var(--b3-theme-background);
  border-radius: $da-radius;
  border: 1px solid var(--b3-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bookmark-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--b3-border-color);

  .bookmark-detail-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--b3-border-color);
    border-radius: $da-radius;
    background: transparent;
    color: var(--b3-theme-on-surface-variant);
    cursor: pointer;
    font-size: 18px;

    &:hover {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
    }
  }
}

.bookmark-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-scroll-color);
    border-radius: 3px;
  }
}

.bookmark-detail-loading,
.bookmark-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 14px;

  .empty-icon {
    font-size: 36px;
    opacity: 0.4;
  }

  .spin-icon {
    font-size: 28px;
    animation: spin 1s linear infinite;
    color: var(--b3-theme-primary);
  }
}

.bookmark-detail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bookmark-detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--b3-border-color);
  border-radius: $da-radius;
  background: transparent;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  text-align: left;
  font-size: 14px;

  &:hover {
    background: var(--b3-list-hover);
  }

  .bd-item-left {
    flex: 1;
    min-width: 0;
  }

  .bd-item-name {
    font-weight: 500;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bd-item-count {
    font-size: 12px;
    font-family: $da-mono;
    color: var(--b3-theme-on-surface-variant);
    background: var(--b3-theme-surface-light);
    padding: 2px 8px;
    border-radius: $da-radius;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .bd-item-arrow {
    font-size: 16px;
    color: var(--b3-theme-on-surface-variant);
    opacity: 0.5;
    flex-shrink: 0;
  }
}
</style>
