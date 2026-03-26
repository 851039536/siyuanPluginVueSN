<template>
  <div class="extended-stats-cards">
    <div class="stat-card-small">
      <div class="card-icon">📅</div>
      <div class="card-content">
        <div class="card-value-row">
          <div class="card-value-small">{{ todayCreated }}</div>
          <div
            v-if="createdChange !== null && createdChange !== undefined"
            class="change-badge"
            :class="getChangeClass(createdChange)"
          >
            <span class="change-arrow">{{ getChangeArrow(createdChange) }}</span>
            <span class="change-value">{{ formatPercent(createdChange) }}</span>
          </div>
        </div>
        <div class="card-label-small">{{ i18n.todayCreated }}</div>
        <div v-if="yesterdayCreated !== null" class="compare-hint">
          {{ i18n.vsYesterday }} {{ yesterdayCreated }}
        </div>
      </div>
    </div>
    <div class="stat-card-small">
      <div class="card-icon">✏️</div>
      <div class="card-content">
        <div class="card-value-row">
          <div class="card-value-small">{{ todayModified }}</div>
          <div
            v-if="modifiedChange !== null && modifiedChange !== undefined"
            class="change-badge"
            :class="getChangeClass(modifiedChange)"
          >
            <span class="change-arrow">{{ getChangeArrow(modifiedChange) }}</span>
            <span class="change-value">{{ formatPercent(modifiedChange) }}</span>
          </div>
        </div>
        <div class="card-label-small">{{ i18n.todayModified }}</div>
        <div v-if="yesterdayModified !== null" class="compare-hint">
          {{ i18n.vsYesterday }} {{ yesterdayModified }}
        </div>
      </div>
    </div>
    <div class="stat-card-small">
      <div class="card-icon">📊</div>
      <div class="card-content">
        <div class="card-value-small">{{ avgWordsPerDoc }}</div>
        <div class="card-label-small">{{ i18n.avgWordsPerDoc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  todayCreated?: number
  todayModified?: number
  avgWordsPerDoc?: number
  yesterdayCreated?: number | null
  yesterdayModified?: number | null
  createdChange?: number | null
  modifiedChange?: number | null
  i18n?: {
    todayCreated: string
    todayModified: string
    avgWordsPerDoc: string
    vsYesterday: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  todayCreated: 0,
  todayModified: 0,
  avgWordsPerDoc: 0,
  yesterdayCreated: null,
  yesterdayModified: null,
  createdChange: null,
  modifiedChange: null,
  i18n: () => ({
    todayCreated: '今日新增',
    todayModified: '今日修改',
    avgWordsPerDoc: '平均字数',
    vsYesterday: '较昨日',
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
  return Math.abs(change).toFixed(1) + '%'
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

$github-green: #2da44e;
$github-red: #cf222e;

.extended-stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  .stat-card-small {
    @include stats.stats-card-base;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);

    .card-icon {
      font-size: 20px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--b3-theme-background);
      border-radius: 8px;
      flex-shrink: 0;
      transition: stats.$stats-transition;
    }

    &:hover .card-icon {
      background: var(--b3-theme-primary-lighter, rgba(var(--b3-theme-primary-rgb), 0.1));
      transform: scale(1.05);
    }

    .card-content {
      flex: 1;
      min-width: 0;

      .card-value-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
      }

      .card-value-small {
        font-family: $font-heading;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.1;
        color: var(--b3-theme-primary);
      }

      .change-badge {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 1px 5px;
        border-radius: 10px;
        font-size: 9px;
        font-weight: 700;
        font-family: $font-heading;

        &.positive {
          background: rgba($github-green, 0.15);
          color: $github-green;
        }

        &.negative {
          background: rgba($github-red, 0.15);
          color: $github-red;
        }

        &.neutral {
          background: rgba(var(--b3-theme-on-surface-rgb), 0.08);
          color: var(--b3-theme-on-surface);
          opacity: 0.6;
        }

        .change-arrow {
          font-size: 8px;
        }
      }

      .card-label-small {
        font-size: 10px;
        font-family: $font-body;
        font-weight: 500;
        opacity: 0.5;
        @include text-ellipsis;
      }

      .compare-hint {
        font-size: 9px;
        color: var(--b3-theme-on-surface);
        opacity: 0.4;
        margin-top: 2px;
      }
    }
  }
}


// Responsive design
@include tablet-only {
  .extended-stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@include mobile-only {
  .extended-stats-cards {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>

