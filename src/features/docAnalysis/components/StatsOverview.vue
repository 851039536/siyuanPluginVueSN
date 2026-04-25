<template>
  <div class="stats-overview">
    <div class="stats-header">
      <span class="stats-title">文档统计概览</span>
      <button class="analyze-btn" :disabled="loading" @click="$emit('analyze')">
        <Icon :icon="loading ? 'mdi:loading' : 'mdi:chart-bar'" :class="{ 'spin-icon': loading }" />
        {{ loading ? '分析中...' : '分析' }}
      </button>
    </div>

    <template v-if="hasAnalyzed">
      <!-- 大小统计 -->
      <div class="stats-section">
        <div class="section-label">
          <Icon icon="mdi:harddisk" class="section-icon" />
          大小分布
        </div>
        <div class="stats-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === '0B' }"
            @click="$emit('select-category', '0B')"
          >
            <div class="stat-value zero">{{ stats.zeroByteDocs }}</div>
            <div class="stat-label">0B 空文档</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'small' }"
            @click="$emit('select-category', 'small')"
          >
            <div class="stat-value small">{{ stats.smallDocs }}</div>
            <div class="stat-label">&lt; 1KB</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'medium' }"
            @click="$emit('select-category', 'medium')"
          >
            <div class="stat-value medium">{{ stats.mediumDocs }}</div>
            <div class="stat-label">1~10KB</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'duplicate' }"
            @click="$emit('select-category', 'duplicate')"
          >
            <div class="stat-value dup">{{ stats.duplicateNameDocs }}</div>
            <div class="stat-label">重名 ({{ stats.duplicateNameGroups }}组)</div>
          </div>
          <div class="stat-card total">
            <div class="stat-value">{{ stats.totalDocs }}</div>
            <div class="stat-label">总文档数</div>
          </div>
        </div>
      </div>

      <!-- 更新时间统计 -->
      <div class="stats-section">
        <div class="section-label">
          <Icon icon="mdi:clock-outline" class="section-icon" />
          更新时间
        </div>
        <div class="stats-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === '7days' }"
            @click="$emit('select-category', '7days')"
          >
            <div class="stat-value time-green">{{ stats.updatedIn7Days }}</div>
            <div class="stat-label">7天内</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === '30days' }"
            @click="$emit('select-category', '30days')"
          >
            <div class="stat-value time-yellow">{{ stats.updatedIn30Days }}</div>
            <div class="stat-label">7~30天</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'halfYear' }"
            @click="$emit('select-category', 'halfYear')"
          >
            <div class="stat-value time-red">{{ stats.updatedOverHalfYear }}</div>
            <div class="stat-label">半年以上</div>
          </div>
        </div>
      </div>

      <!-- 深度/引用/图片统计 -->
      <div class="stats-section">
        <div class="section-label">
          <Icon icon="mdi:sitemap-outline" class="section-icon" />
          结构分析
        </div>
        <div class="stats-cards">
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'deep' }"
            @click="$emit('select-category', 'deep')"
          >
            <div class="stat-value depth-color">{{ stats.deepDocs }}</div>
            <div class="stat-label">深层文档 (≥5层)</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'hasRef' }"
            @click="$emit('select-category', 'hasRef')"
          >
            <div class="stat-value ref-color">{{ stats.refDocs }}</div>
            <div class="stat-label">含引用 ({{ stats.totalRefs }})</div>
          </div>
          <div
            class="stat-card"
            :class="{ active: activeFilter === 'hasImage' }"
            @click="$emit('select-category', 'hasImage')"
          >
            <div class="stat-value img-color">{{ stats.imageDocs }}</div>
            <div class="stat-label">含图片 ({{ stats.totalImages }})</div>
          </div>
        </div>
      </div>

      <!-- 深度分布迷你图 -->
      <div class="stats-section" v-if="depthStats.depthDistribution.length > 0">
        <div class="section-label">
          <Icon icon="mdi:chart-bar" class="section-icon" />
          深度分布（平均 {{ stats.avgDepth }} 层，最深 {{ stats.maxDepth }} 层）
        </div>
        <div class="depth-chart">
          <div
            v-for="item in depthStats.depthDistribution"
            :key="item.depth"
            class="depth-bar-item"
          >
            <div
              class="depth-bar"
              :style="{ height: getBarHeight(item.count) + '%' }"
              :title="`${item.depth} 层: ${item.count} 篇`"
            ></div>
            <span class="depth-label">{{ item.depth }}</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="stats-placeholder">
      <Icon icon="mdi:chart-box-outline" class="placeholder-icon" />
      <p>点击「分析」查看文档统计</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import type { DocStats, DepthStats } from "../types/index";

interface Props {
  stats: DocStats;
  loading: boolean;
  hasAnalyzed: boolean;
  activeFilter: string;
  depthStats: DepthStats;
}

const props = defineProps<Props>();

defineEmits<{
  (e: "analyze"): void;
  (e: "select-category", category: string): void;
}>();

/** 计算深度分布柱状图高度 */
const maxCount = computed(() => {
  const counts = props.depthStats.depthDistribution.map((d) => d.count);
  return Math.max(...counts, 1);
});

function getBarHeight(count: number): number {
  return Math.max((count / maxCount.value) * 100, 3);
}
</script>

<style lang="scss" scoped>
.stats-overview {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .stats-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .analyze-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-size: 13px;
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

.stats-section {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-bottom: 6px;
  font-weight: 500;

  .section-icon {
    font-size: 14px;
    opacity: 0.7;
  }
}

.stats-cards {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  border-radius: 8px;
  background: var(--b3-theme-surface-light);
  cursor: pointer;
  border: 2px solid transparent;
  flex: 1;
  min-width: 60px;

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

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--b3-theme-on-background);
    line-height: 1.2;

    &.zero {
      color: var(--b3-theme-error, #ef4444);
    }

    &.small {
      color: var(--b3-theme-warning, #f59e0b);
    }

    &.medium {
      color: var(--b3-theme-info, #3b82f6);
    }

    &.dup {
      color: #a855f7;
    }

    &.time-green {
      color: #22c55e;
    }

    &.time-yellow {
      color: #f59e0b;
    }

    &.time-red {
      color: #ef4444;
    }

    &.depth-color {
      color: #06b6d4;
    }

    &.ref-color {
      color: #8b5cf6;
    }

    &.img-color {
      color: #f97316;
    }
  }

  .stat-label {
    font-size: 10px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 2px;
    white-space: nowrap;
    text-align: center;
  }
}

.depth-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 50px;
  padding: 4px 0;

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
    min-height: 3px;
    background: var(--b3-theme-primary);
    opacity: 0.6;
    border-radius: 2px 2px 0 0;

    &:hover {
      opacity: 1;
    }
  }

  .depth-label {
    font-size: 9px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 2px;
  }
}

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
</style>
