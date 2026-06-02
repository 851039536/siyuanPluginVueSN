<template>
  <div class="activity-page">
    <!-- 时间范围选择 -->
    <div class="range-selector">
      <button
        v-for="opt in periodOptions"
        :key="opt.value"
        class="range-btn"
        :class="[{ active: days === opt.value }]"
        @click="switchPeriod(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- 统计摘要 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-value">
          {{ summary.activeNotebooks }}
        </div>
        <div class="summary-label">
          {{ i18n.activeNotebooks || '活跃笔记本' }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ summary.mostActive }}
        </div>
        <div class="summary-label">
          {{ i18n.mostActive || '最活跃' }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ formatNumber(summary.totalWords) }}
        </div>
        <div class="summary-label">
          {{ i18n.periodTotalWords || '期间总字数' }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ formatNumber(summary.dailyAvg) }}
        </div>
        <div class="summary-label">
          {{ i18n.dailyAvgWords || '日均字数' }}
        </div>
      </div>
    </div>

    <!-- 加载 / 空状态 -->
    <div
      v-if="loading"
      class="trend-loading"
    >
      {{ i18n.loading || '加载中...' }}
    </div>
    <div
      v-else-if="notebooks.length === 0"
      class="trend-empty"
    >
      {{ i18n.noData || '暂无数据' }}
    </div>

    <template v-else>
      <!-- 图表 -->
      <div class="chart-card">
        <div class="chart-legend">
          <div
            v-for="nb in activeNotebooks"
            :key="nb.notebook"
            class="legend-item"
            :class="[{ dimmed: hoveredNb && hoveredNb !== nb.notebook }]"
            @mouseenter="hoveredNb = nb.notebook"
            @mouseleave="hoveredNb = null"
          >
            <span
              class="legend-dot"
              :style="{ background: nb.color }"
            ></span>
            <span class="legend-name">{{ nb.notebook }}</span>
          </div>
        </div>

        <div class="chart-container">
          <svg
            :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
            class="chart-svg"
            preserveAspectRatio="none"
          >
            <!-- 网格线 -->
            <line
              v-for="i in gridLines"
              :key="`grid-${i}`"
              :x1="PAD_L"
              :y1="i"
              :x2="CHART_W - PAD_R"
              :y2="i"
              class="grid-line"
            />
            <!-- Y 轴标签 -->
            <text
              v-for="(label, idx) in yLabels"
              :key="`yl-${idx}`"
              :x="PAD_L - 6"
              :y="label.y"
              class="y-label"
              text-anchor="end"
            >{{ label.text }}</text>
            <!-- X 轴标签 -->
            <text
              v-for="(pt, idx) in xLabels"
              :key="`xl-${idx}`"
              :x="pt.x"
              :y="CHART_H - 4"
              class="x-label"
              text-anchor="middle"
            >{{ pt.label }}</text>
            <!-- 折线 -->
            <path
              v-for="nb in activeNotebooks"
              :key="nb.notebook"
              :d="nbLinePaths.get(nb.notebook) || ''"
              class="trend-line"
              :class="{ dimmed: hoveredNb && hoveredNb !== nb.notebook }"
              :style="{ stroke: nb.color }"
              fill="none"
            />
            <!-- 数据点 -->
            <circle
              v-for="(dot, di) in allDots"
              :key="`dot-${di}`"
              :cx="dot.x"
              :cy="dot.y"
              :r="2.5"
              :fill="dot.color"
              :class="{ dimmed: hoveredNb && hoveredNb !== dot.notebook }"
            />
            <!-- 悬停热区 -->
            <rect
              v-for="(hit, hi) in hitAreas"
              :key="`hit-${hi}`"
              :x="hit.x"
              :y="0"
              :width="hit.w"
              :height="CHART_H - 20"
              class="hit-area"
              @mouseenter="hoveredX = hi"
              @mouseleave="hoveredX = -1"
            />
            <!-- 悬停竖线 -->
            <line
              v-if="hoveredX >= 0 && xLabels[hoveredX]"
              :x1="xLabels[hoveredX].x"
              :y1="PAD_T"
              :x2="xLabels[hoveredX].x"
              :y2="CHART_H - 20"
              class="hover-line"
            />
          </svg>

          <!-- 悬停提示 -->
          <div
            v-if="hoveredX >= 0 && xLabels[hoveredX]"
            class="tooltip"
            :style="{
              left: tooltipLeft,
              top: tooltipTop,
            }"
          >
            <div class="tooltip-date">
              {{ dateAt(hoveredX) }}
            </div>
            <div
              v-for="nb in activeNotebooks"
              :key="nb.notebook"
              class="tooltip-row"
            >
              <span
                class="tooltip-dot"
                :style="{ background: nb.color }"
              ></span>
              <span class="tooltip-name">{{ nb.notebook }}</span>
              <span class="tooltip-val">{{ formatNumber(nb.data[hoveredX]?.words || 0) }} {{ i18n.wordsUnit || '字' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 笔记本排行表 -->
      <div class="ranking-card">
        <div class="ranking-title">
          {{ i18n.notebookRanking || '笔记本排行' }}
        </div>
        <div class="ranking-table">
          <div class="ranking-header">
            <span class="col-rank">#</span>
            <span class="col-name">{{ i18n.notebookName || '笔记本' }}</span>
            <span class="col-total">{{ i18n.totalWords || '总字数' }}</span>
            <span class="col-days">{{ i18n.activeDaysLabel || '活跃天数' }}</span>
            <span class="col-avg">{{ i18n.dailyAvg || '日均' }}</span>
            <span class="col-bar">{{ i18n.proportion || '占比' }}</span>
          </div>
          <div
            v-for="(item, idx) in rankingData"
            :key="item.notebook"
            class="ranking-row"
          >
            <span class="col-rank">{{ idx + 1 }}</span>
            <span class="col-name">
              <span
                class="rank-dot"
                :style="{ background: item.color }"
              ></span>
              {{ item.notebook }}
            </span>
            <span class="col-total">{{ formatNumber(item.totalWords) }}</span>
            <span class="col-days">{{ item.activeDays }}</span>
            <span class="col-avg">{{ formatNumber(item.dailyAvg) }}</span>
            <span class="col-bar">
              <span class="bar-track">
                <span
                  class="bar-fill"
                  :style="{
                    width: `${item.percent}%`,
                    background: item.color,
                  }"
                ></span>
              </span>
              <span class="bar-label">{{ item.percent }}%</span>
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { NotebookActivityItem } from "../types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { formatNumber } from "../utils"

interface Props {
  onGetNotebookActivityTrend?: (days: number) => Promise<NotebookActivityItem[]>
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const CHART_W = 700
const CHART_H = 240
const PAD_L = 42
const PAD_R = 8
const PAD_T = 14

const days = ref(7)
const periodOptions = computed(() => [
  {
    label: props.i18n.days7 || '7天',
    value: 7,
  },
  {
    label: props.i18n.days15 || '15天',
    value: 15,
  },
  {
    label: props.i18n.days30 || '30天',
    value: 30,
  },
  {
    label: props.i18n.days60 || '60天',
    value: 60,
  },
  {
    label: props.i18n.days90 || '90天',
    value: 90,
  },
  {
    label: props.i18n.days180 || '180天',
    value: 180,
  },
])

const loading = ref(false)
const notebooks = ref<NotebookActivityItem[]>([])
const hoveredNb = ref<string | null>(null)
const hoveredX = ref(-1)

const activeNotebooks = computed(() =>
  notebooks.value.filter((n) => n.data.some((d) => d.words > 0)),
)

// ========== Summary ==========
const summary = computed(() => {
  const active = activeNotebooks.value
  let totalWords = 0
  let mostActiveNb = ''
  let mostActiveWords = 0
  const activeDaysSet = new Set<string>()

  for (const nb of active) {
    let nbTotal = 0
    for (const d of nb.data) {
      if (d.words > 0) {
        nbTotal += d.words
        activeDaysSet.add(d.date)
      }
    }
    totalWords += nbTotal
    if (nbTotal > mostActiveWords) {
      mostActiveWords = nbTotal
      mostActiveNb = nb.notebook
    }
  }

  return {
    activeNotebooks: active.length,
    mostActive: mostActiveNb || '-',
    totalWords,
    dailyAvg: activeDaysSet.size > 0 ? Math.round(totalWords / activeDaysSet.size) : 0,
  }
})

// ========== Chart ==========
const plotW = computed(() => CHART_W - PAD_L - PAD_R)
const plotH = computed(() => CHART_H - PAD_T - 20)

const yRange = computed(() => {
  let maxVal = 1
  for (const nb of activeNotebooks.value) {
    for (const d of nb.data) {
      maxVal = Math.max(maxVal, d.words)
    }
  }
  return {
    min: 0,
    max: maxVal,
  }
})

const gridLines = computed(() => {
  const lines = []
  for (let i = 0; i <= 4; i++) {
    lines.push(PAD_T + plotH.value * (1 - i / 4))
  }
  return lines
})

const yLabels = computed(() => {
  const {
    min,
    max,
  } = yRange.value
  return [0, 1, 2, 3, 4].map((i) => {
    const val = min + (max - min) * (i / 4)
    return {
      text: formatNumber(Math.round(val)),
      y: PAD_T + plotH.value * (1 - i / 4) + 3,
    }
  })
})

const dataLen = computed(() => {
  if (activeNotebooks.value.length === 0) return days.value
  return activeNotebooks.value[0].data.length
})

const stepW = computed(() => {
  const n = dataLen.value
  return n > 1 ? plotW.value / (n - 1) : plotW.value
})

const xLabels = computed(() => {
  const n = dataLen.value
  const labels: Array<{ x: number, label: string }> = []
  if (n === 0) return labels

  const showEvery = n <= 10 ? 1 : Math.ceil(n / 10)
  for (let i = 0; i < n; i++) {
    if (i % showEvery === 0 || i === n - 1) {
      const nb = activeNotebooks.value[0]
      if (nb?.data[i]) {
        labels.push({
          x: PAD_L + i * stepW.value,
          label: nb.data[i].dateLabel.split(' ')[0],
        })
      }
    }
  }
  return labels
})

function toX(idx: number): number {
  return PAD_L + idx * stepW.value
}

function toY(val: number): number {
  const {
    min,
    max,
  } = yRange.value
  const range = max - min || 1
  return PAD_T + plotH.value * (1 - (val - min) / range)
}

const nbLinePaths = computed(() => {
  const map = new Map<string, string>()
  for (const nb of activeNotebooks.value) {
    const pts = nb.data
      .slice(0, dataLen.value)
      .map((d, i) => `${toX(i)} ${toY(d.words)}`)
    if (pts.length > 0) {
      map.set(nb.notebook, `M ${pts.join(' L ')}`)
    }
  }
  return map
})

interface DotInfo {
  x: number
  y: number
  color: string
  notebook: string
}

const allDots = computed<DotInfo[]>(() => {
  const dots: DotInfo[] = []
  for (const nb of activeNotebooks.value) {
    for (let i = 0; i < nb.data.length && i < dataLen.value; i++) {
      if (nb.data[i].words > 0) {
        dots.push({
          x: toX(i),
          y: toY(nb.data[i].words),
          color: nb.color,
          notebook: nb.notebook,
        })
      }
    }
  }
  return dots
})

const hitAreas = computed(() => {
  const areas = []
  const n = dataLen.value
  const half = Math.max(stepW.value / 2, 4)
  for (let i = 0; i < n; i++) {
    areas.push({
      x: Math.max(0, toX(i) - half),
      w: half * 2,
    })
  }
  return areas
})

const tooltipLeft = computed(() => {
  if (hoveredX.value < 0) return '0'
  const pct = (toX(hoveredX.value) / CHART_W) * 100
  return pct > 60 ? `calc(${pct}% - 140px)` : `${pct}%`
})

const tooltipTop = computed(() => '8px')

function dateAt(idx: number): string {
  return activeNotebooks.value[0]?.data[idx]?.date ?? ''
}

// ========== Ranking ==========
const rankingData = computed(() => {
  const totalAll = activeNotebooks.value.reduce((sum, nb) => {
    return sum + nb.data.reduce((s, d) => s + d.words, 0)
  }, 0)

  return activeNotebooks.value
    .map((nb) => {
      const totalWords = nb.data.reduce((s, d) => s + d.words, 0)
      const activeDays = nb.data.filter((d) => d.words > 0).length
      return {
        notebook: nb.notebook,
        color: nb.color,
        totalWords,
        activeDays,
        dailyAvg: activeDays > 0 ? Math.round(totalWords / activeDays) : 0,
        percent: totalAll > 0 ? Math.round((totalWords / totalAll) * 100) : 0,
      }
    })
    .sort((a, b) => b.totalWords - a.totalWords)
})

// ========== Actions ==========
async function switchPeriod(d: number) {
  days.value = d
  await load()
}

async function load() {
  if (!props.onGetNotebookActivityTrend) return
  loading.value = true
  try {
    notebooks.value = await props.onGetNotebookActivityTrend(days.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})

defineExpose({ load })
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as stats;

.activity-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

// ========== Summary ==========
@include stats.summary-cards-base;

.summary-card .summary-value {
  font-size: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ========== Loading / Empty ==========
.trend-loading,
.trend-empty {
  text-align: center;
  padding: 40px 20px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

// ========== Chart ==========
.chart-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  padding: 14px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: opacity 0.15s, background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.dimmed {
    opacity: 0.25;
  }
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  white-space: nowrap;
}

.chart-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.grid-line {
  stroke: var(--b3-border-color);
  stroke-width: 0.5;
  stroke-dasharray: 3 3;
}

.y-label {
  font-size: 10px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.x-label {
  font-size: 10px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.trend-line {
  stroke-width: 2;
  opacity: 0.75;
  transition: opacity 0.15s;

  &.dimmed {
    opacity: 0.12;
  }
}

.hit-area {
  fill: transparent;
}

.hover-line {
  stroke: var(--b3-theme-primary);
  stroke-width: 1;
  stroke-dasharray: 4 2;
}

.tooltip {
  position: absolute;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  min-width: 120px;
  z-index: 10;
}

.tooltip-date {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--b3-theme-on-surface);
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.85;
}

.tooltip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-name {
  flex: 1;
}

.tooltip-val {
  font-weight: 600;
}

// ========== Ranking Table ==========
.ranking-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  padding: 14px;
}

.ranking-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.ranking-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ranking-header {
  display: flex;
  align-items: center;
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-light);
  border-bottom: 1px solid var(--b3-border-color);
}

.ranking-row {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }
}

.col-rank {
  width: 28px;
  text-align: center;
  flex-shrink: 0;
  font-size: 11px;
  opacity: 0.5;
}

.col-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.col-total {
  width: 70px;
  text-align: right;
  flex-shrink: 0;
  font-weight: 600;
}

.col-days {
  width: 55px;
  text-align: right;
  flex-shrink: 0;
}

.col-avg {
  width: 55px;
  text-align: right;
  flex-shrink: 0;
}

.col-bar {
  width: 120px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-left: 8px;
}

.bar-track {
  flex: 1;
  height: 6px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 2px;
}

.bar-label {
  width: 32px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  text-align: right;
}
</style>
