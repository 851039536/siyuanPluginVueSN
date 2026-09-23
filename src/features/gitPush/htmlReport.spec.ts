import type {
  AuthorReportRow,
  CodeReportData,
  DailyCommitStat,
  DebtFileRow,
  HotspotFileRow,
} from "./types"
// src/features/gitPush/htmlReport.spec.ts — 单文件 HTML 报告渲染层单元测试
//
// 覆盖重点：HTML 转义（防仓库内恶意路径/作者名在浏览器打开报告时执行）、
// 自包含性（无外部资源与 CDN，断网可打开）、文档结构完整、空数据不产半截文档、
// K 线分桶有界、导出文件名净化。
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  buildHtmlReport,
  escapeHtml,
  reportFileName,
} from "./htmlReport"
import {
  buildEmptyReport,
  MAX_CANDLES,
} from "./reportMetrics"

/** 最小 i18n 桩：报告层只做键查找，缺失键回退空串 */
const i18n = {
  reportHtmlTitle: "{0} 代码统计报告",
  reportFileDetailPath: "文件路径",
  reportRangeLabel: "统计范围：{0}",
  reportGenerated: "生成时间：{0}",
  reportFilesAnalyzed: "分析文件：{0}",
  reportTabOverview: "团队总览",
  reportAuthorsTitle: "代码贡献度",
  reportTabDebt: "技术债务",
  reportTabHotspot: "代码热点",
  reportTabCandlestick: "提交趋势",
  reportMemberCount: "团队成员",
  reportTotalCommits: "总提交数",
  reportTotalLines: "总代码量",
  reportTopAuthor: "最活跃贡献者",
  reportRankCol: "排名",
  reportCommitsCol: "提交次数",
  reportLinesCol: "代码行数",
  reportDeletedLinesCol: "删除行数",
  reportNetCol: "净增",
  reportAvgSizeCol: "平均提交大小",
  reportFrequencyCol: "提交频率",
  reportFilesCol: "影响文件数",
  reportActiveDaysCol: "活跃天数",
  reportChurnRate: "代码流失率",
  reportDebtDistTitle: "严重度分布",
  reportDebtSevere: "严重",
  reportDebtHigh: "高",
  reportDebtMedium: "中",
  reportDebtLow: "低",
  reportFileCol: "文件",
  reportLevelCol: "等级",
  reportScoreCol: "评分",
  reportModsCol: "修改次数",
  reportAuthorsCol: "参与人数",
  reportLastModifiedCol: "最后修改",
  reportHeatSummaryTitle: "统计摘要",
  reportHeatTitle: "代码热点图",
  reportHeatHot: "热点",
  reportHeatWarm: "温热",
  reportHeatCool: "冷却",
  reportHeatCold: "冷门",
  reportFilePathCol: "文件",
  reportHotspotTruncated: "仅展示热度前 {0} 个文件，共分析 {1} 个文件",
  reportSugWarning: "热点文件集中，建议优先重构高热度文件",
  reportNoData: "范围内没有数据",
  reportNoDebt: "范围内没有发现技术债务问题",
  reportCandlestickTitle: "提交趋势",
  reportCandlestickTotalDays: "提交天数",
  reportCandlestickTotalCommits: "总提交",
  reportCandlestickAvgDaily: "日均提交",
  reportCandlestickMaxDaily: "最高单日",
  reportCandlestickHint: "实体=当日首末提交时刻跨度",
  reportChartAggregated: "已按每 {0} 天聚合",
  reportWeekdayTitle: "星期分布",
  reportHourlyTitle: "时段分布",
  reportPeakHours: "高峰时段",
  reportStreak: "最长连续",
  reportTopWeekday: "最活跃星期",
  reportWeekSun: "周日",
  reportWeekMon: "周一",
  reportWeekTue: "周二",
  reportWeekWed: "周三",
  reportWeekThu: "周四",
  reportWeekFri: "周五",
  reportWeekSat: "周六",
}

const ctx = {
  projectName: "demo",
  projectPath: "/home/u/demo",
  rangeLabel: "近6月",
  generatedAt: "2025-01-02T03:04:00.000Z",
}

/** 造一行作者数据 */
function author(over: Partial<AuthorReportRow> = {}): AuthorReportRow {
  return {
    author: "alice",
    commits: 10,
    linesAdded: 500,
    linesDeleted: 100,
    netLines: 400,
    avgCommitSize: 50,
    frequency: 2.5,
    filesTouched: 8,
    activeDays: 5,
    firstCommitAt: "2024-01-01T00:00:00.000Z",
    lastCommitAt: "2024-06-01T00:00:00.000Z",
    churnRate: 0.2,
    topFiles: [{
      path: "src/a.ts",
      count: 3,
    }],
    ...over,
  }
}

function debtRow(path: string, severity: DebtFileRow["severity"] = "high"): DebtFileRow {
  return {
    path,
    modCount: 9,
    authorCount: 3,
    lastModified: "2024-06-01T00:00:00.000Z",
    loc: 120,
    added: 300,
    deleted: 80,
    severity,
    riskScore: 77,
  }
}

function hotspotRow(path: string, level: HotspotFileRow["level"] = "hot"): HotspotFileRow {
  return {
    path,
    modCount: 12,
    authorCount: 4,
    lastModified: "2024-06-02T00:00:00.000Z",
    loc: 200,
    added: 400,
    deleted: 90,
    level,
    heat: 88,
  }
}

/** 造 n 天连续提交数据（用于分桶测试） */
function dailySeries(n: number): DailyCommitStat[] {
  const out: DailyCommitStat[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i))
    const date = d.toISOString().slice(0, 10)
    const open = 9 + (i % 8)
    out.push({
      date,
      open,
      close: open + 1,
      high: open + 1.5,
      low: open - 0.5,
      count: (i % 5) + 1,
    })
  }
  return out
}

/** 以空报告为基底覆写字段，保证结构始终完整 */
function report(over: Partial<CodeReportData> = {}): CodeReportData {
  return {
    ...buildEmptyReport("近6月"),
    ok: true,
    totalCommits: 10,
    ...over,
  }
}

describe("escapeHtml", () => {
  it("转义全部 5 个 HTML 敏感字符", () => {
    expect(escapeHtml(`<script>&"'</script>`)).toBe("&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;")
  })

  it("非字符串输入不抛异常", () => {
    expect(escapeHtml(undefined as unknown as string)).toBe("")
    expect(escapeHtml(null as unknown as string)).toBe("")
  })
})

describe("buildHtmlReport 转义安全", () => {
  it("作者名与文件路径中的 HTML 被转义，不产生可执行标签", () => {
    const html = buildHtmlReport(
      report({
        authors: [author({
          author: `<img src=x onerror=alert(1)>`,
          topFiles: [{
            path: "<script>alert(2)</script>",
            count: 1,
          }],
        })],
        debtFiles: [debtRow("<iframe src=javascript:alert(3)>")],
        hotspots: [hotspotRow("<svg onload=alert(4)>")],
      }),
      ctx,
      i18n,
    )
    // 原始可执行标签不得出现
    expect(html).not.toContain("<img src=x onerror=")
    expect(html).not.toContain("<script>alert(2)")
    expect(html).not.toContain("<iframe src=")
    expect(html).not.toContain("<svg onload=")
    // 转义后的文本应存在
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;")
  })

  it("报告内不存在任何 <script> 标签", () => {
    const html = buildHtmlReport(report({ authors: [author()] }), ctx, i18n)
    expect(html).not.toContain("<script")
  })
})

describe("buildHtmlReport 自包含性", () => {
  it("不引用任何外部资源（无 http(s) 链接、无外链样式/脚本）", () => {
    const html = buildHtmlReport(
      report({
        authors: [author()],
        dailyStats: dailySeries(5),
        hotspots: [hotspotRow("a.ts")],
        debtFiles: [debtRow("b.ts")],
      }),
      ctx,
      i18n,
    )
    expect(html).not.toContain("http://")
    expect(html).not.toContain("https://")
    expect(html).not.toContain("<link ")
    expect(html).not.toContain("<script")
  })

  it("样式与图表均内联（<style> 与 <svg> 存在）", () => {
    const html = buildHtmlReport(report({ dailyStats: dailySeries(3) }), ctx, i18n)
    expect(html).toContain("<style>")
    expect(html).toContain("<svg")
  })
})

describe("buildHtmlReport 文档结构", () => {
  it("输出完整 HTML 文档骨架与标题、页头元信息", () => {
    const html = buildHtmlReport(report(), ctx, i18n)
    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html).toContain("<title>demo 代码统计报告</title>")
    expect(html).toContain("</html>")
    expect(html).toContain("/home/u/demo")
    expect(html).toContain("近6月")
  })

  it("5 个分区区块与其 id 锚点齐全（页头目录可跳转）", () => {
    const html = buildHtmlReport(report(), ctx, i18n)
    for (const id of ["sec-overview", "sec-authors", "sec-debt", "sec-hotspot", "sec-trend"]) {
      expect(html).toContain(`id="${id}"`)
      expect(html).toContain(`href="#${id}"`)
    }
  })

  it("四个分区标题均渲染", () => {
    const html = buildHtmlReport(report(), ctx, i18n)
    for (const label of ["团队总览", "代码贡献度", "技术债务", "代码热点", "提交趋势"]) {
      expect(html).toContain(label)
    }
  })
})

describe("buildHtmlReport 空数据与边界", () => {
  it("零提交时仍产出闭合文档而非半截 HTML", () => {
    const html = buildHtmlReport(buildEmptyReport("近6月"), ctx, i18n)
    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html.trimEnd().endsWith("</html>")).toBe(true)
  })

  it("各分区空数组时显示空态且不抛异常", () => {
    const html = buildHtmlReport(report({
      authors: [],
      debtFiles: [],
      hotspots: [],
      dailyStats: [],
    }), ctx, i18n)
    expect(html).toContain("范围内没有数据")
    expect(html).toContain("范围内没有发现技术债务问题")
    expect(html.trimEnd().endsWith("</html>")).toBe(true)
  })

  it("author 的 topFiles 为空时不渲染空列表", () => {
    const html = buildHtmlReport(report({ authors: [author({ topFiles: [] })] }), ctx, i18n)
    expect(html).not.toContain("<ul class=\"rp-sub-list\">")
  })

  it("i18n 缺键时回退空串而不把 undefined 写进文档", () => {
    const html = buildHtmlReport(report({ authors: [author()] }), ctx, {})
    expect(html).not.toContain("undefined")
  })

  it("loc 为 null 的文件行显示占位符而非 NaN", () => {
    const html = buildHtmlReport(report({
      debtFiles: [{
        ...debtRow("x.ts"),
        loc: null,
      }],
    }), ctx, i18n)
    expect(html).not.toContain("NaN")
  })
})

describe("buildHtmlReport K 线分桶", () => {
  it("超过 MAX_CANDLES 天时按桶聚合，蜡烛数有界", () => {
    const days = MAX_CANDLES * 3
    const html = buildHtmlReport(report({ dailyStats: dailySeries(days) }), ctx, i18n)
    // 必须在「提交趋势」分区内取第一个 svg（K 线），否则会把星期/时段柱状图的 rect 一并计入
    const trend = html.slice(html.indexOf('id="sec-trend"'))
    const candleSvg = (trend.match(/<svg[\s\S]*?<\/svg>/) ?? [""])[0]
    const rects = candleSvg.match(/<rect /g) ?? []
    // 该 svg 含 1 个工作时间底色 rect + N 个蜡烛实体 rect
    const candleBodies = rects.length - 1
    expect(candleBodies).toBeGreaterThan(0)
    expect(candleBodies).toBeLessThanOrEqual(MAX_CANDLES)
    // 聚合提示应出现
    expect(html).toContain("已按每")
  })

  it("短序列不聚合", () => {
    const html = buildHtmlReport(report({ dailyStats: dailySeries(5) }), ctx, i18n)
    expect(html).not.toContain("已按每")
  })
})

describe("reportFileName", () => {
  it("净化跨平台非法字符并保留 .html 扩展名", () => {
    const name = reportFileName(`a/b:c*d?e"f<g>h|i`, "2025-01-02T03:04:00.000Z")
    expect(name.endsWith(".html")).toBe(true)
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
  })

  it("空白与首尾点被替换/剥离（Windows 不允许尾随点空格）", () => {
    const name = reportFileName("  my repo.  ", "2025-01-02T03:04:00.000Z")
    expect(name).not.toMatch(/s/)
    expect(name).not.toMatch(/^\./)
    expect(name.endsWith(".html")).toBe(true)
  })

  it("项目名为空时回退 report 前缀", () => {
    expect(reportFileName("", "2025-01-02T03:04:00.000Z").startsWith("report-")).toBe(true)
  })

  it("超长项目名被截断，文件名长度可控", () => {
    const name = reportFileName("x".repeat(300), "2025-01-02T03:04:00.000Z")
    expect(name.length).toBeLessThan(120)
    expect(name.endsWith(".html")).toBe(true)
  })

  it("含时间戳以便同项目多次导出不互相覆盖", () => {
    const a = reportFileName("demo", "2025-01-02T03:04:00.000Z")
    const b = reportFileName("demo", "2025-01-02T05:06:00.000Z")
    expect(a).not.toBe(b)
  })
})
