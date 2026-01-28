<template>
  <div class="bar-chart">
    <h3 class="section-title">{{ title }}</h3>
    <div class="bar-chart">
      <div class="chart-container">
        <div
          v-for="(item, index) in chartData"
          :key="index"
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

function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

function formatShortNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return String(num)
}

function getBarHeight(words: number): number {
  if (!props.chartData.length) return 0
  const maxWords = Math.max(...props.chartData.map(d => d.words))
  if (maxWords === 0) return 0
  const maxHeight = 150
  const height = (words / maxWords) * maxHeight
  return Math.max(height, words > 0 ? 5 : 0)
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`

  if (dateStr.length === 10) {
    return dateStr === todayStr
  } else if (dateStr.length === 7) {
    return dateStr === todayStr.substring(0, 7)
  } else if (dateStr.length === 4) {
    return dateStr === String(today.getFullYear())
  }
  return false
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

function padZero(num: number): string {
  return num < 10 ? '0' + num : String(num)
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;

$stats-card-radius: 8px;
$gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
$gradient-secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);

.bar-chart {
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: 6px;
  overflow-x: auto;

  .section-title {
    margin: 0 0 12px 0;
    font-family: $font-heading;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .chart-container {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    min-height: 190px;
    padding-bottom: 30px;
    position: relative;

    .bar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 32px;
      position: relative;

      .bar-value {
        position: absolute;
        font-family: $font-heading;
        font-size: 10px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        white-space: nowrap;
        transform: translateX(-50%);
        left: 50%;
      }

      .bar {
        width: 100%;
        min-height: 5px;
        background: $gradient-primary;
        border-radius: 4px 4px 0 0;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
        cursor: pointer;

        &:hover {
          opacity: 0.8;
          transform: scaleY(1.02);
        }

        &.today {
          background: $gradient-secondary;
          box-shadow: 0 4px 8px rgba(245, 87, 108, 0.4);
          border: 2px solid #f5576c;
        }
      }

      .bar-label {
        position: absolute;
        bottom: -25px;
        font-family: $font-body;
        font-size: 10px;
        color: var(--b3-theme-on-surface);
        transform: rotate(-45deg);
        transform-origin: top left;
        white-space: nowrap;
        left: 50%;

        &.today {
          color: #f5576c;
          font-weight: 700;
        }
      }
    }
  }
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .data-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--b3-theme-background);
    border-radius: 6px;
    border-left: 3px solid #ddd;
    transition: all 0.2s ease;

    &.active {
      border-left-color: #667eea;
    }

    &.today {
      border-left-color: #f5576c;
      background: rgba(245, 87, 108, 0.05);

      .data-value {
        color: #f5576c;
      }
    }

    .data-date {
      font-family: $font-body;
      font-size: 12px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
    }

    .data-value {
      font-family: $font-heading;
      font-size: 13px;
      font-weight: 700;
      color: var(--b3-theme-primary);
    }
  }
}

// Responsive design
@include mobile-only {
  .bar-chart {
    padding: 8px;

    .chart-container {
      min-width: 600px;
    }
  }
}
</style>
