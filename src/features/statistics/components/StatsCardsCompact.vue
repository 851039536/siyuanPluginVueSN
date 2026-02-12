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
  margin-bottom: $spacing-md;

  .stat-card-main {
    @include stats.stats-card-base;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 20px;
    margin-bottom: 12px;
    position: relative;
    background: stats.$gradient-surface;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--b3-theme-primary);
    }

    .stat-item-inline {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;

      .stat-icon {
        font-size: 36px;
        flex-shrink: 0;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
      }

      .stat-content {
        flex: 1;

        .stat-value {
          font-family: $font-heading;
          font-size: 28px;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 4px;
          color: var(--b3-theme-primary);
          letter-spacing: -0.5px;
        }

        .stat-label {
          font-size: 12px;
          font-family: $font-body;
          font-weight: 500;
          color: var(--b3-theme-on-surface);
          opacity: 0.7;
        }
      }
    }

    .stat-divider {
      width: 1px;
      height: 48px;
      background: var(--b3-border-color);
      margin: 0 16px;
      opacity: 0.5;
    }
  }

  .stat-card-secondary {
    @include stats.stats-card-base;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 16px;
    background: var(--b3-theme-surface);

    .stat-item-small {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      position: relative;

      &:not(:last-child)::after {
        content: '';
        position: absolute;
        right: 0;
        top: 20%;
        height: 60%;
        width: 1px;
        background: var(--b3-border-color);
        opacity: 0.5;
      }

      .stat-icon-small {
        font-size: 18px;
        opacity: 0.8;
      }

      .stat-value-small {
        font-family: $font-heading;
        font-size: 18px;
        font-weight: 700;
        color: var(--b3-theme-on-surface);
      }

      .stat-label-small {
        font-size: 10px;
        font-family: $font-body;
        font-weight: 500;
        opacity: 0.6;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }
  }
}

// Mobile responsive
@include mobile-only {
  .stats-cards-compact {
    .stat-card-main {
      flex-direction: column;
      padding: 16px;
      gap: 16px;

      &::before {
        width: 100%;
        height: 4px;
      }

      .stat-divider {
        width: 60%;
        height: 1px;
        margin: 0;
      }

      .stat-item-inline {
        width: 100%;
        justify-content: center;
        text-align: center;
      }
    }

    .stat-card-secondary {
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      .stat-item-small:nth-child(2n)::after {
        display: none;
      }
    }
  }
}
</style>

