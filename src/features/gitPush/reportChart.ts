// gitPush 提交 K 线图的绘制配置模块：数据集/坐标轴/影线插件（纯函数，无 Vue 响应式）
//
// 与 reportMetrics 的分工：reportMetrics 负责「数据怎么算」（聚合/评分/压缩），
// 本模块负责「数据怎么画」（chart.js 数据集、刻度、canvas 绘制插件）。
// 抽离原因：这些绘制细节与 CandlestickSection.vue 的视图状态无关，
// 留在组件内会把它推过 500 行硬阈值。
import type { Chart, ChartData, ChartOptions, Plugin } from "chart.js"
import type { DailyCommitStat } from "./types/report"
import { REPORT_CHART_COLORS } from "./types/report"
import { MAX_CANDLES, calcMovingAverage7 } from "./reportMetrics"

// K 线配色（canvas 上下文无法解析 CSS 自定义属性，只能在此集中定义；
// styles/CandlestickSection.scss 中的图例同色字面量须与 REPORT_CHART_COLORS 保持一致）
const UP_COLOR = REPORT_CHART_COLORS.up
const DOWN_COLOR = REPORT_CHART_COLORS.down
const FLAT_COLOR = REPORT_CHART_COLORS.flat
const MA_COLOR = REPORT_CHART_COLORS.ma
const GRID_COLOR = REPORT_CHART_COLORS.grid
const AXIS_COLOR = REPORT_CHART_COLORS.axis
const WORK_BG_COLOR = REPORT_CHART_COLORS.workBg

/** 工作时间区（08:00-18:00）底色区间 */
const WORK_START_HOUR = 8
const WORK_END_HOUR = 18

/** 最低实体高度（小时）：单条提交（open==close）时外扩到该厚度保证实体可见 */
const MIN_BODY_HOURS = 0.3

/** 每根蜡烛最小占地宽度（px）：实体 16px + 左右间距，保证多日期时不被挤压 */
export const MIN_WIDTH_PER_DAY = 30

/**
 * 图表区最大宽度（px）硬上限。
 * 防御性兜底：即使分桶聚合失效，画布也不会被撑到浏览器 canvas 单维度上限
 * （Chrome 65535px）导致分配失败、图表白屏。
 */
export const MAX_CHART_WIDTH = MAX_CANDLES * MIN_WIDTH_PER_DAY

/** 日提交数标注字号（canvas 字体不受 CSS Token 约束，取与 10px 标签接近的小字号） */
const LABEL_FONT = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace"

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
export function formatHour(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

/**
 * 构建 chart.js 数据集：浮动条（实体）+ 7 日均线折线。
 * 均线量纲（提交数）挂到右侧独立 yCount 轴，避免与左轴的时刻刻度（0~24h）互相干扰。
 * 影线所需的原始统计经数据集的自定义 candlestick 字段透传给插件（避免插件闭包持有快照）。
 */
export function buildCandleChartData(list: DailyCommitStat[]): ChartData<"bar"> {
  const barDataset = {
    data: list.map((s) => bodyRange(s)),
    backgroundColor: list.map((_, i) => colorOf(list, i)),
    borderColor: list.map((_, i) => colorOf(list, i)),
    borderWidth: 1,
    maxBarThickness: 16,
    candlestick: list,
  } as ChartData<"bar">["datasets"][number] & { candlestick: DailyCommitStat[] }
  const maDataset = {
    type: "line" as const,
    data: calcMovingAverage7(list),
    yAxisID: "yCount",
    borderColor: MA_COLOR,
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.35,
    fill: false,
    spanGaps: true,
  } as unknown as ChartData<"bar">["datasets"][number]
  return {
    labels: list.map((s) => s.date),
    datasets: [barDataset, maDataset],
  }
}

/**
 * 构建 chart.js 配置：y 轴 0~24 小时 + 右侧 yCount 提交数量纲，x 轴日期自动抽样，
 * tooltip 展示提交数/开盘时刻/收盘时刻。
 */
export function buildCandleChartOptions(list: DailyCommitStat[], i18n: Record<string, any>, maxCount: number): ChartOptions<"bar"> {
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
              `${i18n.reportCandlestickCount}: ${s.count}`,
              `${i18n.reportCandlestickOpen}: ${formatHour(s.open)}`,
              `${i18n.reportCandlestickClose}: ${formatHour(s.close)}`,
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
      yCount: {
        position: "right",
        min: 0,
        max: maxCount,
        ticks: {
          maxTicksLimit: 4,
          color: AXIS_COLOR,
          callback: (value) => `${value}`,
        },
        grid: { display: false },
        border: { display: false },
      },
    },
  }
}

/**
 * K 线绘制插件：
 * ① beforeDatasetsDraw 画工作时间（08:00-18:00）底色带
 * ② afterDatasetsDraw 画影线（竖线 + 上下端点横线）与日提交数标注
 */
export function createCandlestickPlugin(): Plugin {
  return {
    id: "gpcWick",
    beforeDatasetsDraw(chart: Chart) {
      const yScale = chart.scales.y
      // chartArea 在首次布局完成前为 undefined（此处不能靠 !left 判断：left 为 0 是合法值）
      const area = chart.chartArea
      if (!yScale || !area) return
      const { left, right, top } = area
      const yTop = yScale.getPixelForValue(WORK_START_HOUR)
      const yBottom = yScale.getPixelForValue(WORK_END_HOUR)
      if (yTop < top) return
      const ctx = chart.ctx
      ctx.save()
      ctx.fillStyle = WORK_BG_COLOR
      ctx.fillRect(left, yTop, right - left, yBottom - yTop)
      ctx.restore()
    },
    afterDatasetsDraw(chart: Chart) {
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
        ctx.strokeStyle = colorOf(list, i)
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
      // 日提交数标注（仅 >1 条时显示，避免单日提交时画面过挤）
      ctx.textAlign = "center"
      ctx.textBaseline = "bottom"
      ctx.font = LABEL_FONT
      list.forEach((s, i) => {
        if (s.count <= 1) return
        const bar = meta.data[i]
        if (!bar) return
        const yBodyTop = yScale.getPixelForValue(Math.max(s.open, s.close))
        ctx.fillStyle = colorOf(list, i)
        ctx.fillText(String(s.count), bar.x, yBodyTop - 3)
      })
      ctx.restore()
    },
  }
}
