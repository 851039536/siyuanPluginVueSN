// 统计模块纯工具函数：日期/数字格式化、笔记本过滤、文档映射等
/**
 * 格式化时间戳为 HH:MM 字符串
 */
import type {
  ActivitySummary,
  ChangedDoc,
  DocBlockRow,
  NotebookActivityItem,
  NotebookRankingRow,
  ReportPeriod,
} from "../types"

/**
 * 解析成就文案：内置成就的 title/description 为 i18n 键，自定义成就为用户输入的字面文本。
 * 命中键 → 返回译文；未命中 → 原样返回（用户数据，非硬编码兜底）
 */
export function resolveI18nText(i18n: Record<string, any>, keyOrText: string): string {
  const resolved = i18n[keyOrText]
  return typeof resolved === "string" ? resolved : keyOrText
}

/** 结构化报告期 → 本地化标签（模板键含 {year}/{month} 占位符） */
export function formatReportPeriod(period: ReportPeriod, i18n: Record<string, any>): string {
  const template = period.kind === "year" ? i18n.reportYearLabel : i18n.reportMonthLabel
  return String(template ?? "")
    .replace("{year}", String(period.year))
    .replace("{month}", String(period.month ?? ""))
}

export function formatTime(ts: string | undefined): string {
  if (!ts || ts.length < 12) return ""
  return `${ts.substring(8, 10)}:${ts.substring(10, 12)}`
}

/**
 * 过滤出未关闭（打开）的笔记本
 */
export function filterActiveNotebooks(notebooks: Notebook[]): Notebook[] {
  return notebooks.filter((nb) => !nb.closed)
}

/**
 * 去除字符串中的 HTML 标签
 */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/**
 * 按文档块 ID 在思源中打开对应文档（空 ID 不做任何事）
 */
export function openDocById(docId: string): void {
  if (docId) window.open(`siyuan://blocks/${docId}`)
}

/**
 * 将文档块查询行映射为 ChangedDoc（去除 HTML 标签，格式化时间）
 */
export function mapChangedDocs(
  rows: DocBlockRow[],
  timeField: "created" | "updated",
): ChangedDoc[] {
  return rows.map((r) => ({
    id: r.id,
    title: stripTags(r.content || ""),
    time: formatTime(r[timeField]),
  }))
}

/**
 * 格式化数字，添加千分位分隔符
 */
export function formatNumber(num: number): string {
  return (num || 0).toLocaleString("zh-CN")
}

/**
 * 格式化短数字 (K, M)
 */
export function formatShortNumber(num: number): string {
  if (!num) return "0"
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return String(num)
}

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : String(num)
}

/**
 * 计算进度条百分比宽度（默认最小 1%，可指定最小宽度）
 */
export function barPct(val: number, max: number, minWidth = 1): string {
  return `${Math.max((val / max) * 100, minWidth)}%`
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
}

/**
 * 格式化日期为紧凑的 YYYYMMDD 字符串（用于 SQL 日期匹配 / 日期键）
 */
export function formatYmd(date: Date): string {
  return `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}`
}

/**
 * 今天的紧凑日期字符串 YYYYMMDD
 */
export function getTodayStr(): string {
  return formatYmd(new Date())
}

/**
 * 紧凑日期字符串 YYYYMMDD → 带连字符的 YYYY-MM-DD
 */
export function toDashedYmd(ymd: string): string {
  return `${ymd.substring(0, 4)}-${ymd.substring(4, 6)}-${ymd.substring(6, 8)}`
}

/**
 * 紧凑日期字符串 YYYYMMDD → Date（本地时区零点）
 */
export function parseYmd(ymd: string): Date {
  return new Date(
    Number.parseInt(ymd.substring(0, 4)),
    Number.parseInt(ymd.substring(4, 6)) - 1,
    Number.parseInt(ymd.substring(6, 8)),
  )
}

/**
 * 判断日期字符串（格式 YYYY-MM-DD）是否为今天
 */
export function isToday(dateStr: string): boolean {
  if (!dateStr) return false
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`
  return dateStr === todayStr
}

/**
 * 校验日期字符串是否为合法 yyyyMMdd 格式，防止 SQL 注入
 */
export function isValidDateStr(dateStr: string): boolean {
  return /^\d{8}$/.test(dateStr)
}

/**
 * 汇总笔记本活跃度指标（摘要 + 排行），一次遍历同时产出两组数据，供摘要卡与排行表共享
 */
export function computeActivityMetrics(
  notebooks: NotebookActivityItem[],
): { summary: ActivitySummary, ranking: NotebookRankingRow[] } {
  let totalWords = 0
  let mostActiveNb = ""
  let mostActiveWords = 0
  const activeDaysSet = new Set<string>()

  const ranking: NotebookRankingRow[] = []
  for (const nb of notebooks) {
    let nbTotal = 0
    let nbActiveDays = 0
    for (const d of nb.data) {
      if (d.words > 0) {
        nbTotal += d.words
        nbActiveDays++
        activeDaysSet.add(d.date)
      }
    }
    totalWords += nbTotal
    if (nbTotal > mostActiveWords) {
      mostActiveWords = nbTotal
      mostActiveNb = nb.notebook
    }
    ranking.push({
      notebook: nb.notebook,
      color: nb.color,
      totalWords: nbTotal,
      activeDays: nbActiveDays,
      dailyAvg: nbActiveDays > 0 ? Math.round(nbTotal / nbActiveDays) : 0,
      percent: 0,
    })
  }

  for (const row of ranking) {
    row.percent = totalWords > 0 ? Math.round((row.totalWords / totalWords) * 100) : 0
  }

  ranking.sort((a, b) => b.totalWords - a.totalWords)

  return {
    summary: {
      activeCount: notebooks.length,
      mostActive: mostActiveNb || "-",
      totalWords,
      dailyAvg: activeDaysSet.size > 0 ? Math.round(totalWords / activeDaysSet.size) : 0,
    },
    ranking,
  }
}
