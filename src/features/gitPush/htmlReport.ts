/**
 * gitPush 代码统计报告 — 单文件 HTML 导出渲染层（纯函数，无 Vue / 无外部依赖）
 *
 * 与 reportMetrics（数据怎么算）/ reportChart（页面 chart.js 配置）分层：
 * 本模块只负责「怎么把已聚合的 CodeReportData 渲染成自包含 HTML」，
 * 图表以**内联 SVG** 重绘而非引入 CDN，保证导出文件断网可打开、可长期存档。
 *
 * 安全约定：所有来自 git 的字符串（作者名/文件路径）必须经 escapeHtml 才能进入 HTML，
 * 否则仓库中的恶意路径（如 `<img onerror=...>`）会在浏览器打开报告时执行。
 */
import type {
  CodeReportData,
  DailyCommitStat,
  DebtSeverity,
  HotspotLevel,
} from "./types"
import {
  calcMovingAverage7,
  collapseDailyStats,
} from "./reportMetrics"
import {
  DEBT_SEVERITY_META,
  DEBT_SEVERITY_ORDER,
  HOTSPOT_LEVEL_META,
  HOTSPOT_LEVEL_ORDER,
  REPORT_CHART_COLORS,
  WEEKDAY_LABEL_KEYS,
} from "./types"

/** 报告渲染上下文（页头信息；不属于 CodeReportData 的聚合字段） */
export interface HtmlReportContext {
  /** 项目名 */
  projectName: string
  /** 项目本地路径 */
  projectPath: string
  /** 时间范围标签（直接复用 report.rangeLabel） */
  rangeLabel: string
  /** 生成时间（ISO） */
  generatedAt: string
}

/** 排行/分布图条目上限：SVG 条形超过此数量即不可读，故仅取前 N（表格仍输出全量） */
const CHART_TOP_N = 20

// ========== 转义 ==========

/** HTML 文本转义（& < > " ' 五字符全覆盖，同时适用于属性值） */
export function escapeHtml(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** i18n 取值（缺失键回退为空串，避免 undefined 泄漏进 HTML） */
function t(i18n: Record<string, any>, key: string): string {
  const v = i18n?.[key]
  return typeof v === "string" ? v : ""
}

/** 格式化模板占位（报告内多处用 {0} 占位） */
function fmt(template: string, value: string): string {
  return template.replace("\{0\}", value)
}

/** 数值千分位（与面板观感一致） */
function num(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0"
}

/** 百分比（0~100 整数） */
function pct(part: number, total: number): string {
  if (!total) return "0%"
  return `${Math.round((part / total) * 100)}%`
}

// ========== 样式（自带配色，不依赖思源 --b3-* 变量） ==========

const REPORT_STYLE = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 32px 24px 64px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px; line-height: 1.6;
  color: #1f2328; background: #ffffff;
}
.rp-wrap { max-width: 1180px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #d8dee4; }
h3 { font-size: 13px; margin: 20px 0 8px; color: #57606a; font-weight: 600; }
.rp-sub { color: #57606a; font-size: 12px; }
.rp-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 12px 0 0; font-size: 12px; color: #57606a; }
.rp-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 12px; }
.rp-kpi { border: 1px solid #d8dee4; border-radius: 6px; padding: 12px 14px; }
.rp-kpi-v { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; }
.rp-kpi-l { font-size: 11px; color: #57606a; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eaeef2; }
th { background: #f6f8fa; font-weight: 600; color: #57606a; white-space: nowrap; }
tbody tr:nth-child(even) { background: #fafbfc; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
.rp-empty { color: #8b949e; font-size: 12px; padding: 8px 0; }
.rp-toc { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.rp-toc a { color: #0969da; text-decoration: none; border: 1px solid #d8dee4; border-radius: 999px; padding: 2px 12px; font-size: 12px; }
.rp-chip { display: inline-block; padding: 0 7px; border-radius: 999px; font-size: 11px; color: #fff; line-height: 18px; }
.rp-sug { margin-top: 10px; padding: 8px 12px; border-left: 3px solid #0969da; background: #f6f8fa; font-size: 12px; }
.rp-svg { margin-top: 10px; overflow-x: auto; }
.rp-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
.rp-sub-list { margin: 2px 0 0; padding-left: 16px; color: #57606a; font-size: 11px; }
.rp-note { color: #8b949e; font-size: 11px; margin-top: 6px; }
@media (prefers-color-scheme: dark) {
  body { color: #e6edf3; background: #0d1117; }
  h2 { border-bottom-color: #30363d; }
  h3, .rp-sub, .rp-meta, .rp-kpi-l, .rp-note { color: #8b949e; }
  .rp-kpi { border-color: #30363d; }
  table th { background: #161b22; color: #8b949e; }
  table th, table td { border-bottom-color: #21262d; }
  tbody tr:nth-child(even) { background: #161b22; }
  .rp-toc a { color: #58a6ff; border-color: #30363d; }
  .rp-sug { background: #161b22; border-left-color: #58a6ff; }
  .rp-empty, .rp-note { color: #6e7681; }
}
@media print {
  body { padding: 0; font-size: 11px; }
  h2 { page-break-after: avoid; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  .rp-toc { display: none; }
}
`

// ========== SVG 图表（内联，无 JS 依赖） ==========

/**
 * K 线图（提交趋势）。
 * 语义与页面 chart.js 插件一致：实体 = 当日首末提交时刻跨度，影线 = ±0.5h（由数据层给出 low/high），
 * 颜色 = 提交量较前一活跃日涨跌（绿涨/红跌/灰平），另叠加 7 日均线。
 */
function svgCandlestick(list: DailyCommitStat[], i18n: Record<string, any>): string {
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
function svgBarSeries(items: Array<{ label: string, value: number, peak?: boolean }>, i18n: Record<string, any>): string {
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
function svgRankBars(rows: Array<{ label: string, value: number, color?: string }>, i18n: Record<string, any>): string {
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
function svgDonut(items: Array<{ label: string, value: number, color: string }>, i18n: Record<string, any>): string {
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

// ========== 分区渲染 ==========

/** 表格单元格：数值列右对齐 + 等宽 */
function td(value: string, cls = ""): string {
  return `<td${cls ? ` class="${cls}"` : ""}>${escapeHtml(value)}</td>`
}
function tdNum(value: string): string {
  return `<td class="num">${escapeHtml(value)}</td>`
}

/** 页头：标题 + 元信息 + 目录 */
function renderHeader(report: CodeReportData, ctx: HtmlReportContext, i18n: Record<string, any>): string {
  const title = fmt(t(i18n, "reportHtmlTitle"), ctx.projectName)
  const meta = [
    `${escapeHtml(t(i18n, "reportFileDetailPath"))}: ${escapeHtml(ctx.projectPath)}`,
    fmt(t(i18n, "reportRangeLabel"), escapeHtml(ctx.rangeLabel || report.rangeLabel)),
    fmt(t(i18n, "reportGenerated"), escapeHtml(ctx.generatedAt)),
    fmt(t(i18n, "reportFilesAnalyzed"), num(report.analyzedFiles)),
  ].map((m) => `<span>${m}</span>`).join("")

  const toc = [
    ["#sec-overview", "reportTabOverview"],
    ["#sec-authors", "reportAuthorsTitle"],
    ["#sec-debt", "reportTabDebt"],
    ["#sec-hotspot", "reportTabHotspot"],
    ["#sec-trend", "reportTabCandlestick"],
  ].map(([href, key]) => `<a href="${href}">${escapeHtml(t(i18n, key))}</a>`).join("")

  return `<h1>${escapeHtml(title)}</h1>
<div class="rp-sub">${escapeHtml(ctx.projectName)}</div>
<div class="rp-meta">${meta}</div>
<div class="rp-toc">${toc}</div>`
}

/** 团队总览：KPI 卡片 */
function renderTeamOverview(report: CodeReportData, i18n: Record<string, any>): string {
  const o = report.teamOverview
  const kpis = [
    [num(o.memberCount), "reportMemberCount"],
    [num(o.totalCommits), "reportTotalCommits"],
    [num(o.totalLines), "reportTotalLines"],
    [o.topAuthor || "—", "reportTopAuthor"],
  ].map(([v, k]) => `<div class="rp-kpi"><div class="rp-kpi-v">${escapeHtml(String(v))}</div><div class="rp-kpi-l">${escapeHtml(t(i18n, k))}</div></div>`).join("")
  return `<div class="rp-kpis">${kpis}</div>`
}

/** 代码贡献度：排行表 + 变更规模条形 + 每人主要修改文件 */
function renderAuthors(report: CodeReportData, i18n: Record<string, any>): string {
  const rows = report.authors
  if (rows.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`

  const head = `<tr>
<th class="num">${escapeHtml(t(i18n, "reportRankCol"))}</th>
<th>${escapeHtml(t(i18n, "reportTopAuthor"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportCommitsCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportLinesCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportDeletedLinesCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportNetCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportAvgSizeCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportFrequencyCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportFilesCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportActiveDaysCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportChurnRate"))}</th>
</tr>`

  const body = rows.map((a, i) => {
    const topFiles = a.topFiles.length > 0
      ? `<ul class="rp-sub-list">${a.topFiles.map((f) => `<li>${escapeHtml(f.path)} · ${num(f.count)}</li>`).join("")}</ul>`
      : ""
    return `<tr>
${tdNum(String(i + 1))}
<td class="mono">${escapeHtml(a.author)}${topFiles}</td>
${tdNum(num(a.commits))}
${tdNum(num(a.linesAdded))}
${tdNum(num(a.linesDeleted))}
${tdNum(num(a.netLines))}
${tdNum(num(a.avgCommitSize))}
${tdNum(a.frequency.toFixed(2))}
${tdNum(num(a.filesTouched))}
${tdNum(num(a.activeDays))}
${tdNum(`${Math.round(a.churnRate * 100)}%`)}
</tr>`
  }).join("")

  const bars = svgRankBars(rows.map((a) => ({
    label: a.author,
    value: a.linesAdded,
  })), i18n)
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>
<h3>${escapeHtml(t(i18n, "reportLinesCol"))}</h3>${bars}`
}

/** 技术债务：严重度分布甜甜圈 + 分组明细表 */
function renderDebt(report: CodeReportData, i18n: Record<string, any>): string {
  const files = report.debtFiles
  if (files.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoDebt"))}</div>`

  const donut = svgDonut(
    DEBT_SEVERITY_ORDER.map((sev: DebtSeverity) => ({
      label: t(i18n, DEBT_SEVERITY_META[sev].labelKey),
      value: report.debtSummary[sev] ?? 0,
      color: DEBT_SEVERITY_META[sev].color,
    })),
    i18n,
  )

  const head = `<tr>
<th>${escapeHtml(t(i18n, "reportFileCol"))}</th>
<th>${escapeHtml(t(i18n, "reportLevelCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportScoreCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportModsCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportAuthorsCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportLinesCol"))}</th>
<th>${escapeHtml(t(i18n, "reportLastModifiedCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportNetCol"))}</th>
</tr>`

  // 按严重度分组（DEBT_SEVERITY_ORDER 为唯一顺序源），组内保持数据层已排好的风险分序
  const body = DEBT_SEVERITY_ORDER.map((sev: DebtSeverity) => {
    const group = files.filter((f) => f.severity === sev)
    if (group.length === 0) return ""
    const meta = DEBT_SEVERITY_META[sev]
    const groupRows = group.map((f) => `<tr>
<td class="mono">${escapeHtml(f.path)}</td>
<td><span class="rp-chip" style="background:${meta.color}">${escapeHtml(t(i18n, meta.labelKey))}</span></td>
${tdNum(num(f.riskScore))}
${tdNum(num(f.modCount))}
${tdNum(num(f.authorCount))}
${tdNum(f.loc === null ? "—" : num(f.loc))}
${td(f.lastModified || "—")}
${tdNum(num(f.added - f.deleted))}
</tr>`).join("")
    return `<h3>${escapeHtml(t(i18n, meta.labelKey))}（${num(group.length)}）</h3><table><thead>${head}</thead><tbody>${groupRows}</tbody></table>`
  }).join("")

  return `<h3>${escapeHtml(t(i18n, "reportDebtDistTitle"))}</h3>${donut}${body}`
}

/** 代码热点：等级分布甜甜圈 + 热点表 + 优化建议 */
function renderHotspot(report: CodeReportData, i18n: Record<string, any>): string {
  const rows = report.hotspots
  if (rows.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`

  const donut = svgDonut(
    HOTSPOT_LEVEL_ORDER.map((lv: HotspotLevel) => ({
      label: t(i18n, HOTSPOT_LEVEL_META[lv].labelKey),
      value: report.hotspotSummary.find((s) => s.level === lv)?.count ?? 0,
      color: HOTSPOT_LEVEL_META[lv].color,
    })),
    i18n,
  )

  const head = `<tr>
<th class="num">${escapeHtml(t(i18n, "reportRankCol"))}</th>
<th>${escapeHtml(t(i18n, "reportFilePathCol"))}</th>
<th>${escapeHtml(t(i18n, "reportLevelCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportModsCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportAuthorsCol"))}</th>
<th class="num">${escapeHtml(t(i18n, "reportLinesCol"))}</th>
<th>${escapeHtml(t(i18n, "reportLastModifiedCol"))}</th>
</tr>`

  const body = rows.map((h, i) => {
    const meta = HOTSPOT_LEVEL_META[h.level]
    return `<tr>
${tdNum(String(i + 1))}
<td class="mono">${escapeHtml(h.path)}</td>
<td><span class="rp-chip" style="background:${meta.color}">${escapeHtml(t(i18n, meta.labelKey))} ${escapeHtml(String(h.heat))}</span></td>
${tdNum(num(h.modCount))}
${tdNum(num(h.authorCount))}
${tdNum(num(h.added))}
${td(h.lastModified || "—")}
</tr>`
  }).join("")

  const truncated = report.analyzedFiles > rows.length
    ? `<div class="rp-note">${escapeHtml(fmt(fmt(t(i18n, "reportHotspotTruncated"), String(rows.length)), String(report.analyzedFiles)))}</div>`
    : ""
  const sug = report.suggestionKey
    ? `<div class="rp-sug">${escapeHtml(t(i18n, report.suggestionKey))}</div>`
    : ""

  const bars = svgRankBars(
    rows.slice(0, CHART_TOP_N).map((h) => ({
      label: h.path,
      value: h.heat,
      color: HOTSPOT_LEVEL_META[h.level].color,
    })),
    i18n,
  )

  return `<h3>${escapeHtml(t(i18n, "reportHeatSummaryTitle"))}</h3>${donut}
<h3>${escapeHtml(t(i18n, "reportHeatTitle"))}</h3>${bars}${sug}${truncated}
<h3>${escapeHtml(t(i18n, "reportFilePathCol"))}</h3>
<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

/** 提交趋势：K 线 + 摘要 + 星期/时段分布 */
function renderTrend(report: CodeReportData, i18n: Record<string, any>): string {
  const daily = report.dailyStats
  if (daily.length === 0) return `<div class="rp-empty">${escapeHtml(t(i18n, "reportNoData"))}</div>`

  const rhythm = report.rhythm
  const totalCommits = daily.reduce((s, d) => s + d.count, 0)
  const maxDaily = Math.max(...daily.map((d) => d.count), 0)
  const kpis = [
    [num(daily.length), "reportCandlestickTotalDays"],
    [num(totalCommits), "reportCandlestickTotalCommits"],
    [(totalCommits / Math.max(daily.length, 1)).toFixed(1), "reportCandlestickAvgDaily"],
    [num(maxDaily), "reportCandlestickMaxDaily"],
  ].map(([v, k]) => `<div class="rp-kpi"><div class="rp-kpi-v">${escapeHtml(String(v))}</div><div class="rp-kpi-l">${escapeHtml(t(i18n, k))}</div></div>`).join("")

  const summary = [
    [t(i18n, WEEKDAY_LABEL_KEYS[rhythm.topWeekday.dow]) || "—", "reportTopWeekday"],
    [`${String(rhythm.peakHours.start).padStart(2, "0")}:00-${String(rhythm.peakHours.end).padStart(2, "0")}:00`, "reportPeakHours"],
    [num(rhythm.maxStreak), "reportStreak"],
  ].map(([v, k]) => `<div class="rp-kpi"><div class="rp-kpi-v">${escapeHtml(String(v))}</div><div class="rp-kpi-l">${escapeHtml(t(i18n, k))}</div></div>`).join("")

  const weekdayBars = svgBarSeries(
    rhythm.weekday.map((w) => ({
      label: t(i18n, WEEKDAY_LABEL_KEYS[w.dow]),
      value: w.count,
      peak: w.dow === rhythm.topWeekday.dow && rhythm.topWeekday.count > 0,
    })),
    i18n,
  )
  const hourlyBars = svgBarSeries(
    rhythm.hourly.map((h) => ({
      label: `${String(h.start).padStart(2, "0")}`,
      value: h.count,
      peak: h.start === rhythm.peakHours.start && rhythm.peakHours.count > 0,
    })),
    i18n,
  )

  return `<div class="rp-kpis">${kpis}</div>
<h3>${escapeHtml(t(i18n, "reportCandlestickTitle"))}</h3>
${svgCandlestick(daily, i18n)}
<div class="rp-note">${escapeHtml(t(i18n, "reportCandlestickHint"))}</div>
<h3>${escapeHtml(t(i18n, "reportStreak"))} / ${escapeHtml(t(i18n, "reportPeakHours"))}</h3>
<div class="rp-kpis">${summary}</div>
<div class="rp-cols">
<div><h3>${escapeHtml(t(i18n, "reportWeekdayTitle"))}</h3>${weekdayBars}</div>
<div><h3>${escapeHtml(t(i18n, "reportHourlyTitle"))}</h3>${hourlyBars}</div>
</div>`
}

// ========== 入口 ==========

/**
 * 把已聚合的报告渲染为完整自包含 HTML 文档。
 * 纯函数：不做 IO、不读 DOM、不依赖响应式，便于单测与在任意环境复用。
 */
export function buildHtmlReport(
  report: CodeReportData,
  ctx: HtmlReportContext,
  i18n: Record<string, any>,
): string {
  const title = fmt(t(i18n, "reportHtmlTitle"), ctx.projectName)
  const sections: Array<[string, string]> = [
    ["sec-overview", renderTeamOverview(report, i18n)],
    ["sec-authors", renderAuthors(report, i18n)],
    ["sec-debt", renderDebt(report, i18n)],
    ["sec-hotspot", renderHotspot(report, i18n)],
    ["sec-trend", renderTrend(report, i18n)],
  ]
  const headingKeys: Record<string, string> = {
    "sec-overview": "reportTabOverview",
    "sec-authors": "reportAuthorsTitle",
    "sec-debt": "reportTabDebt",
    "sec-hotspot": "reportTabHotspot",
    "sec-trend": "reportTabCandlestick",
  }
  const body = sections.map(([id, html]) =>
    `<h2 id="${id}">${escapeHtml(t(i18n, headingKeys[id]))}</h2>\n${html}`,
  ).join("\n")

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${REPORT_STYLE}</style>
</head>
<body>
<div class="rp-wrap">
${renderHeader(report, ctx, i18n)}
${body}
</div>
</body>
</html>
`
}

/**
 * 报告文件默认名（净化文件系统非法字符，保证跨平台可写）。
 * 生成时间取到分钟，避免同项目多次导出互相覆盖。
 */
export function reportFileName(projectName: string, generatedAt: string): string {
  const safeName = String(projectName || "report")
    // 跨平台非法字符 + 控制字符 + 首尾点空格（Windows 不允许尾随）
    .replace(/[\\/:*?"<>|]/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80) || "report"
  const stamp = String(generatedAt || "").slice(0, 16).replace(/[:T]/g, "-")
  return `${safeName}-${stamp || "report"}.html`
}
