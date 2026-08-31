// K 线图（蜡烛图）绘制配置：数据集/坐标轴/影线插件（纯函数，无 Vue 响应式）
// 实现参考 gitPush/reportChart.ts 的 chart.js 浮动条方案（跨功能禁止直接导入，此处独立实现）
import type { Chart, ChartData, ChartOptions, Plugin } from "chart.js"
import {
  type StatCandle,
  calcCloseMa7,
} from "../../../utils/candlestick"
import { formatNumber, formatShortNumber } from "../../../utils"

// K 线配色（canvas 上下文无法解析 CSS 自定义属性，只能在此集中定义；
// styles/KLineChart.scss 中的图例同色字面量须与以下常量保持一致）
// 涨跌方向采用 A 股惯例：红涨绿跌
const UP_COLOR = "#ef4444"
const DOWN_COLOR = "#10b981"
const FLAT_COLOR = "#64748b"
const MA_COLOR = "#f59e0b"
const GRID_COLOR = "rgba(128, 128, 128, 0.12)"
const AXIS_COLOR = "rgba(128, 128, 128, 0.8)"

/** 每根蜡烛最小占地宽度（px）：实体 16px + 左右间距，保证多日期时不被挤压 */
export const MIN_WIDTH_PER_CANDLE = 30

/** 实体最小可见跨度：开收相等（持平）时外扩到该厚度，保证实体可见 */
const MIN_BODY_SPAN = 1

/**
 * 实体/影线颜色（按涨跌语义：红涨绿跌平灰）
 */
function colorOf(c: StatCandle): string {
  if (c.direction === "up") return UP_COLOR
  if (c.direction === "down") return DOWN_COLOR
  return FLAT_COLOR
}

/** 实体柱范围 [下沿, 上沿]：正常取 [min(open,close), max(open,close)]，持平时外扩保证可见 */
function bodyRange(c: StatCandle): [number, number] {
  const lo = Math.min(c.open, c.close)
  const hi = Math.max(c.open, c.close)
  if (hi - lo > 0) return [lo, hi]
  return [lo, hi + MIN_BODY_SPAN]
}

/**
 * 构建 chart.js 数据集：浮动条（实体）+ 收盘 7 日均线折线（与蜡烛同轴）。
 * 入参为显示顺序（最新在左）；均线须按日历升序计算，算毕再翻转与显示序对齐。
 * 影线所需的原始蜡烛数据经数据集的自定义 candlestick 字段透传给插件（避免插件闭包持有快照）。
 */
export function buildStatCandleChartData(candles: StatCandle[]): ChartData<"bar"> {
  const ma7 = calcCloseMa7([...candles].reverse())
  ma7.reverse()
  const barDataset = {
    data: candles.map((c) => bodyRange(c)),
    backgroundColor: candles.map((c) => colorOf(c)),
    borderColor: candles.map((c) => colorOf(c)),
    borderWidth: 1,
    maxBarThickness: 16,
    candlestick: candles,
  } as ChartData<"bar">["datasets"][number] & { candlestick: StatCandle[] }
  const maDataset = {
    type: "line" as const,
    data: ma7,
    borderColor: MA_COLOR,
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.35,
    fill: false,
    spanGaps: true,
  } as unknown as ChartData<"bar">["datasets"][number]
  return {
    labels: candles.map((c) => c.dateLabel),
    datasets: [barDataset, maDataset],
  }
}

/**
 * 构建 chart.js 配置：单 y 轴（指标数值，上下各留 10% 边距避免贴边），
 * x 轴紧凑日期标签自动抽样，tooltip 展示开/高/低/收与净变化（近似日追加提示）。
 */
export function buildStatCandleChartOptions(candles: StatCandle[], i18n: Record<string, any>): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    // 整列触发：悬停在该日期列任意位置即显示 tooltip（蜡烛实体窄，精确命中困难）
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1f2937",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
        padding: 8,
        // 均线数据集不参与 tooltip，避免同一索引重复出框
        filter: (item) => item.datasetIndex === 0,
        callbacks: {
          title: (items) => {
            // 过滤后 items 可能为空（仅命中均线时），须防护避免读取 undefined
            const first = items[0]
            if (!first) return ""
            const c = candles[first.dataIndex]
            return c ? c.date : ""
          },
          label: (item) => {
            const c = candles[item.dataIndex]
            if (!c) return ""
            const delta = c.close - c.open
            const sign = delta > 0 ? "+" : ""
            const lines = [
              `${i18n.klineOpen}: ${formatNumber(c.open)}`,
              `${i18n.klineHigh}: ${formatNumber(c.high)}`,
              `${i18n.klineLow}: ${formatNumber(c.low)}`,
              `${i18n.klineClose}: ${formatNumber(c.close)}`,
              `${i18n.klineNetChange}: ${sign}${formatNumber(delta)}`,
            ]
            if (c.approx) lines.push(i18n.klineApproxHint)
            return lines
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
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: false,
        grace: "10%",
        ticks: {
          maxTicksLimit: 5,
          color: AXIS_COLOR,
          callback: (value) => formatShortNumber(Number(value)),
        },
        grid: { color: GRID_COLOR },
      },
    },
  }
}

/**
 * K 线影线绘制插件：afterDatasetsDraw 画影线竖线（low → high）与上下端点短横线，
 * 颜色随涨跌语义。与 gitPush 的 gpcWick 差异：无工作时间底色带/提交数标注。
 */
export function createStatWickPlugin(): Plugin {
  return {
    id: "statsWick",
    afterDatasetsDraw(chart: Chart) {
      const dataset = chart.data.datasets[0] as { candlestick?: StatCandle[] } | undefined
      const list = dataset?.candlestick
      if (!list || list.length === 0) return
      const meta = chart.getDatasetMeta(0)
      if (!meta.data || meta.data.length === 0) return
      const yScale = chart.scales.y
      if (!yScale) return
      const ctx = chart.ctx
      ctx.save()
      ctx.lineWidth = 1
      list.forEach((c, i) => {
        const bar = meta.data[i]
        if (!bar) return
        const x = bar.x
        const yHigh = yScale.getPixelForValue(c.high)
        const yLow = yScale.getPixelForValue(c.low)
        ctx.strokeStyle = colorOf(c)
        // 影线竖线（low → high）
        ctx.beginPath()
        ctx.moveTo(x, yHigh)
        ctx.lineTo(x, yLow)
        ctx.stroke()
        // 影线端点横线（上下各 2px）
        ctx.beginPath()
        ctx.moveTo(x - 2, yHigh)
        ctx.lineTo(x + 2, yHigh)
        ctx.moveTo(x - 2, yLow)
        ctx.lineTo(x + 2, yLow)
        ctx.stroke()
      })
      ctx.restore()
    },
  }
}
