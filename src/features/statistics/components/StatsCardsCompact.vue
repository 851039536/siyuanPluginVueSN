<template>
  <div class="stats-cards-compact">
    <!-- 主要统计：笔记和字数 -->
    <div class="stat-card-main">
      <div class="stat-item-inline">
        <span class="stat-icon">📓</span>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(totalNotes) }}</div>
          <div class="stat-label">{{ i18n.totalNotes }}</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item-inline">
        <span class="stat-icon">✍️</span>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(totalWords) }}</div>
          <div class="stat-label">{{ i18n.totalWords }}</div>
        </div>
      </div>
    </div>

    <!-- 次要统计：内容和关系 -->
    <div class="stat-card-secondary">
      <div class="stat-item-small">
        <span class="stat-icon-small">🧩</span>
        <span class="stat-value-small">{{ formatShortNumber(totalBlocks) }}</span>
        <span class="stat-label-small">{{ i18n.totalBlocks }}</span>
      </div>
      <div class="stat-item-small">
        <span class="stat-icon-small">📎</span>
        <span class="stat-value-small">{{ formatShortNumber(totalAssets) }}</span>
        <span class="stat-label-small">{{ i18n.totalAssets }}</span>
      </div>
      <div class="stat-item-small">
        <span class="stat-icon-small">🏷️</span>
        <span class="stat-value-small">{{ formatShortNumber(totalTags) }}</span>
        <span class="stat-label-small">{{ i18n.totalTags }}</span>
      </div>
      <div class="stat-item-small">
        <span class="stat-icon-small">🔗</span>
        <span class="stat-value-small">{{ formatShortNumber(totalBacklinks) }}</span>
        <span class="stat-label-small">{{ i18n.totalBacklinks }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatNumber, formatShortNumber } from '../utils'

interface Props {

  totalNotes?: number
  totalWords?: number
  totalBlocks?: number
  totalAssets?: number
  totalTags?: number
  totalBacklinks?: number
  i18n?: {
    totalNotes: string
    totalWords: string
    totalBlocks: string
    totalAssets: string
    totalTags: string
    totalBacklinks: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  totalNotes: 0,
  totalWords: 0,
  totalBlocks: 0,
  totalAssets: 0,
  totalTags: 0,
  totalBacklinks: 0,
  i18n: () => ({
    totalNotes: '笔记总数',
    totalWords: '总字数',
    totalBlocks: '内容块',
    totalAssets: '附件',
    totalTags: '标签',
    totalBacklinks: '双链',
  }),
})
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

.stats-cards-compact {
  margin-bottom: $spacing-sm;

  .stat-card-main,
  .stat-card-secondary {
    @include stats.stats-card-hover;
    @include stats.stats-theme-border;
    border-radius: stats.$stats-card-radius;
  }

  .stat-card-main {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 12px;
    margin-bottom: 6px;
    background: var(--b3-theme-surface);

    .stat-item-inline {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;

      .stat-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .stat-content {
        flex: 1;

        .stat-value {
          font-family: $font-heading;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 2px;
          color: var(--b3-theme-primary);
        }

        .stat-label {
          font-size: 11px;
          font-family: $font-body;
          opacity: 0.9;
          color: var(--b3-theme-on-surface);
        }
      }
    }

    .stat-divider {
      width: 1px;
      height: 40px;
      background: var(--b3-border-color);
      margin: 0 8px;
    }
  }

  .stat-card-secondary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: stats.$gradient-secondary;
    color: white;

    .stat-item-small {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      justify-content: center;

      .stat-icon-small {
        font-size: 16px;
      }

      .stat-value-small {
        font-family: $font-heading;
        font-size: 16px;
        font-weight: 700;
        color: white;
      }

      .stat-label-small {
        font-size: 10px;
        font-family: $font-body;
        opacity: 0.9;
      }
    }
  }
}


// Mobile responsive
@include mobile-only {
  .stats-cards-compact .stat-card-main {
    flex-direction: column;
    text-align: center;

    .stat-divider {
      width: 40px;
      height: 1px;
      margin: 8px 0;
    }

    .stat-item-inline {
      justify-content: center;
    }
  }
}
</style>
