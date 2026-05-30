<template>
  <div class="notebook-activity-trend">
    <div class="trend-header">
      <div class="period-selector">
        <button
          v-for="opt in periodOptions"
          :key="opt.value"
          class="period-btn"
          :class="{ active: days === opt.value }"
          @click="switchPeriod(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="trend-loading"
    >
      加载中...
    </div>

    <div
      v-else-if="notebooks.length === 0"
      class="trend-empty"
    >
      暂无数据
    </div>

    <div
      v-else
      class="trend-chart-wrap"
    >
      <div class="trend-legend-row">
        <div
          v-for="nb in activeNotebooks"
          :key="nb.notebook"
          class="trend-legend-item"
          :class="{ dimmed: hoveredNb && hoveredNb !== nb.notebook }"
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

      <div class="trend-svg-container">
        <svg
          :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
          class="trend-svg"
          preserveAspectRatio="none"
        >
          <line
            v-for="i in gridLines"
            :key="`grid-${i}`"
            :x1="PAD_L"
            :y1="i"
            :x2="CHART_W - PAD_R"
            :y2="i"
            class="chart-grid-line"
          />
          <text
            v-for="(label, idx) in yLabels"
            :key="`yl-${idx}`"
            :x="PAD_L - 6"
            :y="label.y"
            class="chart-y-label"
            text-anchor="end"
          >{{ label.text }}</text>
          <text
            v-for="(pt, idx) in xLabels"
            :key="`xl-${idx}`"
            :x="pt.x"
            :y="CHART_H - 4"
            class="chart-x-label"
            text-anchor="middle"
          >{{ pt.label }}</text>
          <path
            v-for="nb in activeNotebooks"
            :key="nb.notebook"
            :d="nbLinePaths.get(nb.notebook) || ''"
            class="trend-line"
            :class="{ dimmed: hoveredNb && hoveredNb !== nb.notebook }"
            :style="{ stroke: nb.color }"
            fill="none"
          />
          <circle
            v-for="(dot, di) in allDots"
            :key="`dot-${di}`"
            :cx="dot.x"
            :cy="dot.y"
            :r="2"
            :fill="dot.color"
            :class="{ dimmed: hoveredNb && hoveredNb !== dot.notebook }"
          />
          <rect
            v-for="(hit, hi) in hitAreas"
            :key="`hit-${hi}`"
            :x="hit.x"
            :y="0"
            :width="hit.w"
            :height="CHART_H - 20"
            class="chart-hit-area"
            @mouseenter="hoveredX = hi"
            @mouseleave="hoveredX = -1"
          />
          <line
            v-if="hoveredX >= 0 && xLabels[hoveredX]"
            :x1="xLabels[hoveredX].x"
            :y1="PAD_T"
            :x2="xLabels[hoveredX].x"
            :y2="CHART_H - 20"
            class="chart-hover-line"
          />
        </svg>
      </div>

      <div
        v-if="hoveredX >= 0 && xLabels[hoveredX]"
        class="trend-tooltip"
        :style="{ left: tooltipLeft, top: tooltipTop }"
      >
        <div class="tooltip-date">{{ dateAt(hoveredX) }}</div>
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
          <span class="tooltip-val">{{ formatNumber(nb.data[hoveredX]?.words || 0) }} 字</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotebookActivityItem } from "../types"
import { computed, ref, watch } from "vue"
import { formatNumber } from "../utils"

interface Props {
  onGetNotebookActivityTrend?: (days: number) => Promise<NotebookActivityItem[]>
}

const props = defineProps<Props>()

const CHART_W = 600
const CHART_H = 200
const PAD_L = 38
const PAD_R = 8
const PAD_T = 12

const days = ref(7)
const periodOptions = [
  { label: "7天", value: 7 },
  { label: "15天", value: 15 },
  { label: "30天", value: 30 },
]

const loading = ref(false)
const notebooks = ref<NotebookActivityItem[]>([])
const hoveredNb = ref<string | null>(null)
const hoveredX = ref(-1)

const activeNotebooks = computed(() =>
  notebooks.value.filter(
    (n) => n.data.some((d) => d.words > 0),
  ),
)

const plotW = computed(() => CHART_W - PAD_L - PAD_R)
const plotH = computed(() => CHART_H - PAD_T - 20)

const yRange = computed(() => {
  let maxVal = 1
  for (const nb of activeNotebooks.value) {
    for (const d of nb.data) {
      maxVal = Math.max(maxVal, d.words)
    }
  }
  return { min: 0, max: maxVal }
})

const gridLines = computed(() => {
  const lines = []
  for (let i = 0; i <= 4; i++) {
    lines.push(PAD_T + plotH.value * (1 - i / 4))
  }
  return lines
})

const yLabels = computed(() => {
  const { min, max } = yRange.value
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

  const showEvery = n <= 8 ? 1 : Math.ceil(n / 8)
  for (let i = 0; i < n; i++) {
    if (i % showEvery === 0 || i === n - 1) {
      const nb = activeNotebooks.value[0]
      if (nb?.data[i]) {
        labels.push({
          x: PAD_L + i * stepW.value,
          label: nb.data[i].dateLabel.split(" ")[0],
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
  const { min, max } = yRange.value
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
      map.set(nb.notebook, `M ${pts.join(" L ")}`)
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
  if (hoveredX.value < 0) return "0"
  const pct = (toX(hoveredX.value) / CHART_W) * 100
  return pct > 60 ? `calc(${pct}% - 130px)` : `${pct}%`
})

const tooltipTop = computed(() => "8px")

function dateAt(idx: number): string {
  return activeNotebooks.value[0]?.data[idx]?.date ?? ""
}

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

watch(days, () => {})

defineExpose({ load })
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.notebook-activity-trend {
  padding: 4px 0;
}

.trend-header {
  margin-bottom: 8px;
}

.period-selector {
  display: flex;
  gap: 4px;
}

.period-btn {
  @include stats.small-action-btn;
}

.trend-loading,
.trend-empty {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.trend-chart-wrap {
  position: relative;
}

.trend-legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
  padding: 0 4px;
}

.trend-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: opacity 0.15s, background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.dimmed {
    opacity: 0.3;
  }
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  white-space: nowrap;
}

.trend-svg-container {
  width: 100%;
  overflow: hidden;
}

.trend-svg {
  width: 100%;
  height: auto;
  display: block;
}

.chart-grid-line {
  stroke: var(--b3-border-color);
  stroke-width: 0.5;
  stroke-dasharray: 3 3;
}

.chart-y-label {
  font-size: 9px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.chart-x-label {
  font-size: 9px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.trend-line {
  stroke-width: 1.5;
  opacity: 0.7;
  transition: opacity 0.15s;

  &.dimmed {
    opacity: 0.15;
  }
}

.chart-hit-area {
  fill: transparent;
}

.chart-hover-line {
  stroke: var(--b3-theme-primary);
  stroke-width: 1;
  stroke-dasharray: 4 2;
}

.trend-tooltip {
  position: absolute;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 11px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 100px;
  z-index: 10;
}

.tooltip-date {
  font-weight: 600;
  margin-bottom: 3px;
  color: var(--b3-theme-on-surface);
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.tooltip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-name {
  flex: 1;
}

.tooltip-val {
  font-weight: 600;
}
</style>
