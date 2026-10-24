/**
 * gitPush 代码统计报告 — 单文件 HTML 导出渲染层（纯函数，无 Vue / 无外部依赖）
 *
 * 与 reportMetrics（数据怎么算）/ reportChart（页面 chart.js 配置）分层：
 * 本模块只负责「怎么把已聚合的 CodeReportData 渲染成自包含 HTML」，
 * 图表以**内联 SVG** 重绘而非引入 CDN，保证导出文件断网可打开、可长期存档。
 *
 * 安全约定：所有来自 git 的字符串（作者名/文件路径）必须经 escapeHtml 才能进入 HTML，
 * 否则仓库中的恶意路径（如 `<img onerror=...>`）会在浏览器打开报告时执行。
 *
 * 域划分：format 转义与格式化 / style 自带样式 / svgCharts 内联 SVG 图表 / sections 分区渲染。
 * 导出面契约（消费方 useReportExport / htmlReport.spec）：buildHtmlReport / reportFileName /
 * escapeHtml / HtmlReportContext。子模块间 import 直连不走本 barrel 防环。
 */
// 直连 types/report（纯类型与常量）而非 "../types" 桶：桶含 GitPushManager 等运行时模块，
// 会把运行时 siyuan 依赖拉进模块图，使本纯函数模块无法在 Node 单测环境加载
// （htmlReport.spec.ts 曾因此整体失败）。types/index.ts 仍是唯一的公共导出面。
import type { CodeReportData } from "../types/report"
import { escapeHtml, fmt, t } from "./format"
import { REPORT_STYLE } from "./style"
import {
  renderAuthors,
  renderDebt,
  renderHeader,
  renderHotspot,
  renderTeamOverview,
  renderTrend,
  type HtmlReportContext,
} from "./sections"

export type { HtmlReportContext } from "./sections"
export { escapeHtml } from "./format"

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
