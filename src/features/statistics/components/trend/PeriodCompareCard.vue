<!-- 周期对比卡：日环比/周环比/月环比三卡片（新增/修改/字数 当前 vs 上期） -->
<template>
  <div
    v-if="comparisonStats"
    class="comparison-section"
  >
    <div
      v-for="card in comparisonCards"
      :key="card.title"
      class="comparison-card"
    >
      <div class="comparison-header">
        <IconWrapper
          class="comparison-icon"
          :name="card.icon"
          :size="14"
        />
        <!-- 卡片标题："日环比" / "周环比" / "月环比" -->
        <span class="comparison-title">{{ card.title }}</span>
      </div>
      <div class="comparison-body">
        <div
          v-for="item in card.items"
          :key="item.label"
          class="comparison-item"
        >
          <!-- 指标标签："新增" / "修改" / "字数" -->
          <span class="item-label">{{ item.label }}</span>
          <span class="item-values">
            <span class="current-value">{{ item.formatCurrent }}</span>
            <span class="vs-label">vs</span>
            <span class="prev-value">{{ item.formatPrev }}</span>
          </span>
          <span
            v-if="item.change !== null"
            class="change-tag"
            :class="getChangeClass(item.change)"
          >
            {{ formatChange(item.change) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HistoricalDataItem } from "../../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatDate,
  formatNumber,
} from "../../utils"

interface Props {
  historicalData?: HistoricalDataItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({}),
})

// 计算周期对比数据
const comparisonStats = computed(() => {
  if (props.historicalData.length === 0) return null

  const today = new Date()
  const todayStr = formatDate(today)

  // 获取今日数据
  const todayData = props.historicalData.find((item) => item.date === todayStr)

  // 获取昨日数据
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDate(yesterday)
  const yesterdayData = props.historicalData.find(
    (item) => item.date === yesterdayStr,
  )

  // 获取本周数据 (周一到今天)
  const weekStart = new Date(today)
  const dayOfWeek = weekStart.getDay() || 7 // 周日为0，转为7
  weekStart.setDate(weekStart.getDate() - dayOfWeek + 1)
  const thisWeekData = getRangeData(weekStart, today)

  // 获取上周数据
  const lastWeekEnd = new Date(weekStart)
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
  const lastWeekStart = new Date(lastWeekEnd)
  lastWeekStart.setDate(lastWeekStart.getDate() - 6)
  const lastWeekData = getRangeData(lastWeekStart, lastWeekEnd)

  // 获取本月数据
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthData = getRangeData(monthStart, today)

  // 获取上月数据
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const lastMonthStart = new Date(
    lastMonthEnd.getFullYear(),
    lastMonthEnd.getMonth(),
    1,
  )
  const lastMonthData = getRangeData(lastMonthStart, lastMonthEnd)

  return {
    today: {
      created: todayData?.todayCreated ?? 0,
      modified: todayData?.todayModified ?? 0,
      words: todayData?.totalWords ?? 0,
    },
    yesterday: {
      created: yesterdayData?.todayCreated ?? 0,
      modified: yesterdayData?.todayModified ?? 0,
      words: yesterdayData?.totalWords ?? 0,
    },
    dayChange: {
      created: calcChange(
        todayData?.todayCreated ?? 0,
        yesterdayData?.todayCreated ?? 0,
      ),
      modified: calcChange(
        todayData?.todayModified ?? 0,
        yesterdayData?.todayModified ?? 0,
      ),
      words: calcChange(
        todayData?.totalWords ?? 0,
        yesterdayData?.totalWords ?? 0,
      ),
    },
    thisWeek: {
      created: thisWeekData.created,
      modified: thisWeekData.modified,
      words: thisWeekData.words,
    },
    lastWeek: {
      created: lastWeekData.created,
      modified: lastWeekData.modified,
      words: lastWeekData.words,
    },
    weekChange: {
      created: calcChange(thisWeekData.created, lastWeekData.created),
      modified: calcChange(thisWeekData.modified, lastWeekData.modified),
      words: calcChange(thisWeekData.words, lastWeekData.words),
    },
    thisMonth: {
      created: thisMonthData.created,
      modified: thisMonthData.modified,
      words: thisMonthData.words,
    },
    lastMonth: {
      created: lastMonthData.created,
      modified: lastMonthData.modified,
      words: lastMonthData.words,
    },
    monthChange: {
      created: calcChange(thisMonthData.created, lastMonthData.created),
      modified: calcChange(thisMonthData.modified, lastMonthData.modified),
      words: calcChange(thisMonthData.words, lastMonthData.words),
    },
  }
})

// 对比卡片数据驱动
const comparisonCards = computed(() => {
  if (!comparisonStats.value) return []
  const stats = comparisonStats.value
  return [
    {
      icon: "list" as const,
      title: props.i18n.dayOverDay,
      current: stats.today,
      prev: stats.yesterday,
      change: stats.dayChange,
    },
    {
      icon: "list" as const,
      title: props.i18n.weekOverWeek,
      current: stats.thisWeek,
      prev: stats.lastWeek,
      change: stats.weekChange,
    },
    {
      icon: "list" as const,
      title: props.i18n.monthOverMonth,
      current: stats.thisMonth,
      prev: stats.lastMonth,
      change: stats.monthChange,
    },
  ].map((card) => ({
    ...card,
    items: ([
      {
        key: "created",
        label: props.i18n.created,
        useFormat: false,
      },
      {
        key: "modified",
        label: props.i18n.modified,
        useFormat: false,
      },
      {
        key: "words",
        label: props.i18n.words,
        useFormat: true,
      },
    ] as const).map((m) => ({
      label: m.label,
      formatCurrent: m.useFormat ? formatNumber(card.current[m.key]) : String(card.current[m.key]),
      formatPrev: m.useFormat ? formatNumber(card.prev[m.key]) : String(card.prev[m.key]),
      change: card.change[m.key],
    })),
  }))
})

function getRangeData(
  startDate: Date,
  endDate: Date,
): { created: number, modified: number, words: number } {
  let created = 0
  let modified = 0
  let words = 0

  const startStr = formatDate(startDate)
  const endStr = formatDate(endDate)

  for (const item of props.historicalData) {
    if (item.date >= startStr && item.date <= endStr) {
      created += item.todayCreated
      modified += item.todayModified
      words = item.totalWords // 取最后一天的总字数
    }
  }

  return {
    created,
    modified,
    words,
  }
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}

function getChangeClass(change: number | null): string {
  if (change === null || change === 0) return "neutral"
  return change > 0 ? "positive" : "negative"
}

function formatChange(change: number | null): string {
  if (change === null) return "-"
  const prefix = change > 0 ? "+" : ""
  return `${prefix}${change.toFixed(1)}%`
}
</script>

<style scoped lang="scss">
@use "../../styles/PeriodCompareCard.scss";
@use '../../styles/index.scss' as stats;
</style>
