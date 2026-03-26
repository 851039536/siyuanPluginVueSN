<template>
  <div class="stats-cards-compact">
    <!-- 主要统计：笔记、字数、今日动态 -->
    <div class="stat-card-main">
      <!-- 核心数据：笔记总数、总字数 -->
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
      <div class="stat-divider"></div>
      <!-- 今日动态 -->
      <div class="stat-item-inline compact">
        <span class="stat-icon-small">📅</span>
        <div class="stat-content-compact">
          <div class="stat-value-row">
            <span class="stat-value-small">{{ todayCreated }}</span>
            <span
              v-if="createdChange !== null"
              class="change-badge"
              :class="getChangeClass(createdChange)"
            >
              {{ getChangeArrow(createdChange) }}{{ formatPercent(createdChange) }}
            </span>
          </div>
          <div class="stat-label-tiny">{{ i18n.todayCreated }}</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item-inline compact">
        <span class="stat-icon-small">✏️</span>
        <div class="stat-content-compact">
          <div class="stat-value-row">
            <span class="stat-value-small">{{ todayModified }}</span>
            <span
              v-if="modifiedChange !== null"
              class="change-badge"
              :class="getChangeClass(modifiedChange)"
            >
              {{ getChangeArrow(modifiedChange) }}{{ formatPercent(modifiedChange) }}
            </span>
          </div>
          <div class="stat-label-tiny">{{ i18n.todayModified }}</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item-inline compact">
        <span class="stat-icon-small">📊</span>
        <div class="stat-content-compact">
          <div class="stat-value-small">{{ avgWordsPerDoc }}</div>
          <div class="stat-label-tiny">{{ i18n.avgWordsPerDoc }}</div>
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
        <span class="stat-icon-small">🖼️</span>
        <span class="stat-value-small">{{ formatShortNumber(totalImages) }}</span>
        <span class="stat-label-small">{{ i18n.totalImages }}</span>
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
  totalImages?: number
  totalTags?: number
  totalBacklinks?: number
  todayCreated?: number
  todayModified?: number
  avgWordsPerDoc?: number
  createdChange?: number | null
  modifiedChange?: number | null
  i18n?: {
    totalNotes: string
    totalWords: string
    totalBlocks: string
    totalAssets: string
    totalImages: string
    totalTags: string
    totalBacklinks: string
    todayCreated: string
    todayModified: string
    avgWordsPerDoc: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  totalNotes: 0,
  totalWords: 0,
  totalBlocks: 0,
  totalAssets: 0,
  totalImages: 0,
  totalTags: 0,
  totalBacklinks: 0,
  todayCreated: 0,
  todayModified: 0,
  avgWordsPerDoc: 0,
  createdChange: null,
  modifiedChange: null,
  i18n: () => ({
    totalNotes: '笔记总数',
    totalWords: '总字数',
    totalBlocks: '内容块',
    totalAssets: '附件',
    totalImages: '图片',
    totalTags: '标签',
    totalBacklinks: '双链',
    todayCreated: '今日新增',
    todayModified: '今日修改',
    avgWordsPerDoc: '平均字数',
  }),
})

function getChangeClass(change: number | null): string {
  if (change === null || change === 0) return 'neutral'
  return change > 0 ? 'positive' : 'negative'
}

function getChangeArrow(change: number | null): string {
  if (change === null || change === 0) return ''
  return change > 0 ? '↑' : '↓'
}

function formatPercent(change: number | null): string {
  if (change === null) return ''
  return Math.abs(change).toFixed(0) + '%'
}
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

$github-green: #2da44e;
$github-red: #cf222e;

.stats-cards-compact {
  .stat-card-main {
    @include stats.stats-card-base;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    margin-bottom: 8px;
    position: relative;
    background: stats.$gradient-surface;
    gap: 8px;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: var(--b3-theme-primary);
    }

    .stat-item-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      &.compact {
        flex: 0.8;
        justify-content: center;
      }

      .stat-icon {
        font-size: 24px;
        flex-shrink: 0;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
      }

      .stat-icon-small {
        font-size: 16px;
        flex-shrink: 0;
      }

      .stat-content {
        flex: 1;

        .stat-value {
          font-family: $font-heading;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 2px;
          color: var(--b3-theme-primary);
          letter-spacing: -0.3px;
        }

        .stat-label {
          font-size: 10px;
          font-family: $font-body;
          font-weight: 500;
          color: var(--b3-theme-on-surface);
          opacity: 0.6;
        }
      }

      .stat-content-compact {
        text-align: center;

        .stat-value-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .stat-value-small {
          font-family: $font-heading;
          font-size: 16px;
          font-weight: 700;
          color: var(--b3-theme-primary);
        }

        .stat-label-tiny {
          font-size: 9px;
          color: var(--b3-theme-on-surface);
          opacity: 0.5;
          margin-top: 2px;
        }

        .change-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 4px;
          border-radius: 8px;
          font-size: 8px;
          font-weight: 700;

          &.positive {
            background: rgba($github-green, 0.15);
            color: $github-green;
          }

          &.negative {
            background: rgba($github-red, 0.15);
            color: $github-red;
          }
        }
      }
    }

    .stat-divider {
      width: 1px;
      height: 28px;
      background: var(--b3-border-color);
      opacity: 0.3;
      flex-shrink: 0;
    }
  }

  .stat-card-secondary {
    @include stats.stats-card-base;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 8px 10px;
    background: var(--b3-theme-surface);

    .stat-item-small {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      position: relative;

      &:not(:last-child)::after {
        content: '';
        position: absolute;
        right: 0;
        top: 25%;
        height: 50%;
        width: 1px;
        background: var(--b3-border-color);
        opacity: 0.4;
      }

      .stat-icon-small {
        font-size: 13px;
        opacity: 0.7;
      }

      .stat-value-small {
        font-family: $font-heading;
        font-size: 13px;
        font-weight: 700;
        color: var(--b3-theme-on-surface);
      }

      .stat-label-small {
        font-size: 9px;
        font-family: $font-body;
        font-weight: 500;
        opacity: 0.5;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
    }
  }
}

// Mobile responsive
@include mobile-only {
  .stats-cards-compact {
    .stat-card-main {
      flex-wrap: wrap;
      padding: 12px;
      gap: 10px;

      &::before {
        width: 100%;
        height: 3px;
      }

      .stat-item-inline {
        flex: 1 1 45%;
        min-width: 100px;

        &.compact {
          flex: 1 1 30%;
          min-width: 80px;
        }
      }

      .stat-divider {
        display: none;
      }
    }

    .stat-card-secondary {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;

      .stat-item-small:nth-child(3n)::after {
        display: none;
      }
    }
  }
}
</style>

