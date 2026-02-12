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
            :style="{ bottom: getBarHeight(item.words) + 'px' }"
          >
            {{ formatShortNumber(item.words) }}
          </div>
          <div
            class="bar"
            :class="{ today: isToday(item.date) }"
            :style="{ height: getBarHeight(item.words) + 'px' }"
            :title="`${item.dateLabel}: ${formatNumber(item.words)} ${i18n.wordsUnit}`"
          ></div>
          <div class="bar-label" :class="{ today: isToday(item.date) }">
            {{ formatChartLabel(item.dateLabel) }}
          </div>
        </div>
      </div>
    </div>


    <!-- 数据列表 -->
    <div class="data-list">
      <div
        v-for="item in chartData"
        :key="item.date"
        class="data-item"
        :class="{ active: item.words > 0, today: isToday(item.date) }"
      >
        <span class="data-date">{{ item.dateLabel }}</span>
        <span class="data-value">{{ formatNumber(item.words) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber, formatShortNumber, isToday } from '../utils'

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
  title: '',
  chartData: () => [],
  i18n: () => ({
    wordsUnit: '字',
  }),
})

const maxWords = computed(() => {
  if (!props.chartData.length) return 0
  return Math.max(...props.chartData.map(item => item.words))
})

function getBarHeight(words: number): number {
  const max = maxWords.value
  if (max === 0) return 0
  const maxHeight = 150
  const height = (words / max) * maxHeight
  return Math.max(height, words > 0 ? 5 : 0)
}


function formatChartLabel(label: string): string {
  // 可以根据需要自定义标签格式化逻辑
  // 简化处理：如果是月份格式，只显示月
  if (label.includes(' ')) {
    return label.split(' ')[1] || label
  }
  if (label.includes('/')) {
    return label.split('/')[1] || label
  }
  return label
}
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

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
      transition: stats.$stats-transition;

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
        transition: stats.$stats-transition;
      }

      .bar {
        width: 100%;
        min-height: 3px;
        background: stats.$gradient-primary;
        border-radius: 4px 4px 1px 1px;
        cursor: pointer;
        transition: stats.$stats-transition;

        &.today {
          background: var(--b3-theme-secondary);
          border: 1.5px solid var(--b3-theme-primary);
          box-shadow: 0 0 10px rgba(var(--b3-theme-secondary-rgb), 0.2);
        }
      }

      .bar-label {
        position: absolute;
        bottom: -25px;
        font-family: $font-body;
        font-size: 10px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        opacity: 0.5;
        transform: rotate(-45deg);
        transform-origin: top left;
        white-space: nowrap;
        left: 50%;
        transition: stats.$stats-transition;

        &.today {
          color: var(--b3-theme-primary);
          opacity: 1;
          font-weight: 700;
        }
      }
    }
  }
}

.data-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;

  .data-item {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    background: var(--b3-theme-background);
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
    transition: stats.$stats-transition;

    &:hover {
      border-color: var(--b3-theme-primary);
      transform: translateY(-1px);
    }

    &.active {
      background: var(--b3-theme-surface-lighter, rgba(var(--b3-theme-primary-rgb), 0.03));
    }

    &.today {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lighter, rgba(var(--b3-theme-primary-rgb), 0.08));
      
      .data-value {
        color: var(--b3-theme-primary);
      }
    }

    .data-date {
      font-family: $font-body;
      font-size: 9px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
      margin-bottom: 2px;
      text-transform: uppercase;
    }

    .data-value {
      font-family: $font-heading;
      font-size: 14px;
      font-weight: 800;
      color: var(--b3-theme-on-surface);
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
