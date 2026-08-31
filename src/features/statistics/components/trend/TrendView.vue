<!-- 趋势分析视图：趋势折线图 + 周期对比卡 + 历史数据表格 -->
<template>
  <div class="trend-view">
    <!-- 标题行：包含标题和日均统计 -->
    <div class="section-header">
      <h3 class="section-title">
        <!-- 区块标题："趋势分析" -->
        {{ i18n.trendTitle }}
      </h3>
      <div
        v-if="trendStats"
        class="trend-stats-inline"
      >
        <span class="stat-item"><IconWrapper
          name="list"
          :size="12"
        /> {{ i18n.avgDailyCreated }} <strong>{{ trendStats.avgDailyCreated }}</strong></span>
        <span class="stat-item"><IconWrapper
          name="edit"
          :size="12"
        /> {{ i18n.avgDailyModified }} <strong>{{ trendStats.avgDailyModified }}</strong></span>
      </div>
    </div>

    <!-- 周期对比汇总（日/周/月环比卡片） -->
    <PeriodCompareCard
      :historical-data="historicalData"
      :i18n="i18n"
    />

    <!-- 趋势图表 -->
    <div
      v-if="historicalData.length > 1"
      class="trend-chart-section"
    >
      <div class="chart-header">
        <h4 class="subsection-title">
          {{ i18n.historicalData }}
        </h4>
        <div class="chart-header-controls">
          <!-- 图表模式切换：折线图 / K线图 -->
          <div class="chart-mode-tabs">
            <!-- 模式按钮："折线图" -->
            <button
              class="metric-tab"
              :class="{ active: chartMode === 'line' }"
              :title="i18n.chartModeLine"
              @click="switchChartMode('line')"
            >
              <IconWrapper
                name="chartLine"
                :size="12"
              />
            </button>
            <!-- 模式按钮："K线图" -->
            <button
              class="metric-tab"
              :class="{ active: chartMode === 'kline' }"
              :title="i18n.chartModeKLine"
              @click="switchChartMode('kline')"
            >
              <IconWrapper
                name="chartCandlestick"
                :size="12"
              />
            </button>
          </div>
          <div class="chart-metric-tabs">
            <button
              v-for="tab in metricTabs"
              :key="tab.key"
              class="metric-tab"
              :class="{ active: activeMetric === tab.key }"
              @click="activeMetric = tab.key"
            >
              <IconWrapper
                :name="tab.icon"
                :size="12"
              /> {{ tab.label }}
            </button>
          </div>
        </div>
      </div>
      <!-- 折线模式：手写 SVG 趋势图 -->
      <div
        v-if="chartMode === 'line'"
        class="trend-chart-container"
      >
        <svg
          class="trend-chart-svg"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        >
          <!-- 网格线 -->
          <line
            v-for="i in gridLines"
            :key="`grid-${i}`"
            :x1="chartPaddingLeft"
            :y1="i"
            :x2="chartWidth - chartPaddingRight"
            :y2="i"
            class="chart-grid-line"
          />
          <!-- Y轴标签 -->
          <text
            v-for="(label, idx) in yAxisLabels"
            :key="`ylabel-${idx}`"
            :x="chartPaddingLeft - 6"
            :y="label.y"
            class="chart-y-label"
            text-anchor="end"
          >{{ label.text }}</text>
          <!-- 面积填充 -->
          <path
            :d="areaPath"
            class="chart-area"
          />
          <!-- 折线 -->
          <path
            :d="linePath"
            class="chart-line"
            fill="none"
          />
          <!-- 数据点（今日点放大高亮） -->
          <circle
            v-for="(pt, idx) in chartPoints"
            :key="`pt-${idx}`"
            :cx="pt.x"
            :cy="pt.y"
            :r="isTodayPoint(idx) ? 4 : 2.5"
            class="chart-dot"
            :class="[{ 'chart-dot-today': isTodayPoint(idx) }]"
          />
          <!-- X轴日期标签 -->
          <text
            v-for="(pt, idx) in chartPoints"
            :key="`xlabel-${idx}`"
            :x="pt.x"
            :y="chartHeight - 4"
            class="chart-x-label"
            text-anchor="middle"
          >{{ getXLabel(idx) }}</text>
          <!-- Tooltip 悬浮 -->
          <rect
            v-for="(pt, idx) in chartPoints"
            :key="`hover-${idx}`"
            :x="pt.x - hitWidth / 2"
            :y="0"
            :width="hitWidth"
            :height="chartHeight - 20"
            class="chart-hit-area"
            @mouseenter="hoveredIndex = idx"
            @mouseleave="hoveredIndex = -1"
          />
          <!-- Tooltip 竖线 -->
          <line
            v-if="hoveredIndex >= 0 && chartPoints[hoveredIndex]"
            :x1="chartPoints[hoveredIndex].x"
            :y1="chartPaddingTop"
            :x2="chartPoints[hoveredIndex].x"
            :y2="chartHeight - 20"
            class="chart-hover-line"
          />
        </svg>
        <!-- Tooltip 内容 -->
        <div
          v-if="hoveredIndex >= 0 && chartPoints[hoveredIndex]"
          class="chart-tooltip"
        >
          <div class="tooltip-date">
            {{ historicalData[hoveredIndex]?.dateLabel || historicalData[hoveredIndex]?.date }}
          </div>
          <div class="tooltip-value">
            <IconWrapper
              class="tooltip-metric-icon"
              :name="activeMetricObj.icon"
              :size="12"
            />
            <strong>{{ formatNumber(chartPoints[hoveredIndex].value) }}</strong>
            <span class="tooltip-unit">{{ activeMetricObj.unit }}</span>
          </div>
        </div>
      </div>

      <!-- K 线模式：chart.js 蜡烛图（实体=开盘/收盘，影线=最高/最低，叠加 7 日均线） -->
      <KLineChart
        v-else
        :historical-data="historicalData"
        :metric="klineMetric"
        :i18n="i18n"
      />
    </div>

    <!-- 历史数据表格 -->
    <HistoryTable
      :historical-data="historicalData"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
import type { HistoricalDataItem } from "../../types"
import type { KLineMetric } from "../../types/storage"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatNumber,
  formatShortNumber,
} from "../../utils"
import { KLINE_METRICS } from "../../utils/candlestick"
import HistoryTable from "./HistoryTable.vue"
import KLineChart from "./KLineChart/index.vue"
import PeriodCompareCard from "./PeriodCompareCard.vue"

interface Props {
  historicalData?: HistoricalDataItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({}),
})

// ===== 趋势图表状态 =====
type MetricKey = "totalWords" | "totalNotes" | "totalBlocks" | "todayCreated" | "todayModified"

/** 图表模式：折线（手写 SVG）/ K 线（chart.js 蜡烛图） */
const chartMode = ref<"line" | "kline">("line")

const activeMetric = ref<MetricKey>("totalWords")
const hoveredIndex = ref(-1)

/** 传给 KLineChart 的指标（收窄为 KLineMetric） */
const klineMetric = computed<KLineMetric>(() =>
  activeMetric.value === "totalNotes" ? "totalNotes" : "totalWords",
)

/** 切换图表模式：K 线模式下当前指标不受支持时重置为总字数 */
function switchChartMode(mode: "line" | "kline"): void {
  chartMode.value = mode
  if (mode === "kline" && !KLINE_METRICS.includes(activeMetric.value as KLineMetric)) {
    activeMetric.value = "totalWords"
  }
}

const ALL_METRIC_TABS = [
  {
    key: "totalWords" as const,
    icon: "edit" as const,
    label: props.i18n.words,
    unit: props.i18n.wordsUnit,
  },
  {
    key: "totalNotes" as const,
    icon: "file" as const,
    label: props.i18n.notes,
    unit: props.i18n.notesUnit,
  },
  {
    key: "totalBlocks" as const,
    icon: "format" as const,
    label: props.i18n.blocks,
    unit: props.i18n.blocksUnit,
  },
  {
    key: "todayCreated" as const,
    icon: "list" as const,
    label: props.i18n.created,
    unit: props.i18n.notesUnit,
  },
  {
    key: "todayModified" as const,
    icon: "edit" as const,
    label: props.i18n.modified,
    unit: props.i18n.notesUnit,
  },
]

// K 线模式下指标仅剩累计型（总字数/总笔记）
const metricTabs = computed(() => chartMode.value === "kline"
  ? ALL_METRIC_TABS.filter((t) => KLINE_METRICS.includes(t.key))
  : ALL_METRIC_TABS)

const activeMetricObj = computed(() => metricTabs.value.find((t) => t.key === activeMetric.value) || metricTabs.value[0])

// 图表尺寸参数
const chartHeight = 200
const chartPaddingTop = 16
const chartPaddingBottom = 24
const chartPaddingLeft = 42
const chartPaddingRight = 10
const MIN_POINT_SPACING = 14

const chartWidth = computed(() => {
  const plotWidth = props.historicalData.length * MIN_POINT_SPACING
  return Math.max(600, chartPaddingLeft + plotWidth + chartPaddingRight)
})

const hitWidth = computed(() => {
  const count = props.historicalData.length
  if (count <= 1) return 20
  const availWidth = chartWidth.value - chartPaddingLeft - chartPaddingRight
  return Math.max(10, availWidth / count)
})

// 从历史数据提取当前指标的值数组
const chartValues = computed(() =>
  props.historicalData.map((item) => item[activeMetric.value]),
)

const chartMin = computed(() => {
  const vals = chartValues.value
  if (vals.length === 0) return 0
  const min = Math.min(...vals)
  // 给一些底部留白
  return Math.max(0, min - (Math.max(...vals) - min) * 0.1)
})

const chartMax = computed(() => {
  const vals = chartValues.value
  if (vals.length === 0) return 100
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  if (max === min) return max + 10
  return max + (max - min) * 0.1
})

// 计算图表绘制区域
const drawArea = computed(() => ({
  x: chartPaddingLeft,
  y: chartPaddingTop,
  w: chartWidth.value - chartPaddingLeft - chartPaddingRight,
  h: chartHeight - chartPaddingTop - chartPaddingBottom,
}))

// 计算每个数据点的坐标
const chartPoints = computed(() => {
  const data = props.historicalData
  if (data.length === 0) return []

  const {
    x: sx,
    y: sy,
    w,
    h,
  } = drawArea.value
  const min = chartMin.value
  const max = chartMax.value
  const range = max - min || 1

  return data.map((item, idx) => {
    const val = item[activeMetric.value]
    const px = data.length === 1 ? sx + w / 2 : sx + (idx / (data.length - 1)) * w
    const py = sy + h - ((val - min) / range) * h
    return {
      x: px,
      y: py,
      value: val,
    }
  })
})

// 折线路径
const linePath = computed(() => {
  const pts = chartPoints.value
  if (pts.length === 0) return ""
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
})

// 面积路径（折线 + 底部封闭）
const areaPath = computed(() => {
  const pts = chartPoints.value
  if (pts.length === 0) return ""
  const {
    y: sy,
    h,
  } = drawArea.value
  const bottom = sy + h
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  return `${line} L${pts[pts.length - 1].x},${bottom} L${pts[0].x},${bottom} Z`
})

// Y 轴刻度
const yAxisLabels = computed(() => {
  const {
    y: sy,
    h,
  } = drawArea.value
  const min = chartMin.value
  const max = chartMax.value
  const steps = 4
  const labels = []
  for (let i = 0; i <= steps; i++) {
    const val = min + ((max - min) * i) / steps
    const py = sy + h - (i / steps) * h
    labels.push({
      text: formatShortNumber(Math.round(val)),
      y: py + 3,
    })
  }
  return labels
})

// 网格线 Y 坐标
const gridLines = computed(() => {
  const {
    y: sy,
    h,
  } = drawArea.value
  const steps = 4
  const lines = []
  for (let i = 0; i <= steps; i++) {
    lines.push(sy + h - (i / steps) * h)
  }
  return lines
})

// X 轴标签（稀疏显示，避免重叠）
function getXLabel(idx: number): string {
  const data = props.historicalData
  const total = data.length
  if (total <= 8) return data[idx]?.dateLabel?.split(" ")[0] || ""
  // 间隔显示
  const step = Math.ceil(total / 8)
  if (idx % step === 0 || idx === total - 1) {
    return data[idx]?.dateLabel?.split(" ")[0] || ""
  }
  return ""
}

function isTodayPoint(idx: number): boolean {
  // historicalData 为降序（最新在前）：索引 0 即今日
  return idx === 0
}

// 标题行内联统计（日均新增/日均修改）
const trendStats = computed(() => {
  if (props.historicalData.length === 0) return null

  const totalCreated = props.historicalData.reduce(
    (sum, item) => sum + item.todayCreated,
    0,
  )
  const totalModified = props.historicalData.reduce(
    (sum, item) => sum + item.todayModified,
    0,
  )

  return {
    totalCreated,
    totalModified,
    avgDailyCreated: Math.round(totalCreated / props.historicalData.length),
    avgDailyModified: Math.round(totalModified / props.historicalData.length),
  }
})
</script>


<style scoped lang="scss">
@use "../../styles/TrendView.scss";
@use '../../styles/index.scss' as stats;
</style>
