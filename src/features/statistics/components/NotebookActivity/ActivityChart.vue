<!-- 笔记本活跃度折线图：自适应宽度多线趋势图 + 图例 + 悬停 tooltip -->
<template>
  <div class="chart-card">
    <div class="card-title">
      <!-- 图表标题："活跃趋势" -->
      {{ i18n.activityTrendTitle }}
    </div>

    <!-- 图例 -->
    <div class="chart-legend">
      <div
        v-for="nb in notebooks"
        :key="nb.notebook"
        class="legend-item"
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

    <!-- 图表区：离开容器才清除悬停，避免热区间切换闪烁 -->
    <div
      ref="chartWrapRef"
      class="chart-container"
      @mouseleave="hoveredX = -1"
    >
      <svg
        :width="chartW"
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
        <!-- X 轴标签（按步距抽稀） -->
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
          v-for="nb in notebooks"
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
          :height="plotH"
          class="hit-area"
          @mouseenter="hoveredX = hi"
        />
        <!-- 悬停竖线 -->
        <line
          v-if="hoveredX >= 0"
          :x1="toX(hoveredX)"
          :y1="PAD_T"
          :x2="toX(hoveredX)"
          :y2="CHART_H - 20"
          class="hover-line"
        />
      </svg>

      <!-- 悬停提示 -->
      <div
        v-if="hoveredX >= 0"
        class="tooltip"
        :style="{
          left: tooltipLeft,
          top: TOOLTIP_TOP,
        }"
      >
        <div class="tooltip-date">
          {{ dateAt(hoveredX) }}
        </div>
        <div
          v-for="nb in notebooks"
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
</template>

<script setup lang="ts">
import type { NotebookActivityItem } from "../../types"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { formatNumber } from "../../utils"

interface Props {
  notebooks: NotebookActivityItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  notebooks: () => [],
  i18n: () => ({}),
})

const CHART_H = 240
const PAD_L = 42
const PAD_R = 8
const PAD_T = 14
const MIN_CHART_W = 320
const MIN_STEP_PX = 2
const TOOLTIP_TOP = "8px"

const hoveredNb = ref<string | null>(null)
const hoveredX = ref(-1)

// ========== 容器宽度测量（图表自适应） ==========
const chartWrapRef = ref<HTMLElement>()
const containerW = ref(0)
let resizeObserver: ResizeObserver | null = null

function updateWidth(): void {
  if (chartWrapRef.value) {
    containerW.value = chartWrapRef.value.clientWidth
  }
}

onMounted(() => {
  updateWidth()
  if (chartWrapRef.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(chartWrapRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

// ========== 绘图几何 ==========
const dataLen = computed(() => props.notebooks[0]?.data.length ?? 0)

const baseW = computed(() => Math.max(containerW.value, MIN_CHART_W))
const plotW = computed(() => Math.max(baseW.value - PAD_L - PAD_R, 0))

// 点间距：短周期铺满容器；长周期下限 2px 保证可读，超出则横向滚动
const stepW = computed(() => {
  if (dataLen.value <= 1) return plotW.value
  return Math.max(plotW.value / (dataLen.value - 1), MIN_STEP_PX)
})

const chartW = computed(() => {
  const n = Math.max(dataLen.value - 1, 0)
  return Math.max(containerW.value, PAD_L + n * stepW.value + PAD_R)
})

const plotH = computed(() => CHART_H - PAD_T - 20)

const yRange = computed(() => {
  let maxVal = 1
  for (const nb of props.notebooks) {
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
  const lines: number[] = []
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

// X 轴标签抽稀：约 48px 一个，长周期下避免重叠
const labelStep = computed(() => {
  if (dataLen.value <= 1) return 1
  return Math.max(1, Math.ceil(48 / stepW.value))
})

const xLabels = computed(() => {
  const nb = props.notebooks[0]
  if (!nb) return []
  const labels: Array<{ x: number, label: string }> = []
  const n = nb.data.length
  for (let i = 0; i < n; i += labelStep.value) {
    labels.push({
      x: toX(i),
      label: nb.data[i]?.dateLabel.split(" ")[0] ?? "",
    })
  }
  // 末点必显，保证终点日期可见
  if (n > 1 && (n - 1) % labelStep.value !== 0) {
    labels.push({
      x: toX(n - 1),
      label: nb.data[n - 1]?.dateLabel.split(" ")[0] ?? "",
    })
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
  for (const nb of props.notebooks) {
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
  for (const nb of props.notebooks) {
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
  const areas: Array<{ x: number, w: number }> = []
  const half = Math.max(stepW.value / 2, 4)
  for (let i = 0; i < dataLen.value; i++) {
    areas.push({
      x: Math.max(0, toX(i) - half),
      w: half * 2,
    })
  }
  return areas
})

// 基于内容坐标的像素定位：横向滚动时 tooltip 与悬停竖线保持对齐；靠近右端左移避免溢出
const tooltipLeft = computed(() => {
  if (hoveredX.value < 0) return "0px"
  const x = toX(hoveredX.value)
  return x > chartW.value - 150 ? `${x - 150}px` : `${x}px`
})

function dateAt(idx: number): string {
  return props.notebooks[0]?.data[idx]?.date ?? ""
}
</script>

<style scoped lang="scss">
@use '../../styles/NotebookActivity.scss';
@use '../../styles/index.scss' as stats;
</style>
