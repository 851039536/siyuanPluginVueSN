<!-- 热力图卡片：日历热力图、活跃天数/连续记录摘要、星期分布柱状图、日详情面板 -->
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
        <option value="">
          {{ i18n.allNotebooks || '全部笔记本' }}
        </option>
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
            <IconWrapper
              name="success"
              :size="12"
            /> {{ i18n.todayCreated || '新增' }}（{{ detailNewDocs.length }}）
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
            <IconWrapper
              name="edit"
              :size="12"
            /> {{ i18n.todayModified || '修改' }}（{{ detailModifiedDocs.length }}）
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
import type {
  ChangedDoc,
  HeatmapMetric,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
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
  i18n?: Record<string, any>
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

const metricOptions = computed(() => [
  {
    value: 'docsModified' as HeatmapMetric,
    label: props.i18n.metricDocsModified || '修改文档',
  },
  {
    value: 'docsCreated' as HeatmapMetric,
    label: props.i18n.metricDocsCreated || '新增文档',
  },
  {
    value: 'blockEdits' as HeatmapMetric,
    label: props.i18n.metricBlockEdits || '编辑块',
  },
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
      cells.push({
        date: '',
        level: 'level-empty',
        tooltip: '',
      })
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
      labels.push({
        text: monthNames[m],
        col: week + 1,
      })
      lastMonth = m
    }
  }

  return labels
})

// ---- 摘要计算 ----
const longestStreak = computed(() => {
  if (activityMap.value.size === 0) return 0
  const sorted = [...activityMap.value.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let max = 0; let current = 0
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

<style lang="scss" scoped>
@use '../styles/HeatmapCard.scss';
</style>
