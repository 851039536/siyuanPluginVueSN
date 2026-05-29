<template>
  <div class="stats-overview">
    <div
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

    <template v-if="hasAnalyzed && !isCollapsed">
      <div class="stats-grid">
        <!-- 大小分布 -->
        <div class="grid-section">
          <span class="grid-section-label"><Icon
            icon="mdi:harddisk"
            class="section-icon-sm"
          />大小分布</span>
          <div class="stats-cards">
            <div
              class="stat-card"
              :class="{ active: activeFilter === '0B' }"
              @click="$emit('select-category', '0B')"
            >
              <span class="stat-value zero">{{ stats.zeroByteDocs }}</span>
              <span class="stat-label">0B空</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'small' }"
              @click="$emit('select-category', 'small')"
            >
              <span class="stat-value small">{{ stats.smallDocs }}</span>
              <span class="stat-label">&lt;1KB</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'medium' }"
              @click="$emit('select-category', 'medium')"
            >
              <span class="stat-value medium">{{ stats.mediumDocs }}</span>
              <span class="stat-label">1~10KB</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'duplicate' }"
              @click="$emit('select-category', 'duplicate')"
            >
              <span class="stat-value dup">{{ stats.duplicateNameDocs }}</span>
              <span class="stat-label">重名({{ stats.duplicateNameGroups }})</span>
            </div>
            <div class="stat-card total">
              <span class="stat-value">{{ stats.totalDocs }}</span>
              <span class="stat-label">总文档</span>
            </div>
          </div>
        </div>

        <!-- 更新时间 -->
        <div class="grid-section">
          <span class="grid-section-label"><Icon
            icon="mdi:clock-outline"
            class="section-icon-sm"
          />更新时间</span>
          <div class="stats-cards">
            <div
              class="stat-card"
              :class="{ active: activeFilter === '7days' }"
              @click="$emit('select-category', '7days')"
            >
              <span class="stat-value time-green">{{ stats.updatedIn7Days }}</span>
              <span class="stat-label">7天内</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === '30days' }"
              @click="$emit('select-category', '30days')"
            >
              <span class="stat-value time-yellow">{{ stats.updatedIn30Days }}</span>
              <span class="stat-label">7~30天</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === '1to2month' }"
              @click="$emit('select-category', '1to2month')"
            >
              <span class="stat-value time-cyan">{{ stats.updatedIn1To2Months }}</span>
              <span class="stat-label">1~2月</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === '2to3month' }"
              @click="$emit('select-category', '2to3month')"
            >
              <span class="stat-value time-orange">{{ stats.updatedIn2To3Months }}</span>
              <span class="stat-label">2~3月</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'halfYear' }"
              @click="$emit('select-category', 'halfYear')"
            >
              <span class="stat-value time-red">{{ stats.updatedOverHalfYear }}</span>
              <span class="stat-label">半年+</span>
            </div>
            <div
              class="stat-card custom-time-card"
              :class="{ active: activeFilter === 'customTime' }"
              @click="$emit('select-category', 'customTime')"
            >
              <span class="stat-value time-purple"><Icon
                icon="mdi:calendar-range"
                class="custom-time-icon"
              /></span>
              <span class="stat-label">自定义</span>
            </div>
          </div>
        </div>

        <!-- 书签 -->
        <div class="grid-section">
          <span class="grid-section-label">
            <Icon
              icon="mdi:bookmark-outline"
              class="section-icon-sm"
            />书签
            <button
              class="bookmark-detail-btn"
              title="查看全部书签"
              @click.stop="$emit('show-bookmark-details')"
            >
              <Icon
                icon="mdi:format-list-bulleted"
                :size="12"
              />
              详情
            </button>
          </span>
          <div class="stats-cards">
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'pendingPublish' }"
              @click="$emit('select-category', 'pendingPublish')"
            >
              <span class="stat-value pending-color">{{ stats.pendingPublishDocs }}</span>
              <span class="stat-label">待发布</span>
              <button
                v-if="stats.pendingPublishDocs > 0"
                class="stat-action-btn"
                title="批量发布待发布文档"
                @click.stop="$emit('batch-publish', 'pendingPublish')"
              >
                <Icon
                  icon="mdi:publish"
                  class="stat-action-icon"
                />
              </button>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'published' }"
              @click="$emit('select-category', 'published')"
            >
              <span class="stat-value published-color">{{ stats.publishedDocs }}</span>
              <span class="stat-label">已发布</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'unused' }"
              @click="$emit('select-category', 'unused')"
            >
              <span class="stat-value unused-color">{{ stats.unusedDocs }}</span>
              <span class="stat-label">不使用</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'noneBookmark' }"
              @click="$emit('select-category', 'noneBookmark')"
            >
              <span class="stat-value none-bookmark-color">{{ stats.noneBookmarkDocs }}</span>
              <span class="stat-label">无</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'hasBookmark' }"
              @click="$emit('select-category', 'hasBookmark')"
            >
              <span class="stat-value bookmark-color">{{ stats.bookmarkedDocs }}</span>
              <span class="stat-label">有书签</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'noBookmark' }"
              @click="$emit('select-category', 'noBookmark')"
            >
              <span class="stat-value no-bookmark-color">{{ stats.noBookmarkDocs }}</span>
              <span class="stat-label">无书签</span>
            </div>
          </div>
        </div>

        <!-- 发布状态 -->
        <div class="grid-section">
          <span class="grid-section-label"><Icon
            icon="mdi:cloud-check-outline"
            class="section-icon-sm"
          />发布状态</span>
          <div class="stats-cards">
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'fullPublish' }"
              @click="$emit('select-category', 'fullPublish')"
            >
              <span class="stat-value full-publish-color">{{ stats.fullPublishDocs }}</span>
              <span class="stat-label">完整发布</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'partialPublish' }"
              @click="$emit('select-category', 'partialPublish')"
            >
              <span class="stat-value partial-publish-color">{{ stats.partialPublishDocs }}</span>
              <span class="stat-label">部分发布</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'noPublish' }"
              @click="$emit('select-category', 'noPublish')"
            >
              <span class="stat-value no-publish-color">{{ stats.noPublishDocs }}</span>
              <span class="stat-label">未发布</span>
            </div>
          </div>
        </div>

        <!-- 结构分析 -->
        <div class="grid-section">
          <span class="grid-section-label"><Icon
            icon="mdi:sitemap-outline"
            class="section-icon-sm"
          />结构</span>
          <div class="stats-cards">
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'deep' }"
              @click="$emit('select-category', 'deep')"
            >
              <span class="stat-value depth-color">{{ stats.deepDocs }}</span>
              <span class="stat-label">深层≥5</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'hasRef' }"
              @click="$emit('select-category', 'hasRef')"
            >
              <span class="stat-value ref-color">{{ stats.refDocs }}</span>
              <span class="stat-label">引用({{ stats.totalRefs }})</span>
            </div>
            <div
              class="stat-card"
              :class="{ active: activeFilter === 'hasImage' }"
              @click="$emit('select-category', 'hasImage')"
            >
              <span class="stat-value img-color">{{ stats.imageDocs }}</span>
              <span class="stat-label">图片({{ stats.totalImages }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 深度分布迷你图 -->
      <div
        v-if="depthStats.depthDistribution.length > 0"
        class="depth-chart-wrap"
      >
        <span class="depth-chart-label">深度分布（均 {{ depthStats.avgDepth }} 层，最深 {{ depthStats.maxDepth }} 层）</span>
        <div class="depth-chart">
          <div
            v-for="item in depthStats.depthDistribution"
            :key="item.depth"
            class="depth-bar-item"
          >
            <div
              class="depth-bar"
              :style="{ height: `${getBarHeight(item.count)}%` }"
              :title="`${item.depth} 层: ${item.count} 篇`"
            ></div>
            <span class="depth-label">{{ item.depth }}</span>
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
}

const props = defineProps<Props>()

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

/** 计算深度分布柱状图高度 */
const maxCount = computed(() => {
  const counts = props.depthStats.depthDistribution.map((d) => d.count)
  return Math.max(...counts, 1)
})

function getBarHeight(count: number): number {
  return Math.max((count / maxCount.value) * 100, 3)
}
</script>

<style lang="scss" scoped>
.stats-overview {
  padding: 8px 14px;
  border-bottom: 1px solid var(--b3-border-color);
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

    &:hover:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  }
}

// ============ 紧凑网格布局 ============
.stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.grid-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1 1 auto;
  min-width: 140px;
}

.grid-section-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
  line-height: 1;

  .section-icon-sm {
    font-size: 12px;
    opacity: 0.65;
    flex-shrink: 0;
  }
}

// ============ 统计卡片（紧凑版） ============
.stats-cards {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 5px;
  border-radius: 6px;
  background: var(--b3-theme-surface-light);
  cursor: pointer;
  border: 2px solid transparent;
  flex: 1;
  min-width: 48px;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
  }

  &.total {
    cursor: default;
    background: var(--b3-theme-surface);
  }

  &.custom-time-card {
    cursor: pointer;

    .custom-time-icon {
      font-size: 15px;
    }
  }

  .stat-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--b3-theme-on-background);
    line-height: 1.15;

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

  .stat-label {
    font-size: 9px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 1px;
    white-space: nowrap;
    text-align: center;
  }

  .stat-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    cursor: pointer;
    font-size: 10px;
    margin-top: 2px;

    &:hover {
      opacity: 0.85;
    }

    .stat-action-icon {
      font-size: 11px;
    }
  }
}

.platform-gap-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface-variant);

  .gap-label {
    color: var(--b3-theme-on-surface-variant);
    opacity: 0.6;
    margin-right: 2px;
  }

  .gap-item {
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.12);
    color: #b45309;
    white-space: nowrap;
  }
}

// ============ 深度分布图（紧凑版） ============
.depth-chart-wrap {
  margin-top: 6px;
}

.depth-chart-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  font-weight: 500;
}

.depth-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 32px;
  padding: 2px 0;
  margin-top: 3px;

  .depth-bar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
  }

  .depth-bar {
    width: 100%;
    min-height: 2px;
    background: var(--b3-theme-primary);
    opacity: 0.6;
    border-radius: 2px 2px 0 0;

    &:hover {
      opacity: 1;
    }
  }

  .depth-label {
    font-size: 8px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 1px;
  }
}

// ============ 占位状态 ============
.stats-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  color: var(--b3-theme-on-surface-variant);
  font-size: 13px;
  gap: 6px;

  .placeholder-icon {
    font-size: 36px;
    opacity: 0.35;
  }

  p {
    margin: 0;
  }
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
