<template>
  <div class="trend-prediction">
    <div
      v-if="loading"
      class="pred-loading"
    >
      分析中...
    </div>

    <div
      v-else-if="prediction && prediction.historical.length > 0"
      class="pred-content"
    >
      <div class="pred-header">
        <div class="pred-confidence">
          <span class="confidence-label">拟合度 R²</span>
          <span class="confidence-value">{{ (prediction.rSquared * 100).toFixed(1) }}%</span>
        </div>
        <div class="pred-projections">
          <div class="projection-item">
            <span class="proj-icon">📅</span>
            <span class="proj-label">下周预计</span>
            <span class="proj-value">{{ formatNumber(prediction.weeklyProjection) }} 字</span>
          </div>
          <div class="projection-item">
            <span class="proj-icon">📆</span>
            <span class="proj-label">下月预计</span>
            <span class="proj-value">{{ formatNumber(prediction.monthlyProjection) }} 字</span>
          </div>
        </div>
      </div>

      <div class="pred-trend-label">
        <span class="trend-up">▲</span> 趋势：
        <strong
          :class="{ 'trend-pos': prediction.slope > 0, 'trend-neg': prediction.slope < 0 }"
        >
          {{ prediction.slope > 0 ? '上升' : prediction.slope < 0 ? '下降' : '平稳' }}
          （{{ prediction.slope > 0 ? '+' : '' }}{{ prediction.slope.toFixed(1) }} 字/天）
        </strong>
      </div>

      <div class="pred-chart-container">
        <svg
          :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
          class="pred-svg"
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

          <!-- 分隔线 -->
          <line
            :x1="sepX"
            :y1="PAD_T"
            :x2="sepX"
            :y2="CHART_H - 20"
            class="chart-sep-line"
          />

          <!-- 历史折线 -->
          <path
            :d="historyPath"
            class="pred-line history"
            fill="none"
          />
          <!-- 历史面积 -->
          <path
            :d="historyAreaPath"
            class="pred-area history"
          />
          <!-- 预测折线 -->
          <path
            :d="predictPath"
            class="pred-line predict"
            fill="none"
          />
          <!-- 预测面积 -->
          <path
            :d="predictAreaPath"
            class="pred-area predict"
          />
          <!-- 数据点 -->
          <circle
            v-for="(pt, idx) in allPoints"
            :key="`pt-${idx}`"
            :cx="pt.x"
            :cy="pt.y"
            :r="pt.isPred ? 3 : 2"
            :class="{ 'dot-history': !pt.isPred, 'dot-predict': pt.isPred }"
          />
          <!-- hover -->
          <rect
            v-for="(ha, hi) in hitAreas"
            :key="`hit-${hi}`"
            :x="ha.x"
            :y="0"
            :width="ha.w"
            :height="CHART_H - 20"
            class="chart-hit-area"
            @mouseenter="hoveredIndex = hi"
            @mouseleave="hoveredIndex = -1"
          />
          <line
            v-if="hoveredIndex >= 0 && allPoints[hoveredIndex]"
            :x1="allPoints[hoveredIndex].x"
            :y1="PAD_T"
            :x2="allPoints[hoveredIndex].x"
            :y2="CHART_H - 20"
            class="chart-hover-line"
          />
        </svg>
        <div
          v-if="hoveredIndex >= 0 && allPoints[hoveredIndex]"
          class="pred-tooltip"
          :style="{ left: tooltipLeft, top: '4px' }"
        >
          <div class="tooltip-label">
            {{ allPoints[hoveredIndex].label }}
            <span
              v-if="allPoints[hoveredIndex].isPred"
              class="tooltip-pred-badge"
            >预测</span>
          </div>
          <div class="tooltip-val">{{ formatNumber(allPoints[hoveredIndex].value) }} 字</div>
        </div>
      </div>

      <div class="pred-legend">
        <span class="legend-item">
          <span class="legend-dot history"></span> 历史30天
        </span>
        <span class="legend-item">
          <span class="legend-dot predict"></span> 预测7天
        </span>
      </div>
    </div>

    <div
      v-else
      class="pred-empty"
    >
      暂无足够数据生成预测（需要至少2天数据）
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TrendPrediction } from "../types"
import { computed, ref, onMounted } from "vue"
import { formatNumber } from "../utils"

interface Props {
  onGetTrendPrediction?: () => Promise<TrendPrediction>
}

const props = defineProps<Props>()

const CHART_W = 600
const CHART_H = 180
const PAD_L = 36
const PAD_R = 8
const PAD_T = 10

const loading = ref(false)
const prediction = ref<TrendPrediction | null>(null)
const hoveredIndex = ref(-1)

const allData = computed(() => {
  if (!prediction.value) return []
  return [
    ...prediction.value.historical.map((h, i) => ({
      ...h,
      isPred: false,
      idx: i,
    })),
    ...prediction.value.predicted.map((p, i) => ({
      ...p,
      isPred: true,
      idx: prediction.value!.historical.length + i,
    })),
  ]
})

const plotW = computed(() => CHART_W - PAD_L - PAD_R)
const plotH = computed(() => CHART_H - PAD_T - 20)

const yRange = computed(() => {
  let max = 1
  for (const d of allData.value) {
    max = Math.max(max, d.words)
  }
  return { min: 0, max: max * 1.1 }
})

const gridLines = computed(() =>
  [0, 1, 2, 3, 4].map((i) => PAD_T + plotH.value * (1 - i / 4)),
)

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

const totalLen = computed(() => allData.value.length)
const stepW = computed(() => (totalLen.value > 1 ? plotW.value / (totalLen.value - 1) : plotW.value))
const histLen = computed(() => prediction.value?.historical.length || 0)
const sepX = computed(() => {
  if (histLen.value < 2) return PAD_L
  return PAD_L + (histLen.value - 1) * stepW.value + stepW.value / 2
})

function toX(idx: number): number {
  return PAD_L + idx * stepW.value
}

function toY(val: number): number {
  const { min, max } = yRange.value
  const range = max - min || 1
  return PAD_T + plotH.value * (1 - (val - min) / range)
}

function makePath(items: Array<{ words: number }>, startIdx: number): string {
  const pts = items.map((d, i) => `${toX(startIdx + i)} ${toY(d.words)}`)
  return pts.length > 0 ? `M ${pts.join(" L ")}` : ""
}

function makeAreaPath(items: Array<{ words: number }>, startIdx: number): string {
  if (items.length === 0) return ""
  const pts = items.map((d, i) => `${toX(startIdx + i)} ${toY(d.words)}`)
  const lastIdx = startIdx + items.length - 1
  const baseY = toY(0)
  return `M ${toX(startIdx)} ${baseY} L ${pts.join(" L ")} L ${toX(lastIdx)} ${baseY} Z`
}

const historyPath = computed(() => makePath(prediction.value?.historical || [], 0))
const historyAreaPath = computed(() => makeAreaPath(prediction.value?.historical || [], 0))
const predictPath = computed(() => makePath(prediction.value?.predicted || [], histLen.value))
const predictAreaPath = computed(() => makeAreaPath(prediction.value?.predicted || [], histLen.value))

interface ChartPoint {
  x: number
  y: number
  value: number
  label: string
  isPred: boolean
}

const allPoints = computed<ChartPoint[]>(() =>
  allData.value.map((d, idx) => ({
    x: toX(idx),
    y: toY(d.words),
    value: d.words,
    label: d.dateLabel,
    isPred: d.isPred,
  })),
)

const hitAreas = computed(() => {
  const n = totalLen.value
  const half = Math.max(stepW.value / 2, 4)
  return Array.from({ length: n }, (_, i) => ({
    x: Math.max(0, toX(i) - half),
    w: half * 2,
  }))
})

const tooltipLeft = computed(() => {
  if (hoveredIndex.value < 0) return "0"
  const pct = (toX(hoveredIndex.value) / CHART_W) * 100
  return pct > 50 ? `calc(${pct}% - 100px)` : `${pct}%`
})

async function load() {
  if (!props.onGetTrendPrediction) return
  loading.value = true
  try {
    prediction.value = await props.onGetTrendPrediction()
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
@use "../styles/index.scss" as stats;

.trend-prediction {
  padding: 4px 0;
}

.pred-loading,
.pred-empty {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.pred-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pred-header {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.confidence-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.confidence-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  margin-left: 4px;
}

.pred-projections {
  display: flex;
  gap: 10px;
}

.projection-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.proj-icon {
  font-size: 12px;
}

.proj-label {
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

.proj-value {
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.pred-trend-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);

  .trend-up {
    color: #22c55e;
  }

  .trend-pos {
    color: #22c55e;
  }

  .trend-neg {
    color: #ef4444;
  }
}

.pred-chart-container {
  position: relative;
  width: 100%;
}

.pred-svg {
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

.chart-sep-line {
  stroke: var(--b3-theme-primary);
  stroke-width: 1;
  stroke-dasharray: 6 3;
  opacity: 0.4;
}

.pred-line {
  stroke-width: 2;

  &.history {
    stroke: var(--b3-theme-primary);
  }

  &.predict {
    stroke: #f59e0b;
    stroke-dasharray: 6 3;
  }
}

.pred-area {
  opacity: 0.08;

  &.history {
    fill: var(--b3-theme-primary);
  }

  &.predict {
    fill: #f59e0b;
  }
}

.dot-history {
  fill: var(--b3-theme-primary);
}

.dot-predict {
  fill: #f59e0b;
}

.chart-hit-area {
  fill: transparent;
}

.chart-hover-line {
  stroke: var(--b3-theme-primary);
  stroke-width: 1;
  stroke-dasharray: 4 2;
}

.pred-tooltip {
  position: absolute;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.tooltip-label {
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.tooltip-pred-badge {
  display: inline-block;
  background: #f59e0b;
  color: #fff;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
}

.tooltip-val {
  font-weight: 700;
  color: var(--b3-theme-on-surface);
}

.pred-legend {
  display: flex;
  gap: 12px;
  padding: 2px 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

.legend-dot {
  width: 12px;
  height: 3px;
  border-radius: 2px;

  &.history {
    background: var(--b3-theme-primary);
  }

  &.predict {
    background: #f59e0b;
  }
}
</style>
