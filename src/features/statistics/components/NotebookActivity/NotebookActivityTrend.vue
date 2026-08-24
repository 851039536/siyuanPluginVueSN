<!-- 笔记本写作活跃度趋势：多线折线图 + 活跃排行表 -->
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
          <!-- 摘要标签："活跃笔记本" -->
          {{ i18n.activeNotebooks }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ summary.mostActive }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："最活跃" -->
          {{ i18n.mostActive }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ formatNumber(summary.totalWords) }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："期间总字数" -->
          {{ i18n.periodTotalWords }}
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">
          {{ formatNumber(summary.dailyAvg) }}
        </div>
        <div class="summary-label">
          <!-- 摘要标签："日均字数" -->
          {{ i18n.dailyAvgWords }}
        </div>
      </div>
    </div>

    <!-- 加载 / 空状态 -->
    <div
      v-if="loading"
      class="trend-loading"
    >
      <!-- 加载提示："加载中..." -->
      {{ i18n.loading }}
    </div>
    <div
      v-else-if="notebooks.length === 0"
      class="trend-empty"
    >
      <!-- 空状态："暂无数据" -->
      {{ i18n.noData }}
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
            :width="svgPixelW"
            :height="CHART_H"
            class="chart-svg"
          >
            <!-- 网格线 -->
            <line
              v-for="i in gridLines"
              :key="`grid-${i}`"
              :x1="PAD_L"
              :y1="i"
              :x2="chartW - PAD_R"
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
              <!-- tooltip 值："{字数} 字" -->
              <span class="tooltip-val">{{ formatNumber(nb.data[hoveredX]?.words || 0) }} {{ i18n.wordsUnit }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 笔记本排行表 -->
      <NotebookRankingTable
        :notebooks="activeNotebooks"
        :i18n="i18n"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { NotebookActivityItem } from "../../types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { formatNumber } from "../../utils"
import NotebookRankingTable from "./NotebookRankingTable.vue"

interface Props {
  onGetNotebookActivityTrend?: (days: number) => Promise<NotebookActivityItem[]>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const CHART_H = 240
const PAD_L = 42
const PAD_R = 8
const PAD_T = 14
const POINT_SPACING = 40

const days = ref(30)
// 时间范围选项（30/60/90/180/200天/1年）
const periodOptions = computed(() => [
  {
    label: props.i18n.days30,
    value: 30,
  },
  {
    label: props.i18n.days60,
    value: 60,
  },
  {
    label: props.i18n.days90,
    value: 90,
  },
  {
    label: props.i18n.days180,
    value: 180,
  },
  {
    label: props.i18n.days200,
    value: 200,
  },
  {
    label: props.i18n.year1,
    value: 365,
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
// SVG 像素宽度：严格按每天 POINT_SPACING 计算
const svgPixelW = computed(() => {
  const n = dataLen.value
  return PAD_L + n * POINT_SPACING + PAD_R
})

// 内部绘图宽度（与像素宽度一致，无缩放）
const chartW = svgPixelW

const plotW = computed(() => chartW.value - PAD_L - PAD_R)
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

  // 每天显示日期标签，40px 间距足够容纳
  for (let i = 0; i < n; i++) {
    const nb = activeNotebooks.value[0]
    if (nb?.data[i]) {
      labels.push({
        x: PAD_L + i * stepW.value,
        label: nb.data[i].dateLabel.split(' ')[0],
      })
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
  const pct = (toX(hoveredX.value) / chartW.value) * 100
  return pct > 60 ? `calc(${pct}% - 140px)` : `${pct}%`
})

const tooltipTop = computed(() => '8px')

function dateAt(idx: number): string {
  return activeNotebooks.value[0]?.data[idx]?.date ?? ''
}

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
</script>

<style scoped lang="scss">
@use '../../styles/NotebookActivityTrend.scss';
@use '../../styles/index.scss' as stats;
</style>
