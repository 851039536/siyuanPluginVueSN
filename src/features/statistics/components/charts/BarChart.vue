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
@use "../../styles/BarChart.scss";
</style>
