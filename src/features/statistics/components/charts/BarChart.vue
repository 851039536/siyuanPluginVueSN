<!-- 柱状图组件：每日写作字数可视化 -->
<template>
  <div class="bar-chart-section">
    <div class="bar-chart-container">

      <div class="chart-viewport">
        <div
          v-for="item in chartData"
          :key="item.date"
          class="bar-item"
          :style="{ flex: chartData.length > 12 ? '0 0 auto' : '1' }"
        >
          <div
            v-if="item.words > 0"
            class="bar-value"
            :style="{ bottom: `${barHeights.get(item.date) ?? 0}px` }"
          >
            {{ formatShortNumber(item.words) }}
          </div>
          <div
            class="bar"
            :class="{ today: isToday(item.date) }"
            :style="{ height: `${barHeights.get(item.date) ?? 0}px` }"
            :title="`${item.dateLabel}: ${formatNumber(item.words)} ${i18n.wordsUnit || '字'}`"
          ></div>
          <div
            class="bar-label"
            :class="{ today: isToday(item.date) }"
          >
            {{ formatChartLabel(item.dateLabel) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import {
  formatNumber,
  formatShortNumber,
  isToday,
} from "../../utils"

interface ChartDataItem {
  date: string
  words: number
  dateLabel: string
}

interface Props {
  chartData?: ChartDataItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  chartData: () => [],
  i18n: () => ({
    wordsUnit: "字",
  }),
})

const MAX_BAR_HEIGHT = 150
const MIN_BAR_HEIGHT = 5

const maxWords = computed(() => {
  if (!props.chartData.length) return 0
  return props.chartData.reduce((max, item) => Math.max(max, item.words), 0)
})

const barHeights = computed(() => {
  const max = maxWords.value
  if (max === 0) return new Map<string, number>()
  return new Map(
    props.chartData.map(item => {
      const rawHeight = (item.words / max) * MAX_BAR_HEIGHT
      const height = item.words > 0 ? Math.max(rawHeight, MIN_BAR_HEIGHT) : 0
      return [item.date, height]
    })
  )
})

function formatChartLabel(label: string): string {
  // "5/21 周四" → "5/21"；纯 "/" 格式保留原样
  const spaceIndex = label.indexOf(" ")
  return spaceIndex !== -1 ? label.slice(0, spaceIndex) : label
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../../superPanel/styles/shared" as *;
@use "../../styles/index.scss" as stats;

.bar-chart-section {
  .bar-chart-container {
    overflow-x: auto;
    margin-bottom: $spacing-4;
    padding-bottom: $spacing-2;
    @include scrollbar-thin;

    &::-webkit-scrollbar {
      height: 3px;
    }
  }

  .chart-viewport {
    display: flex;
    align-items: flex-end;
    gap: $spacing-2;
    min-height: 160px;
    padding: 15px 5px 35px 5px;
    position: relative;

    .bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 32px;
      position: relative;

      &:hover {
        .bar {
          filter: brightness(1.1);
          outline: 2px solid var(--b3-theme-primary-lightest);
          outline-offset: 1px;
        }

        .bar-value {
          opacity: 1;
          transform: translateX(-50%) translateY(-$spacing-1);
        }
      }

      .bar-value {
        position: absolute;
        font-family: stats.$font-mono;
        font-size: $font-size-2xs;
        font-weight: $font-weight-bold;
        color: var(--b3-theme-primary);
        white-space: nowrap;
        transform: translateX(-50%);
        left: 50%;
        opacity: 0.6;
      }

      .bar {
        width: 100%;
        background: stats.$gradient-primary;
        border-radius: stats.$radius-sm;
        cursor: pointer;

        &.today {
          background: var(--b3-theme-secondary);
          border: 1.5px solid var(--b3-theme-primary);
          outline: 2px solid rgba(var(--b3-theme-secondary-rgb), 0.2);
          outline-offset: 1px;
        }
      }

      .bar-label {
        position: absolute;
        bottom: -$spacing-4;
        font-family: stats.$font-mono;
        font-size: $font-size-2xs;
        font-weight: $font-weight-bold;
        letter-spacing: 0.06em;
        color: var(--b3-theme-on-surface);
        opacity: 0.45;
        white-space: nowrap;
        left: 50%;
        transform: translateX(-50%);

        &.today {
          color: var(--b3-theme-primary);
          opacity: 1;
        }
      }
    }
  }
}

// Responsive design
@include mobile-only {
  .bar-chart-section {
    .chart-viewport {
      min-width: 500px;
    }
  }
}
</style>
