<!-- gitPush 代码统计报告：提交趋势分区（chart.js 蜡烛图展示每日提交时刻分布 + 摘要卡片） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："提交趋势" + 活跃天数徽章（悬浮说明统计口径） -->
    <div class="gpr-section-title">
      {{ i18n.reportCandlestickTitle }}
      <span
        class="gpr-section-count"
        :title="i18n.reportCandlestickTotalDays"
      >{{ stats.length }}</span>
    </div>

    <!-- 空状态：范围内无提交 -->
    <EmptyState
      v-if="stats.length === 0"
      icon="mdi:chart-finance"
      :text="i18n.reportNoData"
    />

    <template v-else>
      <!-- 图例：涨/跌/平色块 + K 线语义说明 -->
      <div class="gpc-legend">
        <span class="gpc-legend-item">
          <span class="gpc-legend-dot gpc-legend-dot--up" />
          {{ i18n.reportCandlestickUp }}
        </span>
        <span class="gpc-legend-item">
          <span class="gpc-legend-dot gpc-legend-dot--down" />
          {{ i18n.reportCandlestickDown }}
        </span>
        <span class="gpc-legend-item">
          <span class="gpc-legend-dot gpc-legend-dot--flat" />
          {{ i18n.reportCandlestickFlat }}
        </span>
        <span class="gpc-legend-hint">{{ i18n.reportCandlestickHint }}</span>
      </div>

      <!-- K 线图（chart.js Bar 浮动条 + 影线插件：实体=首末提交时刻跨度，影线=±0.5h 缓冲） -->
      <div class="gpc-chart-wrap">
        <Bar
          :data="barData"
          :options="chartOptions"
          :plugins="chartPlugins"
        />
      </div>

      <!-- 摘要卡片：提交天数/总提交/日均提交/最高单日 -->
      <div class="gpc-cards">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="gpc-card"
        >
          <div class="gpc-card-value">
            {{ card.value }}
          </div>
          <div
            class="gpc-card-label"
            :title="card.tip"
          >
            {{ card.label }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 提交趋势分区：聚合 dailyStats → chart.js 蜡烛图（实体=首末提交时刻跨度、影线=±0.5h 缓冲、颜色=提交量较前日涨跌）+ 摘要卡片
import type { ChartData, ChartOptions, Plugin } from "chart.js"
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js"
import { Bar } from "vue-chartjs"
import { computed } from "vue"
import type { CodeReportData, DailyCommitStat } from "../../types"
import EmptyState from "../common/EmptyState.vue"

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

/** K 线涨跌色：较前一活跃日提交量增加=绿（涨），减少=红（跌），持平/首日=灰 */
const UP_COLOR = "#10b981"
const DOWN_COLOR = "#ef4444"
const FLAT_COLOR = "#64748b"
/** 坐标轴刻度色（半透明灰，浅/深主题均可见；canvas 不支持 CSS var 故用固定色） */
const AXIS_COLOR = "rgba(128, 128, 128, 0.8)"
/** 网格线色 */
const GRID_COLOR = "rgba(128, 128, 128, 0.12)"

/** 最低实体高度（小时）：单条提交（open==close）时外扩到该厚度保证实体可见 */
const MIN_BODY_HOURS = 0.3

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 dailyStats） */
  report: CodeReportData
}>()

/** 每日提交统计（按日期升序，来自报告聚合） */
const stats = computed(() => props.report.dailyStats)

/** 当日相对前一活跃日的提交量涨跌（首日视为持平） */
function trendOf(list: DailyCommitStat[], i: number): "up" | "down" | "flat" {
  if (i === 0) return "flat"
  const prev = list[i - 1].count
  const cur = list[i].count
  if (cur > prev) return "up"
  if (cur < prev) return "down"
  return "flat"
}

/** 实体/影线颜色（按涨跌语义） */
function colorOf(list: DailyCommitStat[], i: number): string {
  const t = trendOf(list, i)
  if (t === "up") return UP_COLOR
  if (t === "down") return DOWN_COLOR
  return FLAT_COLOR
}

/** 实体柱范围 [下沿, 上沿]：正常取 [min(open,close), max(open,close)]，跨度过小时外扩保证可见 */
function bodyRange(s: DailyCommitStat): [number, number] {
  const lo = Math.min(s.open, s.close)
  const hi = Math.max(s.open, s.close)
  if (hi - lo >= MIN_BODY_HOURS) return [lo, hi]
  return [Math.max(0, lo - MIN_BODY_HOURS), Math.min(24, hi + MIN_BODY_HOURS)]
}

/** 小时小数 → "HH:mm"（分钟四舍五入，如 9.25 → 09:15） */
function formatHour(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

/** chart.js 数据集（floating bar 实体 + 自定义字段 candlestick 供影线插件读取） */
const barData = computed<ChartData<"bar">>(() => {
  const list = stats.value
  const dataset = {
    data: list.map((s) => bodyRange(s)),
    backgroundColor: list.map((_, i) => colorOf(list, i)),
    borderColor: list.map((_, i) => colorOf(list, i)),
    borderWidth: 1,
    maxBarThickness: 16,
    // 自定义字段：影线插件从数据集读取原始统计（避免闭包快照）
    candlestick: list,
  } as ChartData<"bar">["datasets"][number] & { candlestick: DailyCommitStat[] }
  return {
    labels: list.map((s) => s.date),
    datasets: [dataset],
  }
})

/** chart.js 配置：y 轴 0~24 小时，x 轴日期自动抽样，tooltip 展示提交数/首末时刻 */
const chartOptions = computed<ChartOptions<"bar">>(() => {
  const list = stats.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1f2937",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
        padding: 8,
        callbacks: {
          title: (items) => {
            const s = list[items[0].dataIndex]
            return s ? s.date : ""
          },
          label: (item) => {
            const s = list[item.dataIndex]
            if (!s) return ""
            return [
              `${props.i18n.reportCandlestickCount}: ${s.count}`,
              `${props.i18n.reportCandlestickOpen}: ${formatHour(s.open)}`,
              `${props.i18n.reportCandlestickClose}: ${formatHour(s.close)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 0,
          autoSkip: true,
          color: AXIS_COLOR,
          // 紧凑日期标签（去掉年份前缀，完整日期在 tooltip 中展示）
          callback: (value) => String(value).slice(5),
        },
        grid: { display: false },
      },
      y: {
        min: 0,
        max: 24,
        ticks: {
          stepSize: 6,
          color: AXIS_COLOR,
          callback: (value) => `${value}:00`,
        },
        grid: { color: GRID_COLOR },
      },
    },
  }
})

/** 影线插件：在浮动条实体之上叠加从 low 到 high 的细竖线（含端点横线），形成标准 K 线影线视觉 */
const chartPlugins = computed<Plugin[]>(() => [
  {
    id: "gpcWick",
    afterDatasetsDraw(chart) {
      const dataset = chart.data.datasets[0] as { candlestick?: DailyCommitStat[] } | undefined
      const list = dataset?.candlestick
      if (!list || list.length === 0) return
      const meta = chart.getDatasetMeta(0)
      if (!meta.data || meta.data.length === 0) return
      const yScale = chart.scales.y
      const ctx = chart.ctx
      ctx.save()
      ctx.lineWidth = 1
      list.forEach((s, i) => {
        const bar = meta.data[i]
        if (!bar) return
        const x = bar.x
        const yHigh = yScale.getPixelForValue(s.high)
        const yLow = yScale.getPixelForValue(s.low)
        const color = colorOf(list, i)
        ctx.strokeStyle = color
        // 影线竖线（low → high）
        ctx.beginPath()
        ctx.moveTo(x, yHigh)
        ctx.lineTo(x, yLow)
        ctx.stroke()
        // 影线端点横线（K 线细节，上下各 2px）
        ctx.beginPath()
        ctx.moveTo(x - 2, yHigh)
        ctx.lineTo(x + 2, yHigh)
        ctx.moveTo(x - 2, yLow)
        ctx.lineTo(x + 2, yLow)
        ctx.stroke()
      })
      ctx.restore()
    },
  },
])

/** 摘要卡片：提交天数/总提交/日均提交/最高单日（最高单日值悬浮显示日期） */
const summaryCards = computed(() => {
  const list = stats.value
  const total = list.reduce((sum, s) => sum + s.count, 0)
  const avg = list.length > 0 ? (total / list.length).toFixed(1) : "0"
  let peak: DailyCommitStat | undefined
  for (const s of list) {
    if (!peak || s.count > peak.count) peak = s
  }
  return [
    { value: list.length, label: props.i18n.reportCandlestickTotalDays, tip: "" },
    { value: total, label: props.i18n.reportCandlestickTotalCommits, tip: "" },
    { value: avg, label: props.i18n.reportCandlestickAvgDaily, tip: "" },
    { value: peak ? peak.count : 0, label: props.i18n.reportCandlestickMaxDaily, tip: peak ? peak.date : "" },
  ]
})
</script>

<style lang="scss">
@use "../../styles/CandlestickSection.scss";
@use "../../styles/index.scss";
</style>
