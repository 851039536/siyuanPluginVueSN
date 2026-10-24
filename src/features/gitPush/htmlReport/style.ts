// gitPush 单文件 HTML 导出 — 自带样式（不依赖思源 --b3-* 变量，断网可打开、可长期存档）

export const REPORT_STYLE = `
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
