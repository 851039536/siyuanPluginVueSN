<template>
  <div class="heatmap-page">
    <!-- 统计摘要 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-value">
          {{ activeDays }}
        </div>
        <div class="summary-label">
          {{ i18n.activeDaysLabel || '活跃天数' }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ writingStreak }}
        </div>
        <div class="summary-label">
          {{ i18n.currentStreak || '当前连续' }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ longestStreak }}
        </div>
        <div class="summary-label">
          {{ i18n.longestStreak || '最长连续' }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ totalOperations }}
        </div>
        <div class="summary-label">
          {{ i18n.totalOperations || '总操作次数' }}
        </div>
      </div>
    </div>

    <!-- 时间范围选择器 -->
    <div class="range-selector">
      <button
        v-for="opt in rangeOptions"
        :key="opt.value"
        class="range-btn"
        :class="[{ active: selectedRange === opt.value }]"
        @click="selectedRange = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- 日历网格 -->
    <div class="calendar-wrapper">
      <!-- 月份标签 -->
      <div class="month-labels">
        <div
          v-for="(label, idx) in monthLabels"
          :key="idx"
          class="month-label"
          :style="{ gridColumn: label.col }"
        >
          {{ label.text }}
        </div>
      </div>

      <div class="calendar-body">
        <!-- 星期标签 -->
        <div class="weekday-labels">
          <span class="weekday-label">{{ i18n.mon || '一' }}</span>
          <span class="weekday-label">{{ i18n.wed || '三' }}</span>
          <span class="weekday-label">{{ i18n.fri || '五' }}</span>
        </div>

        <!-- 格子 -->
        <div class="calendar-grid">
          <div
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            class="calendar-cell"
            :class="[cell.level]"
            :title="cell.tooltip"
          ></div>
        </div>
      </div>

      <!-- 图例 -->
      <div class="legend-bar">
        <span class="legend-text">{{ i18n.less || '少' }}</span>
        <span class="legend-cell level-0"></span>
        <span class="legend-cell level-1"></span>
        <span class="legend-cell level-2"></span>
        <span class="legend-cell level-3"></span>
        <span class="legend-cell level-4"></span>
        <span class="legend-text">{{ i18n.more || '多' }}</span>
      </div>
    </div>

    <!-- 星期分布 -->
    <div class="weekday-section">
      <div class="section-title">
        {{ i18n.weekdayDistribution || '星期分布' }}
      </div>
      <div class="weekday-bars">
        <div
          v-for="(item, idx) in weekdayDistribution"
          :key="idx"
          class="weekday-row"
        >
          <span class="weekday-name">{{ item.label }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: `${item.percent}%` }"
            ></div>
          </div>
          <span class="bar-value">{{ item.avg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import { formatDate } from "../utils"

interface HistoricalDataItem {
  date: string
  dateLabel: string
  totalNotes: number
  totalWords: number
  todayCreated: number
  todayModified: number
}

interface Props {
  historicalData?: HistoricalDataItem[]
  writingStreak?: number
  activeDays?: number
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  writingStreak: 0,
  activeDays: 0,
  i18n: () => ({}),
})

const LEVEL_THRESHOLDS = [0, 1, 6, 16, 31] as const

const rangeOptions = computed(() => [
  {
    value: 3,
    label: props.i18n.months3 || '3个月',
  },
  {
    value: 6,
    label: props.i18n.months6 || '6个月',
  },
  {
    value: 12,
    label: props.i18n.year1 || '1年',
  },
])

const selectedRange = ref(12)

// Build a date -> data lookup map
const dataMap = computed(() => {
  const map = new Map<string, HistoricalDataItem>()
  for (const item of props.historicalData) {
    map.set(item.date, item)
  }
  return map
})

function getActivity(dateStr: string): number {
  const d = dataMap.value.get(dateStr)
  return d ? d.todayCreated + d.todayModified : 0
}

function getLevel(activity: number): string {
  let idx = 0
  for (let t = LEVEL_THRESHOLDS.length - 1; t >= 0; t--) {
    if (activity >= LEVEL_THRESHOLDS[t]) { idx = t; break }
  }
  return `level-${idx}`
}

// Calendar grid: 7 rows (Sun=0 .. Sat=6) x N columns (weeks)
const calendarCells = computed(() => {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - selectedRange.value)
  // Align to the nearest previous Sunday
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)

  const cells: { level: string, tooltip: string, date: string }[] = []
  const cursor = new Date(startDate)

  while (cursor <= now) {
    const dateStr = formatDate(cursor)
    const activity = getActivity(dateStr)
    const dayNames = ['日', '一', '二', '三', '四', '五', '六']
    cells.push({
      date: dateStr,
      level: getLevel(activity),
      tooltip: `${dateStr} (周${dayNames[cursor.getDay()]}): ${activity}次操作`,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  // Pad to complete the last week
  const remainder = cells.length % 7
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      const dateStr = formatDate(cursor)
      cells.push({
        date: dateStr,
        level: 'level-empty',
        tooltip: '',
      })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return cells
})

const totalWeeks = computed(() => Math.ceil(calendarCells.value.length / 7))

// Month labels positioned at the week column where each month starts
const monthLabels = computed(() => {
  const labels: { text: string, col: number }[] = []
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  let lastMonth = -1

  for (let week = 0; week < totalWeeks.value; week++) {
    const cellIdx = week * 7
    const cell = calendarCells.value[cellIdx]
    if (!cell || cell.level === 'level-empty') continue

    const d = new Date(cell.date)
    const m = d.getMonth()
    if (m !== lastMonth) {
      labels.push({
        text: monthNames[m],
        col: week + 1,
      })
      lastMonth = m
    }
  }

  return labels
})

// Longest streak from historicalData
const longestStreak = computed(() => {
  if (props.historicalData.length === 0) return 0
  const sorted = [...props.historicalData].sort((a, b) => a.date.localeCompare(b.date))
  let max = 0
  let current = 0
  for (const item of sorted) {
    const activity = item.todayCreated + item.todayModified
    if (activity > 0) {
      current++
      max = Math.max(max, current)
    } else {
      current = 0
    }
  }
  return max
})

// Total operations
const totalOperations = computed(() => {
  return props.historicalData.reduce((sum, d) => sum + d.todayCreated + d.todayModified, 0)
})

// Weekday distribution
const weekdayDistribution = computed(() => {
  const dayLabels = [
    props.i18n.sunday || '周日',
    props.i18n.monday || '周一',
    props.i18n.tuesday || '周二',
    props.i18n.wednesday || '周三',
    props.i18n.thursday || '周四',
    props.i18n.friday || '周五',
    props.i18n.saturday || '周六',
  ]
  const totals = Array.from({ length: 7 }).fill(0)
  const counts = Array.from({ length: 7 }).fill(0)

  for (const item of props.historicalData) {
    const d = new Date(item.date)
    const day = d.getDay()
    totals[day] += item.todayCreated + item.todayModified
    counts[day]++
  }

  const avgs = totals.map((t, i) => counts[i] > 0 ? Math.round(t / counts[i] * 10) / 10 : 0)
  const maxAvg = Math.max(...avgs, 1)

  return dayLabels.map((label, i) => ({
    label,
    avg: avgs[i],
    percent: (avgs[i] / maxAvg) * 100,
  }))
})
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as stats;

.heatmap-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// ========== Summary Cards ==========
@include stats.summary-cards-base;

.summary-card .summary-value {
  font-size: 20px;
}

// ========== Range Selector ==========
.range-selector {
  display: flex;
  gap: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 3px;
  width: fit-content;
}

.range-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: var(--b3-theme-on-surface);
    background: var(--b3-list-hover);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-weight: 600;
  }
}

// ========== Calendar ==========
.calendar-wrapper {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  padding: 14px;
  overflow-x: auto;
}

.month-labels {
  display: grid;
  grid-template-columns: 28px repeat(v-bind(totalWeeks), 1fr);
  margin-bottom: 4px;
  padding-left: 0;
}

.month-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
}

.calendar-body {
  display: flex;
  gap: 4px;
}

.weekday-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 24px;
  padding: 2px 0;
  flex-shrink: 0;

  // Space for 7 cells: position Mon(1), Wed(3), Fri(5)
  .weekday-label {
    font-size: 10px;
    color: var(--b3-theme-on-surface-light);
    line-height: 14px;
    height: 14px;

    &:nth-child(1) { margin-top: 14px; }  // skip Sun row
    &:nth-child(2) { margin-top: 14px; }  // skip Tue row
    &:nth-child(3) { margin-top: 14px; }  // skip Thu row
  }
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(v-bind(totalWeeks), 1fr);
  grid-template-rows: repeat(7, 1fr);
  grid-auto-flow: column;
  gap: 3px;
  flex: 1;
}

.calendar-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  min-width: 12px;
  min-height: 12px;
  cursor: default;

  &.level-empty {
    visibility: hidden;
  }

  @include stats.heatmap-level-colors;
}

.legend-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 10px;

  .legend-text {
    font-size: 10px;
    color: var(--b3-theme-on-surface-light);
    margin: 0 2px;
  }

  .legend-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    @include stats.heatmap-level-colors;
  }
}

// ========== Weekday Distribution ==========
.weekday-section {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  padding: 14px;

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    margin-bottom: 12px;
  }
}

.weekday-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.weekday-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .weekday-name {
    width: 32px;
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);
    text-align: right;
    flex-shrink: 0;
  }

  .bar-track {
    flex: 1;
    height: 16px;
    background: rgba(var(--b3-theme-on-surface-rgb), 0.05);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--b3-theme-primary);
    border-radius: 4px;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .bar-value {
    width: 36px;
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);
    text-align: left;
    flex-shrink: 0;
  }
}
</style>
