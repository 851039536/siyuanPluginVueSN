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
          <!-- 摘要标签："活跃天数" -->
          {{ i18n.activeDaysLabel }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ writingStreak }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："当前连续" -->
          {{ i18n.currentStreak }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ longestStreak }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："最长连续" -->
          {{ i18n.longestStreak }}
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
          <!-- 下拉默认项："全部笔记本" -->
          {{ i18n.allNotebooks }}
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
      <!-- 加载提示："加载中..." -->
      {{ i18n.loading }}
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
          <!-- 星期标签："一" / "三" / "五" -->
          <span class="weekday-label">{{ i18n.mon }}</span>
          <span class="weekday-label">{{ i18n.wed }}</span>
          <span class="weekday-label">{{ i18n.fri }}</span>
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
        <!-- 图例两端："少" / "多" -->
        <span class="legend-text">{{ i18n.less }}</span>
        <span class="legend-cell level-0"></span>
        <span class="legend-cell level-1"></span>
        <span class="legend-cell level-2"></span>
        <span class="legend-cell level-3"></span>
        <span class="legend-cell level-4"></span>
        <span class="legend-text">{{ i18n.more }}</span>
      </div>
    </div>

    <!-- 日详情面板 -->
    <HeatmapDailyDetail
      v-if="selectedDate"
      :date="selectedDate"
      :loading="detailLoading"
      :new-docs="detailNewDocs"
      :modified-docs="detailModifiedDocs"
      :i18n="i18n"
      @close="selectedDate = null"
    />

    <!-- 星期分布 -->
    <div class="weekday-section">
      <div class="section-title">
        <!-- 区块标题："星期分布" -->
        {{ i18n.weekdayDistribution }}
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
import { formatDate } from "../utils"
import HeatmapDailyDetail from "./HeatmapDailyDetail.vue"

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

// 请求时序计数：每次筛选发起的加载自增，回填前比对以丢弃过期响应
let reqSeq = 0

// 星期名（周日→周六），供日历 tooltip 与星期分布共用，避免重复构造
const weekdayNames = computed(() => [
  props.i18n.sunday,
  props.i18n.monday,
  props.i18n.tuesday,
  props.i18n.wednesday,
  props.i18n.thursday,
  props.i18n.friday,
  props.i18n.saturday,
])

// 时间范围选项（3个月/6个月/1年）
const rangeOptions = computed(() => [
  {
    value: 3,
    label: props.i18n.months3,
  },
  {
    value: 6,
    label: props.i18n.months6,
  },
  {
    value: 12,
    label: props.i18n.year1,
  },
])

// 指标选项（修改文档/新增文档/编辑块）
const metricOptions = computed(() => [
  {
    value: 'docsModified' as HeatmapMetric,
    label: props.i18n.metricDocsModified,
  },
  {
    value: 'docsCreated' as HeatmapMetric,
    label: props.i18n.metricDocsCreated,
  },
  {
    value: 'blockEdits' as HeatmapMetric,
    label: props.i18n.metricBlockEdits,
  },
])

function metricLabel(m: HeatmapMetric): string {
  const found = metricOptions.value.find((o) => o.value === m)
  return found ? String(props.i18n.totalMetricLabel || "").replace("{label}", found.label) : ''
}

// ---- 数据 ----
const activityMap = ref(new Map<string, number>())

async function loadData() {
  if (!props.onGetActivityData) return
  const seq = ++reqSeq
  loading.value = true
  try {
    const nbId = selectedNotebook.value || undefined
    const result = await props.onGetActivityData(
      selectedRange.value,
      selectedMetric.value,
      nbId,
    )
    // 时序控制：若已有更新的请求发出，丢弃本次过期响应
    if (seq !== reqSeq) return
    activityMap.value = result
  } catch (e) {
    console.error("加载热力图数据失败:", e)
  } finally {
    // 仅最新请求负责复位 loading，避免过期响应提前关闭加载态
    if (seq === reqSeq) loading.value = false
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

// 日详情请求时序计数：快速切换选中日期时丢弃过期响应
let detailSeq = 0

async function clickCell(cell: { date: string, level: string }) {
  if (cell.level === 'level-empty' || !cell.date) return
  if (selectedDate.value === cell.date) {
    selectedDate.value = null
    return
  }
  selectedDate.value = cell.date
  if (!props.onGetDailyDetail) return
  const seq = ++detailSeq
  detailLoading.value = true
  try {
    const d = await props.onGetDailyDetail(cell.date)
    // 时序控制：过期响应不覆盖当前选中日期的详情
    if (seq !== detailSeq) return
    detailNewDocs.value = d.newDocs
    detailModifiedDocs.value = d.modifiedDocs
  } catch (e) {
    console.error("加载日详情失败:", e)
  } finally {
    if (seq === detailSeq) detailLoading.value = false
  }
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
    // 单元格 tooltip："{日期} ({星期}): {次数}次"
    cells.push({
      date: dateStr,
      level: getLevel(activity),
      tooltip: String(props.i18n.cellTooltip || "")
        .replace("{date}", dateStr)
        .replace("{weekday}", weekdayNames.value[cursor.getDay()])
        .replace("{count}", String(activity)),
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
    // 直接按 YYYY-MM-DD 文本取月份，避免 new Date 按 UTC 解析在西半区时区月初回退一月
    const m = Number(cell.date.slice(5, 7)) - 1
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
  const totals: number[] = Array.from({ length: 7 }).fill(0) as number[]

  for (const [dateStr, count] of activityMap.value.entries()) {
    const d = new Date(dateStr)
    totals[d.getDay()] += count
  }

  const grandTotal = totals.reduce((s, t) => s + t, 0)
  const maxTotal = Math.max(...totals, 1)

  return weekdayNames.value.map((label, i) => ({
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
@use '../styles/index.scss' as stats;
</style>
