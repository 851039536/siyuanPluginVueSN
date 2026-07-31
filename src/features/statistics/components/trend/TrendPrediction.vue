<!-- 趋势预测组件：基于线性回归的字数趋势预测图 -->
<template>
  <div class="trend-prediction">
    <div
      v-if="loading"
      class="pred-loading"
    >
      <!-- 加载提示："分析中..." -->
      {{ i18n.predAnalyzing }}
    </div>

    <div
      v-else-if="prediction && prediction.historical.length > 0"
      class="pred-content"
    >
      <!-- 指标卡行：拟合度 / 下周预计 / 下月预计（对齐概览核心指标卡样式） -->
      <div class="pred-stats-row">
        <div class="pred-stat-card">
          <!-- 指标标签："拟合度 R²" -->
          <span class="pred-stat-label">{{ i18n.predFitLabel }}</span>
          <span class="pred-stat-value">{{ (prediction.rSquared * 100).toFixed(1) }}%</span>
        </div>
        <div class="pred-stat-card">
          <!-- 指标标签："下周预计" -->
          <span class="pred-stat-label">{{ i18n.predNextWeek }}</span>
          <span class="pred-stat-value">
            {{ formatNumber(prediction.weeklyProjection) }}
            <!-- 单位："字" -->
            <span class="pred-stat-unit">{{ i18n.wordsUnit }}</span>
          </span>
        </div>
        <div class="pred-stat-card">
          <!-- 指标标签："下月预计" -->
          <span class="pred-stat-label">{{ i18n.predNextMonth }}</span>
          <span class="pred-stat-value">
            {{ formatNumber(prediction.monthlyProjection) }}
            <!-- 单位："字" -->
            <span class="pred-stat-unit">{{ i18n.wordsUnit }}</span>
          </span>
        </div>
      </div>

      <!-- 趋势方向行："趋势：上升/下降/平稳（±X 字/天）" -->
      <div class="pred-trend-label">
        <span
          class="trend-icon"
          :class="trendClass"
        >
          <IconWrapper
            :name="trendIcon"
            :size="12"
          />
        </span>
        <!-- 标签："趋势" -->
        <span>{{ i18n.predTrendLabel }}：</span>
        <strong :class="trendClass">
          {{ trendText }}
          <!-- 斜率单位："字/天" -->
          （{{ prediction.slope > 0 ? '+' : '' }}{{ prediction.slope.toFixed(1) }} {{ i18n.predSlopeUnit }}）
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
            :class="{
              'dot-history': !pt.isPred,
              'dot-predict': pt.isPred,
            }"
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
          :style="{
            left: tooltipLeft,
            top: '4px',
          }"
        >
          <div class="tooltip-label">
            {{ allPoints[hoveredIndex].label }}
            <!-- 预测点徽章："预测" -->
            <span
              v-if="allPoints[hoveredIndex].isPred"
              class="tooltip-pred-badge"
            >{{ i18n.predBadge }}</span>
          </div>
          <div class="tooltip-val">
            <!-- 数值 + 单位："X 字" -->
            {{ formatNumber(allPoints[hoveredIndex].value) }} {{ i18n.wordsUnit }}
          </div>
        </div>
      </div>

      <!-- 图例："历史30天" / "预测7天" -->
      <div class="pred-legend">
        <span class="legend-item">
          <span class="legend-dot history"></span> {{ i18n.predLegendHistory }}
        </span>
        <span class="legend-item">
          <span class="legend-dot predict"></span> {{ i18n.predLegendFuture }}
        </span>
      </div>
    </div>

    <div
      v-else
      class="pred-empty"
    >
      <!-- 空状态："暂无足够数据生成预测（需要至少2天数据）" -->
      {{ i18n.predEmpty }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TrendPrediction } from "../../types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatNumber } from "../../utils"

interface Props {
  onGetTrendPrediction?: () => Promise<TrendPrediction>
  i18n?: Record<string, any>
}

const props = defineProps<Props>()

const i18n = computed(() => props.i18n || {})

const CHART_W = 600
const CHART_H = 180
const PAD_L = 36
const PAD_R = 8
const PAD_T = 10

const loading = ref(false)
const prediction = ref<TrendPrediction | null>(null)
const hoveredIndex = ref(-1)

// 趋势方向：图标 / 样式类 / 文案均由斜率符号推导
const trendIcon = computed(() => {
  const slope = prediction.value?.slope ?? 0
  return slope > 0 ? "trendingUp" : slope < 0 ? "trendingDown" : "trendingNeutral"
})

const trendClass = computed(() => {
  const slope = prediction.value?.slope ?? 0
  return slope > 0 ? "trend-pos" : slope < 0 ? "trend-neg" : "trend-flat"
})

const trendText = computed(() => {
  const slope = prediction.value?.slope ?? 0
  return slope > 0 ? i18n.value.predTrendUp : slope < 0 ? i18n.value.predTrendDown : i18n.value.predTrendFlat
})

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
  return {
    min: 0,
    max: max * 1.1,
  }
})

const gridLines = computed(() =>
  [0, 1, 2, 3, 4].map((i) => PAD_T + plotH.value * (1 - i / 4)),
)

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
  const {
    min,
    max,
  } = yRange.value
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
</script>

<style scoped lang="scss">
@use "../../styles/TrendPrediction.scss";
@use '../../styles/index.scss' as stats;
</style>
