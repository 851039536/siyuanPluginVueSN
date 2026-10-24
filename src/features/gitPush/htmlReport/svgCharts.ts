// gitPush 单文件 HTML 导出 — 内联 SVG 图表（K 线 / 柱状 / 排行条 / 甜甜圈，无 JS 依赖）
import type { DailyCommitStat } from "../types/report"
import { calcMovingAverage7, collapseDailyStats } from "../reportMetrics"
import { REPORT_CHART_COLORS } from "../types/report"
import { isDayKeyInBucket, localDayKey } from "../utils/analysis"
import { escapeHtml, fmt, num, pct, t } from "./format"

/** 排行/分布图条目上限：SVG 条形超过此数量即不可读，故仅取前 N（表格仍输出全量） */
export const CHART_TOP_N = 20

/**
 * K 线图（提交趋势）。
 * 语义与页面 chart.js 插件一致：实体 = 当日首末提交时刻跨度，影线 = ±0.5h（由数据层给出 low/high），
 * 颜色 = 提交量较前一活跃日涨跌（绿涨/红跌/灰平），另叠加 7 日均线。
 */
export function svgCandlestick(list: DailyCommitStat[], i18n: Record<string, any>): string {
  const collapsed = collapseDailyStats(list)
  const rows = collapsed.list
  if (rows.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`

  const W = Math.max(560, Math.min(rows.length * 26, 2400))
  const H = 260
  const padL = 44
  const padR = 16
  const padT = 16
  const padB = 30
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const step = plotW / rows.length
  const bodyW = Math.max(3, Math.min(step * 0.6, 18))
  const ma = calcMovingAverage7(rows)

  // 时刻轴固定 0~24（数据层已把 open/close 归一到小时小数）
  const yOf = (hour: number): number => padT + (hour / 24) * plotH

  const parts: string[] = []
  // 坐标网格：每 6 小时一条
  for (let h = 0; h <= 24; h += 6) {
    const y = yOf(h)
    parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${REPORT_CHART_COLORS.grid}" />`)
    parts.push(`<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="${REPORT_CHART_COLORS.axis}">${String(h).padStart(2, "0")}:00</text>`)
  }
  // 工作时间区（08:00-18:00）底色
  parts.push(`<rect x="${padL}" y="${yOf(8).toFixed(1)}" width="${plotW}" height="${(yOf(18) - yOf(8)).toFixed(1)}" fill="${REPORT_CHART_COLORS.workBg}" />`)

  // 今日标记虚线（与页面 chart.js 插件语义一致：未聚合精确匹配；聚合时校验末桶日期跨度，防旧数据误标）
  const todayKey = localDayKey()
  let todayIdx = rows.findIndex((r) => r.date === todayKey)
  if (todayIdx < 0 && collapsed.bucketDays > 1
    && isDayKeyInBucket(todayKey, rows[rows.length - 1].date, collapsed.bucketDays)) {
    todayIdx = rows.length - 1
  }
  if (todayIdx >= 0) {
    const cx = padL + step * todayIdx + step / 2
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${padT}" x2="${cx.toFixed(1)}" y2="${H - padB}" stroke="${REPORT_CHART_COLORS.axis}" stroke-dasharray="3 3" />`)
    parts.push(`<text x="${cx.toFixed(1)}" y="${padT + 10}" font-size="9" text-anchor="middle" fill="${REPORT_CHART_COLORS.axis}">${escapeHtml(t(i18n, "reportTodayMarker"))}</text>`)
  }

  let prevCount: number | null = null
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const cx = padL + step * i + step / 2
    // 涨跌配色：与前一活跃日比较（首日为平）
    const color = prevCount === null
      ? REPORT_CHART_COLORS.flat
      : r.count > prevCount
        ? REPORT_CHART_COLORS.up
        : r.count < prevCount
          ? REPORT_CHART_COLORS.down
          : REPORT_CHART_COLORS.flat
    prevCount = r.count
    // 影线
    const top = yOf(Math.min(r.high, 24))
    const bot = yOf(Math.max(r.low, 0))
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${top.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${bot.toFixed(1)}" stroke="${color}" stroke-width="1" />`)
    // 实体（open~close）
    const y1 = yOf(Math.min(r.open, r.close))
    const y2 = yOf(Math.max(r.open, r.close))
    parts.push(`<rect x="${(cx - bodyW / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${Math.max(1.5, y2 - y1).toFixed(1)}" fill="${color}" />`)
    // 日均线点
    if (Number.isFinite(ma[i])) {
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${(padT + ((24 - Math.min(ma[i], 24)) / 24) * plotH).toFixed(1)}" r="1.8" fill="${REPORT_CHART_COLORS.ma}" />`)
    }
    // 日期刻度：过密时按步长抽稀，避免文字重叠
    const labelEvery = Math.ceil(rows.length / 14)
    if (i % labelEvery === 0) {
      parts.push(`<text x="${cx.toFixed(1)}" y="${H - 10}" font-size="9" text-anchor="middle" fill="${REPORT_CHART_COLORS.axis}">${escapeHtml(r.date.slice(5))}</text>`)
    }
  }

  const aggHint = collapsed.bucketDays > 1
    ? `<div class="rp-note">${escapeHtml(fmt(t(i18n, "reportChartAggregated"), String(collapsed.bucketDays)))}</div>`
    : ""
  return `<div class="rp-svg"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMin meet" role="img">${parts.join("")}</svg></div>${aggHint}`
}

/** 通用竖向柱状图（星期分布 / 时段分布） */
export function svgBarSeries(items: Array<{ label: string, value: number, peak?: boolean }>, i18n: Record<string, any>): string {
  if (items.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`
  const max = Math.max(...items.map((i) => i.value), 1)
  const W = Math.max(320, items.length * 44)
  const H = 150
  const padB = 26
  const padT = 12
  const plotH = H - padB - padT
  const step = W / items.length
  const barW = Math.min(step * 0.6, 28)

  const parts: string[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const cx = step * i + step / 2
    const h = (it.value / max) * plotH
    const color = it.peak ? REPORT_CHART_COLORS.up : "#8b949e"
    parts.push(`<rect x="${(cx - barW / 2).toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${color}" rx="2" />`)
    parts.push(`<text x="${cx.toFixed(1)}" y="${(padT + plotH - h - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="${REPORT_CHART_COLORS.axis}">${num(it.value)}</text>`)
    parts.push(`<text x="${cx.toFixed(1)}" y="${H - 9}" font-size="9" text-anchor="middle" fill="${REPORT_CHART_COLORS.axis}">${escapeHtml(it.label)}</text>`)
  }
  return `<div class="rp-svg"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMin meet" role="img">${parts.join("")}</svg></div>`
}

/** 横向排行条（作者 / 文件占比） */
export function svgRankBars(rows: Array<{ label: string, value: number, color?: string }>, i18n: Record<string, any>): string {
  const list = rows.slice(0, CHART_TOP_N)
  if (list.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`
  const max = Math.max(...list.map((r) => r.value), 1)
  const rowH = 22
  const labelW = 200
  const W = 720
  const valueW = 64
  const barMax = W - labelW - valueW
  const H = list.length * rowH + 8

  const parts: string[] = []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    const y = i * rowH + 4
    const w = Math.max(1, (r.value / max) * barMax)
    parts.push(`<text x="${labelW - 8}" y="${y + 12}" font-size="11" text-anchor="end" fill="currentColor">${escapeHtml(r.label)}</text>`)
    parts.push(`<rect x="${labelW}" y="${y + 3}" width="${barMax}" height="12" fill="rgba(128,128,128,0.12)" rx="2" />`)
    parts.push(`<rect x="${labelW}" y="${y + 3}" width="${w.toFixed(1)}" height="12" fill="${r.color ?? "#3b82f6"}" rx="2" />`)
    parts.push(`<text x="${W - 4}" y="${y + 12}" font-size="11" text-anchor="end" fill="currentColor">${num(r.value)}</text>`)
  }
  return `<div class="rp-svg"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMinYMin meet" role="img">${parts.join("")}</svg></div>`
}

/** 甜甜圈图（债务严重度 / 热点等级分布） */
export function svgDonut(items: Array<{ label: string, value: number, color: string }>, i18n: Record<string, any>): string {
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total <= 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`

  const size = 180
  const r = 66
  const inner = 42
  const cx = size / 2
  const cy = size / 2
  let angle = -Math.PI / 2
  const parts: string[] = []
  for (const it of items) {
    if (it.value <= 0) continue
    const sweep = (it.value / total) * Math.PI * 2
    const a0 = angle
    const a1 = angle + sweep
    angle = a1
    // 整圆（单一类别 100%）用两段半圆近似，避免起终点重合导致 arc 不渲染
    const large = sweep > Math.PI ? 1 : 0
    const x0 = cx + r * Math.cos(a0)
    const y0 = cy + r * Math.sin(a0)
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const xi1 = cx + inner * Math.cos(a1)
    const yi1 = cy + inner * Math.sin(a1)
    const xi0 = cx + inner * Math.cos(a0)
    const yi0 = cy + inner * Math.sin(a0)
    parts.push(`<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${xi1.toFixed(2)} ${yi1.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${xi0.toFixed(2)} ${yi0.toFixed(2)} Z" fill="${it.color}" />`)
  }
  parts.push(`<text x="${cx}" y="${cy + 5}" font-size="18" font-weight="600" text-anchor="middle" fill="currentColor">${num(total)}</text>`)

  const legend = items.map((it) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:11px;"><i style="width:9px;height:9px;border-radius:2px;background:${it.color};display:inline-block;"></i>${escapeHtml(it.label)} ${num(it.value)}（${pct(it.value, total)}）</span>`).join("")
  return `<div class="rp-svg" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">${parts.join("")}</svg><div>${legend}</div></div>`
}
