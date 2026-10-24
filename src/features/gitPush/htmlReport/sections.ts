// gitPush 单文件 HTML 导出 — 分区渲染（页头 / 总览 / 贡献度 / 债务 / 热点 / 趋势）
//
// 安全约定：所有来自 git 的字符串（作者名/文件路径）必须经 escapeHtml 才能进入 HTML，
// 否则仓库中的恶意路径（如 `<img onerror=...>`）会在浏览器打开报告时执行。
import type { CodeReportData, DebtSeverity, HotspotLevel } from "../types/report"
import {
  DEBT_SEVERITY_META,
  DEBT_SEVERITY_ORDER,
  HOTSPOT_LEVEL_META,
  HOTSPOT_LEVEL_ORDER,
  WEEKDAY_LABEL_KEYS,
} from "../types/report"
import { escapeHtml, fmt, num, t } from "./format"
import { CHART_TOP_N, svgBarSeries, svgCandlestick, svgDonut, svgRankBars } from "./svgCharts"

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

/** 表格单元格：数值列右对齐 + 等宽 */
function td(value: string, cls = ""): string {
  return `<td${cls ? ` class="${cls}"` : ""}>${escapeHtml(value)}</td>`
}
function tdNum(value: string): string {
  return `<td class="num">${escapeHtml(value)}</td>`
}

/** 页头：标题 + 元信息 + 目录 */
export function renderHeader(report: CodeReportData, ctx: HtmlReportContext, i18n: Record<string, any>): string {
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
export function renderTeamOverview(report: CodeReportData, i18n: Record<string, any>): string {
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
export function renderAuthors(report: CodeReportData, i18n: Record<string, any>): string {
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
export function renderDebt(report: CodeReportData, i18n: Record<string, any>): string {
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
export function renderHotspot(report: CodeReportData, i18n: Record<string, any>): string {
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

  // 两个占位 {0}/{1} 一次传齐（历史嵌套 fmt(fmt(...)) 第二参无法命中 {0}，导出残留 {1}——已修复）
  const truncated = report.analyzedFiles > rows.length
    ? `<div class="rp-note">${escapeHtml(fmt(t(i18n, "reportHotspotTruncated"), String(rows.length), String(report.analyzedFiles)))}</div>`
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
export function renderTrend(report: CodeReportData, i18n: Record<string, any>): string {
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
