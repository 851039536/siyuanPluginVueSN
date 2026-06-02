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
      <!-- 总览概览条 -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-value">{{ stats.totalDocs }}</span>
          <span class="summary-unit">总文档</span>
        </div>
        <div class="summary-item warn">
          <span class="summary-value">{{ stats.zeroByteDocs }}</span>
          <span class="summary-unit">0B空</span>
        </div>
        <div class="summary-item accent">
          <span class="summary-value">{{ stats.duplicateNameDocs }}</span>
          <span class="summary-unit">重名</span>
        </div>
        <div class="summary-item pending">
          <span class="summary-value">{{ stats.pendingPublishDocs }}</span>
          <span class="summary-unit">待发布</span>
        </div>
      </div>

      <!-- 大小分布 -->
      <div class="stat-section">
        <div class="section-header">
          <Icon icon="mdi:harddisk" />大小分布
        </div>
        <div class="section-cards">
          <div
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
        <div class="section-header">
          <Icon icon="mdi:clock-outline" />更新时间
        </div>
        <div class="section-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === '7days' }"
            @click="$emit('select-category', '7days')"
          >
            <span class="card-value time-green">{{ stats.updatedIn7Days }}</span>
            <span class="card-unit">7天内</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === '30days' }"
            @click="$emit('select-category', '30days')"
          >
            <span class="card-value time-yellow">{{ stats.updatedIn30Days }}</span>
            <span class="card-unit">7~30天</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === '1to2month' }"
            @click="$emit('select-category', '1to2month')"
          >
            <span class="card-value time-cyan">{{ stats.updatedIn1To2Months }}</span>
            <span class="card-unit">1~2月</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === '2to3month' }"
            @click="$emit('select-category', '2to3month')"
          >
            <span class="card-value time-orange">{{ stats.updatedIn2To3Months }}</span>
            <span class="card-unit">2~3月</span>
          </div>
          <div
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
        <div class="section-header">
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
        <div class="section-cards">
          <div
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
            class="stat-card"
            :class="{ active: activeFilter === 'published' }"
            @click="$emit('select-category', 'published')"
          >
            <span class="card-value published-color">{{ stats.publishedDocs }}</span>
            <span class="card-unit">已发布</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'unused' }"
            @click="$emit('select-category', 'unused')"
          >
            <span class="card-value unused-color">{{ stats.unusedDocs }}</span>
            <span class="card-unit">不使用</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'noneBookmark' }"
            @click="$emit('select-category', 'noneBookmark')"
          >
            <span class="card-value none-bookmark-color">{{ stats.noneBookmarkDocs }}</span>
            <span class="card-unit">无</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'hasBookmark' }"
            @click="$emit('select-category', 'hasBookmark')"
          >
            <span class="card-value bookmark-color">{{ stats.bookmarkedDocs }}</span>
            <span class="card-unit">有书签</span>
          </div>
          <div
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
        <div class="section-header">
          <Icon icon="mdi:cloud-check-outline" />发布状态
        </div>
        <div class="section-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'fullPublish' }"
            @click="$emit('select-category', 'fullPublish')"
          >
            <span class="card-value full-publish-color">{{ stats.fullPublishDocs }}</span>
            <span class="card-unit">完整发布</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'partialPublish' }"
            @click="$emit('select-category', 'partialPublish')"
          >
            <span class="card-value partial-publish-color">{{ stats.partialPublishDocs }}</span>
            <span class="card-unit">部分发布</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'noPublish' }"
            @click="$emit('select-category', 'noPublish')"
          >
            <span class="card-value no-publish-color">{{ stats.noPublishDocs }}</span>
            <span class="card-unit">未发布</span>
          </div>
        </div>
      </div>

      <!-- 结构分析 -->
      <div class="stat-section">
        <div class="section-header">
          <Icon icon="mdi:sitemap-outline" />结构
        </div>
        <div class="section-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'deep' }"
            @click="$emit('select-category', 'deep')"
          >
            <span class="card-value depth-color">{{ stats.deepDocs }}</span>
            <span class="card-unit">深层≥5</span>
          </div>
          <div
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
      <div class="stat-section">
        <div class="section-header">
          <Icon icon="mdi:star-outline" />内容质量
        </div>
        <div class="section-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'hasTag' }"
            @click="$emit('select-category', 'hasTag')"
          >
            <span class="card-value time-green">{{ stats.taggedDocs }}</span>
            <span class="card-unit">有标签</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'noTag' }"
            @click="$emit('select-category', 'noTag')"
          >
            <span class="card-value time-red">{{ totalDocs - stats.taggedDocs }}</span>
            <span class="card-unit">无标签</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'hasAlias' }"
            @click="$emit('select-category', 'hasAlias')"
          >
            <span class="card-value time-cyan">{{ stats.aliasedDocs }}</span>
            <span class="card-unit">有别名</span>
          </div>
          <div
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
      <div class="stat-section">
        <div class="section-header">
          <Icon icon="mdi:graph-outline" />引用拓扑
        </div>
        <div class="section-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'hasRef' }"
            @click="$emit('select-category', 'hasRef')"
          >
            <span class="card-value ref-color">{{ stats.refDocs }}</span>
            <span class="card-unit">含引用({{ stats.totalRefs }})</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'incomingRef' }"
            @click="$emit('select-category', 'incomingRef')"
          >
            <span class="card-value time-cyan">{{ stats.incomingRefDocs }}</span>
            <span class="card-unit">被引用</span>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'orphanDoc' }"
            @click="$emit('select-category', 'orphanDoc')"
          >
            <span class="card-value zero">{{ stats.orphanDocs }}</span>
            <span class="card-unit">孤文档</span>
          </div>
        </div>
      </div>

      <!-- 深度分布图 -->
      <div
        v-if="depthStats.depthDistribution.length > 0"
        class="stat-section"
      >
        <div class="section-header">
          <Icon icon="mdi:chart-bar" />深度分布
          <span class="section-hint">均 {{ depthStats.avgDepth }} 层 · 最深 {{ depthStats.maxDepth }} 层</span>
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
      @click.self="closeBookmarkDetail"
    >
      <div class="bookmark-detail-panel">
        <div class="bookmark-detail-header">
          <span class="bookmark-detail-title">
            <Icon icon="mdi:bookmark-outline" />
            全部书签
          </span>
          <button
            class="close-btn"
            @click="closeBookmarkDetail"
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

const emit = defineEmits<{
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

function closeBookmarkDetail() {
  // 通过再次触发相同事件来让 composable 关闭面板
  // 此处通知父组件关闭，由 composable 的 bookmarkDetailVisible 控制
  emit("show-bookmark-details")
}

const totalDocs = computed(() => props.stats.totalDocs)

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
    border: none;
    border-radius: 5px;
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

// ============ 总览概览条 ============
.summary-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
  padding: 8px 0;
  border-bottom: 2px solid var(--b3-border-color);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 3px;
  border-radius: 8px;
  background: var(--b3-theme-surface);

  .summary-value {
    font-size: 18px;
    font-weight: 800;
    color: var(--b3-theme-on-background);
    line-height: 1;
  }

  .summary-unit {
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 3px;
  }

  &.warn .summary-value { color: var(--b3-theme-error, #ef4444); }
  &.accent .summary-value { color: #a855f7; }
  &.pending .summary-value { color: #f59e0b; }
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
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;

  .section-hint {
    font-weight: 400;
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-left: auto;
  }
}

// ============ 卡片行 ============
.section-cards {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 54px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 5px 6px;
  border-radius: 8px;
  background: var(--b3-theme-surface-light);
  cursor: pointer;
  border: 2px solid transparent;
  overflow: hidden;

  &:hover {
    background: var(--b3-list-hover);
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
    &.dup { color: #a855f7; }
    &.time-green { color: #22c55e; }
    &.time-yellow { color: #f59e0b; }
    &.time-red { color: #ef4444; }
    &.time-cyan { color: #06b6d4; }
    &.time-orange { color: #f97316; }
    &.time-purple { color: #a855f7; }
    &.depth-color { color: #06b6d4; }
    &.ref-color { color: #8b5cf6; }
    &.img-color { color: #f97316; }
    &.bookmark-color { color: #eab308; }
    &.no-bookmark-color { color: #9ca3af; }
    &.none-bookmark-color { color: #6b7280; }
    &.pending-color { color: #f59e0b; }
    &.published-color { color: #22c55e; }
    &.unused-color { color: #9ca3af; }
    &.full-publish-color { color: #22c55e; }
    &.partial-publish-color { color: #f59e0b; }
    &.no-publish-color { color: #9ca3af; }
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
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
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
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--b3-theme-on-surface-variant);
    cursor: pointer;
    font-size: 18px;

    &:hover {
      background: var(--b3-list-hover);
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
  border: none;
  border-radius: 8px;
  background: var(--b3-theme-surface);
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
    color: var(--b3-theme-on-surface-variant);
    background: var(--b3-theme-surface-light);
    padding: 2px 8px;
    border-radius: 10px;
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
