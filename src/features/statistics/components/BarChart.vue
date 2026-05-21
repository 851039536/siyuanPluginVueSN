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
            :style="{ bottom: `${getBarHeight(item.words)}px` }"
          >
            {{ formatShortNumber(item.words) }}
          </div>
          <div
            class="bar"
            :class="{ today: isToday(item.date) }"
            :style="{ height: `${getBarHeight(item.words)}px` }"
            :title="`${item.dateLabel}: ${formatNumber(item.words)} ${i18n.wordsUnit}`"
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
} from "../utils"

interface ChartDataItem {
  date: string
  words: number
  dateLabel: string
}

interface Props {
  title?: string
  chartData?: ChartDataItem[]
  i18n?: {
    wordsUnit: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  chartData: () => [],
  i18n: () => ({
    wordsUnit: "字",
  }),
})

const maxWords = computed(() => {
  if (!props.chartData.length) return 0
  return Math.max(...props.chartData.map((item) => item.words))
})

function getBarHeight(words: number): number {
  const max = maxWords.value
  if (max === 0) return 0
  const maxHeight = 150
  const height = (words / max) * maxHeight
  return Math.max(height, words > 0 ? 5 : 0)
}

function formatChartLabel(label: string): string {
  // "5/21 周四" → "5/21"；纯 "/" 格式保留原样
  if (label.includes(" ")) {
    return label.split(" ")[0]
  }
  return label
}
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../styles/index.scss" as stats;

.bar-chart-section {
  .bar-chart-container {
    overflow-x: auto;
    margin-bottom: 16px;
    padding-bottom: 6px;
    @include scrollbar-thin;

    &::-webkit-scrollbar {
      height: 3px;
    }
  }

  .chart-viewport {
    display: flex;
    align-items: flex-end;
    gap: 8px;
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
          box-shadow: 0 0 8px rgba(var(--b3-theme-primary-rgb), 0.3);
        }

        .bar-value {
          opacity: 1;
          transform: translateX(-50%) translateY(-3px);
        }
      }

      .bar-value {
        position: absolute;
        font-family: $font-heading;
        font-size: 10px;
        font-weight: 700;
        color: var(--b3-theme-primary);
        white-space: nowrap;
        transform: translateX(-50%);
        left: 50%;
        opacity: 0.6;
      }

      .bar {
        width: 100%;
        min-height: 3px;
        background: stats.$gradient-primary;
        border-radius: 4px 4px 1px 1px;
        cursor: pointer;

        &.today {
          background: var(--b3-theme-secondary);
          border: 1.5px solid var(--b3-theme-primary);
          box-shadow: 0 0 10px rgba(var(--b3-theme-secondary-rgb), 0.2);
        }
      }

      .bar-label {
        position: absolute;
        bottom: -18px;
        font-family: $font-body;
        font-size: 10px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        opacity: 0.5;
        white-space: nowrap;
        left: 50%;
        transform: translateX(-50%);

        &.today {
          color: var(--b3-theme-primary);
          opacity: 1;
          font-weight: 700;
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

  .data-list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
