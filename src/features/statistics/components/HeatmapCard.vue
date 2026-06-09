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
          {{ metricLabel(selectedMetric) }}
        </div>
      </div>
    </div>

    <!-- 筛选栏：时间范围 + 指标 + 笔记本 -->
    <div class="filters-row">
      <div class="range-selector">
        <button
          v-for="opt in rangeOptions"
          :key="opt.value"
          class="range-btn"
          :class="[{ active: selectedRange === opt.value }]"
          @click="switchRange(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="metric-selector">
        <button
          v-for="m in metricOptions"
          :key="m.value"
          class="range-btn"
          :class="[{ active: selectedMetric === m.value }]"
          @click="switchMetric(m.value)"
        >
          {{ m.label }}
        </button>
      </div>

      <select
        v-if="notebooks.length > 1"
        class="notebook-select"
        :value="selectedNotebook"
        @change="switchNotebook(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ i18n.allNotebooks || '全部笔记本' }}</option>
        <option
          v-for="nb in notebooks"
          :key="nb.id"
          :value="nb.id"
        >{{ nb.name }}</option>
      </select>
    </div>

    <!-- 加载态 -->
    <div
      v-if="loading"
      class="hm-loading"
    >
      {{ i18n.loading || '加载中...' }}
    </div>

    <!-- 日历网格 -->
    <div
      v-else
      class="calendar-wrapper"
    >
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
        <div class="weekday-labels">
          <span class="weekday-label">{{ i18n.mon || '一' }}</span>
          <span class="weekday-label">{{ i18n.wed || '三' }}</span>
          <span class="weekday-label">{{ i18n.fri || '五' }}</span>
        </div>

        <div class="calendar-grid">
          <div
            v-for="(cell, idx) in calendarCells"
            :key="idx"
            class="calendar-cell"
            :class="[cell.level, { selected: selectedDate === cell.date }]"
            :title="cell.tooltip"
            @click="clickCell(cell)"
          ></div>
        </div>
      </div>

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

    <!-- 日详情面板 -->
    <div
      v-if="selectedDate"
      class="daily-detail"
    >
      <div class="daily-detail-header">
        <span class="daily-detail-title">{{ selectedDate }}</span>
        <button
          class="daily-detail-close"
          @click="selectedDate = null"
        >&times;</button>
      </div>

      <div
        v-if="detailLoading"
        class="daily-detail-status"
      >
        {{ i18n.loading || '加载中...' }}
      </div>

      <div
        v-else-if="detailNewDocs.length === 0 && detailModifiedDocs.length === 0"
        class="daily-detail-status"
      >
        {{ i18n.noDocChanges || '当天无新增或修改' }}
      </div>

      <div
        v-else
        class="daily-detail-list"
      >
        <div
          v-if="detailNewDocs.length > 0"
          class="detail-group"
        >
          <div class="detail-group-title">
            🆕 {{ i18n.todayCreated || '新增' }}（{{ detailNewDocs.length }}）
          </div>
          <div
            v-for="doc in detailNewDocs"
            :key="doc.id"
            class="detail-item new"
            @click="openDoc(doc.id)"
          >
            <span class="detail-icon">+</span>
            <span class="detail-title">{{ doc.title || '无标题' }}</span>
            <span
              v-if="doc.time"
              class="detail-time"
            >{{ doc.time }}</span>
          </div>
        </div>

        <div
          v-if="detailModifiedDocs.length > 0"
          class="detail-group"
        >
          <div class="detail-group-title">
            ✏️ {{ i18n.todayModified || '修改' }}（{{ detailModifiedDocs.length }}）
          </div>
          <div
            v-for="doc in detailModifiedDocs"
            :key="doc.id"
            class="detail-item modified"
            @click="openDoc(doc.id)"
          >
            <span class="detail-icon">~</span>
            <span class="detail-title">{{ doc.title || '无标题' }}</span>
            <span
              v-if="doc.time"
              class="detail-time"
            >{{ doc.time }}</span>
          </div>
        </div>
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
          :class="{ 'is-max': item.isMax }"
        >
          <span class="weekday-name">{{ item.label }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="{ top: item.isMax }"
              :style="{ width: `${item.percent}%` }"
            ></div>
          </div>
          <span class="bar-total">{{ item.total }}</span>
          <span class="bar-pct">{{ item.pct }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChangedDoc, HeatmapMetric } from "../types"
import {
  computed,
  ref,
} from "vue"
import { formatDate } from "../utils"

interface Props {
  onGetActivityData?: (
    months: number,
    metric: HeatmapMetric,
    notebookId?: string,
  ) => Promise<Map<string, number>>
  onGetDailyDetail?: (dateStr: string) => Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }>
  notebooks?: Array<{ id: string, name: string }>
  writingStreak?: number
  activeDays?: number
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  notebooks: () => [],
  writingStreak: 0,
  activeDays: 0,
  i18n: () => ({}),
})

const LEVEL_THRESHOLDS = [0, 1, 6, 16, 31] as const

// ---- 筛选状态 ----
const selectedRange = ref(12)
const selectedMetric = ref<HeatmapMetric>('docsModified')
const selectedNotebook = ref('')
const loading = ref(false)

const rangeOptions = computed(() => [
  { value: 3, label: props.i18n.months3 || '3个月' },
  { value: 6, label: props.i18n.months6 || '6个月' },
  { value: 12, label: props.i18n.year1 || '1年' },
])

const metricOptions = computed(() => [
  { value: 'docsModified' as HeatmapMetric, label: props.i18n.metricDocsModified || '修改文档' },
  { value: 'docsCreated' as HeatmapMetric, label: props.i18n.metricDocsCreated || '新增文档' },
  { value: 'blockEdits' as HeatmapMetric, label: props.i18n.metricBlockEdits || '编辑块' },
])

function metricLabel(m: HeatmapMetric): string {
  const found = metricOptions.value.find((o) => o.value === m)
  return found ? `总${found.label}` : ''
}

// ---- 数据 ----
const activityMap = ref(new Map<string, number>())

async function loadData() {
  if (!props.onGetActivityData) return
  loading.value = true
  try {
    const nbId = selectedNotebook.value || undefined
    activityMap.value = await props.onGetActivityData(
      selectedRange.value,
      selectedMetric.value,
      nbId,
    )
  } catch (e) {
    console.error("加载热力图数据失败:", e)
  } finally {
    loading.value = false
  }
}

function switchRange(v: number) { selectedRange.value = v; loadData() }
function switchMetric(v: HeatmapMetric) { selectedMetric.value = v; loadData() }
function switchNotebook(v: string) { selectedNotebook.value = v; loadData() }

// ---- 日详情 ----
const selectedDate = ref<string | null>(null)
const detailLoading = ref(false)
const detailNewDocs = ref<ChangedDoc[]>([])
const detailModifiedDocs = ref<ChangedDoc[]>([])

async function clickCell(cell: { date: string, level: string }) {
  if (cell.level === 'level-empty' || !cell.date) return
  if (selectedDate.value === cell.date) {
    selectedDate.value = null
    return
  }
  selectedDate.value = cell.date
  if (!props.onGetDailyDetail) return
  detailLoading.value = true
  try {
    const d = await props.onGetDailyDetail(cell.date)
    detailNewDocs.value = d.newDocs
    detailModifiedDocs.value = d.modifiedDocs
  } finally {
    detailLoading.value = false
  }
}

function openDoc(docId: string) {
  if (docId) window.open(`siyuan://blocks/${docId}`)
}

// ---- 日历网格 ----
function getActivity(dateStr: string): number {
  return activityMap.value.get(dateStr) || 0
}

function getLevel(activity: number): string {
  let idx = 0
  for (let t = LEVEL_THRESHOLDS.length - 1; t >= 0; t--) {
    if (activity >= LEVEL_THRESHOLDS[t]) { idx = t; break }
  }
  return `level-${idx}`
}

const calendarCells = computed(() => {
  const now = new Date()
  const startDate = new Date(now)
  startDate.setMonth(startDate.getMonth() - selectedRange.value)
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)

  const cells: { date: string, level: string, tooltip: string }[] = []
  const cursor = new Date(startDate)

  while (cursor <= now) {
    const dateStr = formatDate(cursor)
    const activity = getActivity(dateStr)
    const dayNames = ['日', '一', '二', '三', '四', '五', '六']
    cells.push({
      date: dateStr,
      level: getLevel(activity),
      tooltip: `${dateStr} (周${dayNames[cursor.getDay()]}): ${activity}次`,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const remainder = cells.length % 7
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ date: '', level: 'level-empty', tooltip: '' })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return cells
})

const totalWeeks = computed(() => Math.ceil(calendarCells.value.length / 7))

const monthLabels = computed(() => {
  const labels: { text: string, col: number }[] = []
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  let lastMonth = -1

  for (let week = 0; week < totalWeeks.value; week++) {
    const cell = calendarCells.value[week * 7]
    if (!cell || cell.level === 'level-empty') continue
    const d = new Date(cell.date)
    const m = d.getMonth()
    if (m !== lastMonth) {
      labels.push({ text: monthNames[m], col: week + 1 })
      lastMonth = m
    }
  }

  return labels
})

// ---- 摘要计算 ----
const longestStreak = computed(() => {
  if (activityMap.value.size === 0) return 0
  const sorted = [...activityMap.value.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let max = 0, current = 0
  for (const [, count] of sorted) {
    if (count > 0) { current++; max = Math.max(max, current) }
    else { current = 0 }
  }
  return max
})

const totalOperations = computed(() => {
  let sum = 0
  for (const count of activityMap.value.values()) sum += count
  return sum
})

// ---- 星期分布 ----
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
  const totals: number[] = Array.from({ length: 7 }).fill(0) as number[]

  for (const [dateStr, count] of activityMap.value.entries()) {
    const d = new Date(dateStr)
    totals[d.getDay()] += count
  }

  const grandTotal = totals.reduce((s, t) => s + t, 0)
  const maxTotal = Math.max(...totals, 1)

  return dayLabels.map((label, i) => ({
    label,
    total: totals[i],
    pct: grandTotal > 0 ? Math.round((totals[i] / grandTotal) * 100) : 0,
    percent: (totals[i] / maxTotal) * 100,
    isMax: totals[i] === maxTotal && totals[i] > 0,
  }))
})

// 初始加载
loadData()
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
  font-family: stats.$font-mono;
}

// ========== Filters ==========
.filters-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.range-selector,
.metric-selector {
  display: flex;
  gap: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 3px;
  width: fit-content;
}

.range-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-family: stats.$font-mono;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    color: var(--b3-theme-on-surface);
    background: var(--b3-list-hover);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-weight: 700;
  }
}

.notebook-select {
  padding: 5px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 11px;
  font-weight: 600;
  outline: none;
  max-width: 140px;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.hm-loading {
  text-align: center;
  padding: 24px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

// ========== Calendar ==========
.calendar-wrapper {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
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
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  opacity: 0.45;
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

  .weekday-label {
    font-family: stats.$font-mono;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--b3-theme-on-surface-light);
    opacity: 0.45;
    line-height: 14px;
    height: 14px;

    &:nth-child(1) { margin-top: 14px; }
    &:nth-child(2) { margin-top: 14px; }
    &:nth-child(3) { margin-top: 14px; }
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
  border-radius: 4px;
  min-width: 12px;
  min-height: 12px;
  cursor: pointer;
  transition: outline 0.1s;

  &.level-empty {
    visibility: hidden;
    pointer-events: none;
  }

  &:hover:not(.level-empty) {
    outline: 2px solid var(--b3-theme-on-surface);
    outline-offset: 1px;
  }

  &.selected {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 1px;
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
    font-family: stats.$font-mono;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--b3-theme-on-surface-light);
    opacity: 0.45;
    margin: 0 2px;
  }

  .legend-cell {
    width: 12px;
    height: 12px;
    border-radius: 4px;
    @include stats.heatmap-level-colors;
  }
}

// ========== Daily Detail Panel ==========
.daily-detail {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 12px;
}

.daily-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.daily-detail-title {
  font-family: stats.$font-mono;
  font-size: 12px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.daily-detail-close {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--b3-list-hover);
    color: var(--b3-theme-on-surface);
  }
}

.daily-detail-status {
  text-align: center;
  padding: 12px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.daily-detail-list {
  max-height: 240px;
  overflow-y: auto;
}

.detail-group {
  margin-bottom: 10px;
  &:last-child { margin-bottom: 0; }
}

.detail-group-title {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--b3-theme-on-surface);
  opacity: 0.55;
  margin-bottom: 4px;
  padding: 0 4px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  transition: background 0.12s;

  &:hover { background: var(--b3-list-hover); }
}

.detail-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.detail-item.new .detail-icon {
  background: rgba(stats.$color-success, 0.15);
  color: stats.$color-success;
}

.detail-item.modified .detail-icon {
  background: rgba(stats.$color-warning, 0.15);
  color: stats.$color-warning;
}

.detail-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-time {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  flex-shrink: 0;
}

// ========== Weekday Distribution ==========
.weekday-section {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 14px;

  .section-title {
    font-family: stats.$font-mono;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
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

  &.is-max .weekday-name {
    color: var(--b3-theme-primary);
    opacity: 1;
  }

  .weekday-name {
    width: 32px;
    font-family: stats.$font-mono;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--b3-theme-on-surface-light);
    opacity: 0.45;
    text-align: right;
    flex-shrink: 0;
  }

  .bar-track {
    flex: 1;
    height: 18px;
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
    opacity: 0.65;

    &.top {
      opacity: 1;
      background: var(--b3-theme-primary);
    }
  }

  .bar-total {
    width: 36px;
    font-family: stats.$font-mono;
    font-size: 11px;
    font-weight: 700;
    color: var(--b3-theme-on-surface);
    text-align: right;
    flex-shrink: 0;
  }

  .bar-pct {
    width: 32px;
    font-family: stats.$font-mono;
    font-size: 10px;
    font-weight: 700;
    color: var(--b3-theme-on-surface);
    opacity: 0.45;
    text-align: right;
    flex-shrink: 0;
  }
}
</style>
