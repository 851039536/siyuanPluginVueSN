// gitPush 提交分析纯函数：本地日期聚合、热力等级与格子展示、通用计数排行、规则原因文案
// 直连 types/meta（纯类型与常量）而非 "../types" 桶：桶含 GitPushManager 等运行时模块，
// 会把运行时 siyuan 依赖拉进模块图，使本纯函数模块无法在 Node 单测环境加载。
import type { CommitAnalysisEntry, CommitHeatMetric, CommitRuleReasonKey } from "../types/meta"
import { ANALYSIS_WEEKDAY_KEYS, COMMIT_RULE_REASON_META, HEAT_LEVEL_THRESHOLDS } from "../types/meta"

/** ISO 日期 → YYYY-MM-DD（git %aI 为 UTC ISO，切前 10 位即可；无值返回 —；报告视图文件详情/活跃范围共用） */
export function formatIsoDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "—"
}

/** 本地日期格式化：Date → YYYY-MM-DD（日聚合/热力图共用，避免 UTC 解析在西半球时区跨日偏移） */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** 今天（或指定时刻）的本地日期键 YYYY-MM-DD，与 formatLocalDate 同口径 */
export function localDayKey(d: Date = new Date()): string {
  return formatLocalDate(d)
}

/**
 * 日期键是否落在「以 bucketStart 为首日、连续 spanDays 天」的桶内。
 * 聚合 K 线的「今日」定位必须校验桶尾：仅比较 `今天 ≥ 桶首日` 会把早已结束的旧桶
 * （全量范围下的历史仓库）误标为今天。
 */
export function isDayKeyInBucket(dayKey: string, bucketStart: string, spanDays: number): boolean {
  const toUtcMs = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const diffDays = Math.round((toUtcMs(dayKey) - toUtcMs(bucketStart)) / (24 * 60 * 60 * 1000))
  return diffDays >= 0 && diffDays < spanDays
}

/**
 * 按本地日期（YYYY-MM-DD）聚合提交条目为日计数映射（热力图/日历视图共用，缺天不补 0，无效日期跳过）。
 * 注：reportMetrics.aggregateDailyStats 刻意不复用本函数——其输入 NumstatCommit 需同步
 * 聚合 open/close（首末提交时刻）语义，仅在注释处互指防口径漂移。
 */
export function buildDayCountMap(entries: CommitAnalysisEntry[]): Map<string, number> {
  const countByDay = new Map<string, number>()
  for (const e of entries) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatLocalDate(d)
    countByDay.set(key, (countByDay.get(key) || 0) + 1)
  }
  return countByDay
}

/**
 * 按指标口径聚合日值（热力图指标切换的唯一入口）：
 * - commits：当日提交条数（复用 buildDayCountMap）；
 * - projects / authors：当日**去重**后的项目数 / 作者数（同一天同一个人提交十次仍算 1）。
 * 三者共用同一次 commit log 抓取结果，切换指标不额外跑 git。
 */
export function buildDayMetricMap(entries: CommitAnalysisEntry[], metric: CommitHeatMetric): Map<string, number> {
  if (metric === "commits") return buildDayCountMap(entries)
  const distinctByDay = new Map<string, Set<string>>()
  for (const e of entries) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatLocalDate(d)
    const value = metric === "projects" ? e.projectId : e.author
    const set = distinctByDay.get(key)
    if (set) set.add(value)
    else distinctByDay.set(key, new Set([value]))
  }
  const counts = new Map<string, number>()
  for (const [day, set] of distinctByDay) counts.set(day, set.size)
  return counts
}

/** 范围内热力摘要（标题行右侧三个数字；口径跟随当前指标，故字段名不带"提交"字样） */
export interface HeatRangeSummary {
  /** 范围内总值（当前指标口径） */
  total: number
  /** 有数据的天数 */
  activeDays: number
  /** 尾部连续天数：从范围末尾（通常是今天）往回数 */
  currentStreak: number
  /** 范围内最长连续天数 */
  longestStreak: number
}

/**
 * 统计范围内的热力摘要（连续天数 / 最长连续 / 合计）。
 *
 * 「当前连续」按**范围末尾**往回数，而不是写死「今天」：范围为历史年份时（如 2024 至今的 2024 段），
 * 以今天为准会把整段历史都算成断档，反而误导；范围末尾与今日一致时语义就是「到今天的连续」。
 */
export function summarizeHeatRange(
  dayCounts: Map<string, number>,
  start: string,
  end: string,
): HeatRangeSummary {
  const [sy, sm, sd] = start.split("-").map(Number)
  const [ey, em, ed] = end.split("-").map(Number)
  const cursor = new Date(sy, sm - 1, sd)
  const last = new Date(ey, em - 1, ed)
  const active: boolean[] = []
  let total = 0
  let activeDays = 0
  let longest = 0
  let run = 0
  while (cursor <= last) {
    const count = dayCounts.get(formatLocalDate(cursor)) || 0
    total += count
    if (count > 0) {
      activeDays++
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
    active.push(count > 0)
    cursor.setDate(cursor.getDate() + 1)
  }
  let currentStreak = 0
  for (let i = active.length - 1; i >= 0; i--) {
    if (!active[i]) break
    currentStreak++
  }
  return { total, activeDays, currentStreak, longestStreak: longest }
}

/**
 * 热力等级：把日提交数映射为 0~4 级（数组下标即等级，首项恒为 0）。
 * thresholds 缺省用固定档 HEAT_LEVEL_THRESHOLDS；自适应档由 computeHeatThresholds 产出同形数组。
 */
export function heatLevel(count: number, thresholds: readonly number[] = HEAT_LEVEL_THRESHOLDS): number {
  let level = 0
  for (let i = thresholds.length - 1; i > 0; i--) {
    if (count >= thresholds[i]) { level = i; break }
  }
  return level
}

/** 自适应分档所用的分位点（P50/P75/P90/P95，统计对象是范围内**非零日**——零值日本身恒为 0 级，参与分位会整体压低档位） */
export const HEAT_SCALE_QUANTILES = [0.5, 0.75, 0.9, 0.95] as const

/**
 * 自适应热力阈值：按「范围内非零日提交数」的分位点生成 4 档阈值。
 *
 * 动机：固定阈值 1/3/6/12 在多个项目合并统计时几乎每格都 ≥12，颜色退化为单色；
 * 改用分位数后，深浅表达的是「相对自己这段时间的活跃度」，分辨率回到四档。
 *
 * 返回数组与 HEAT_LEVEL_THRESHOLDS 同形（首项 0），可直接喂给 heatLevel。
 * 三条兜底规则：
 * 1. 阈值钳制在观测最大值以内 —— 否则末尾档位可能高过最大值，「最热的一天」永远到不了 4 级；
 * 2. 档位按严格递增推进 —— 分位点在集中分布下会塌陷（多个分位取到同一个值），
 *    逐级 +1 才能分出深浅（如「1 次 × 365 天 + 某天 100 次」时，普通日仍浅、峰值日照样最深）；
 * 3. 若四档仍塌成同一级（所有非零日次数完全相同）则退回固定档 —— 此时整片格子同色，
 *    不如沿用固定阈值给出「活动量」的绝对感受。
 * 无非零日时同样退回固定档（此时全为 0 级，取值不影响观感）。
 */
export function computeHeatThresholds(counts: ReadonlyArray<number>): number[] {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b)
  if (nonZero.length === 0) return [...HEAT_LEVEL_THRESHOLDS]
  const max = nonZero[nonZero.length - 1]
  const thresholds = [0]
  for (const q of HEAT_SCALE_QUANTILES) {
    // 最近秩法（nearest-rank）：下标至少取到末位，避免 q*len 向上取整后越界
    const picked = nonZero[Math.min(nonZero.length - 1, Math.ceil(q * nonZero.length) - 1)]
    thresholds.push(Math.min(max, Math.max(picked, thresholds[thresholds.length - 1] + 1)))
  }
  if (thresholds[1] === thresholds[4]) return [...HEAT_LEVEL_THRESHOLDS]
  return thresholds
}

/** 解析热力图/日历显示范围：最近一年 = 今天−364 天 ~ 今天；年份 N = N-01-01 ~ 今年今天 / N-12-31 */
export function resolveAnalysisRange(range: "lastYear" | number): { start: Date, end: Date } {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  if (range === "lastYear") {
    const start = new Date(end)
    start.setDate(start.getDate() - 364)
    return { start, end }
  }
  const start = new Date(range, 0, 1)
  if (range < end.getFullYear()) end.setMonth(11, 31)
  return { start, end }
}

/** 热力格子背景色：level 0 用主题表面灰；level 1~4 用主色按 20%/40%/60%/85% 透明度（hex+alpha 后缀，深浅主题通用） */
export function heatCellColor(level: number, main: string): string {
  if (level <= 0) return "rgba(var(--b3-theme-on-surface-rgb), 0.05)"
  return `${main}${["33", "66", "99", "D9"][Math.min(level, 4) - 1]}`
}

/**
 * 热力图/日历格子 tooltip："2026-08-01（周六）：3 次提交"。
 * 两个视图共用同一文案口径（i18n 键 analysisHeatTooltip 占位 {0}日期 {1}星期 {2}数值 {3}量词）。
 * 量词随指标口径变化（次提交 / 个项目 / 位作者），故由调用方传 unitKey。
 */
export function heatCellTooltip(
  i18n: Record<string, any>,
  date: string,
  count: number,
  unitKey = "analysisHeatUnitCommits",
): string {
  const [y, m, d] = date.split("-").map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return String(i18n.analysisHeatTooltip || "")
    .replace("{0}", date)
    .replace("{1}", i18n[ANALYSIS_WEEKDAY_KEYS[dow]] || "")
    .replace("{2}", String(count))
    .replace("{3}", i18n[unitKey] || "")
}

/** 热力图/日历共用：单个日格的展示数据（样式 + tooltip + 计数） */
export interface DayCellView {
  /** YYYY-MM-DD */
  date: string
  /** 该日提交数 */
  count: number
  /**
   * 预计算的格子内联样式**对象**。
   * 存对象而非颜色串：模板绑定同一引用后，Vue 不会把每次重渲染都当成 style 变更去 patch
   * （一年 53 周 × 7 行 = 371 格 / 12 月 × 31 天 ≈ 372 格，逐格 patch 是明显浪费）。
   */
  style: Record<string, string>
  /** 悬停文案（"2026-08-01（周六）：3 次提交"） */
  tooltip: string
}

/** buildDayCell 的可选项（分档阈值与 tooltip 量词都由调用方按当前视图设置决定） */
export interface DayCellOptions {
  /** 分档阈值（首项 0；缺省固定档） */
  thresholds?: readonly number[]
  /** tooltip 量词的 i18n 键（缺省提交数口径 analysisHeatUnitCommits） */
  unitKey?: string
}

/**
 * 构建单个日格的展示数据（热力图与日历共用，消除两处重复的
 * `heatLevel → heatCellColor` + `heatCellTooltip` 组合）。
 *
 * 两个组件对同一份 dayCounts 渲染出不同形态（周列网格 vs 月卡片），
 * 但「某一天显示什么颜色、什么 tooltip」的口径必须一致，故收敛到此处。
 * 阈值与量词由调用方统一传入（同一份分档喂给两个视图，避免切换视图时同一天换颜色）。
 */
export function buildDayCell(
  i18n: Record<string, any>,
  date: string,
  count: number,
  color: string,
  opts: DayCellOptions = {},
): DayCellView {
  const { thresholds = HEAT_LEVEL_THRESHOLDS, unitKey } = opts
  return {
    date,
    count,
    style: { background: heatCellColor(heatLevel(count, thresholds), color) },
    tooltip: heatCellTooltip(i18n, date, count, unitKey),
  }
}

/**
 * 通用计数排行：按 keyFn 分组计数，降序取前 limit 条，并额外返回截断前的**完整分组数**（totalGroups）。
 *
 * 用途：排行区在截断时须向用户交代「仅显示前 N 名（共 M 名）」——否则各行次数之和会**小于**
 * 顶部 KPI 卡的总提交数，看起来像统计出错（项目数 > PROJECT_RANK_LIMIT 时必然发生）。
 */
export function rankByCountWithTotal<T>(
  items: T[],
  keyFn: (item: T) => string,
  limit: number,
): { rows: { key: string, count: number }[], totalGroups: number } {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  const sorted = [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
  return { rows: sorted.slice(0, limit), totalGroups: sorted.length }
}

/** 区间统计（热力图/日历框选一段日期后的聚合口径） */
export interface CommitRangeSummary {
  /** 区间内提交总数（按条目计，不受热力指标影响） */
  total: number
  /** 有提交的天数 */
  activeDays: number
  /** 区间总天数（含无提交日，闭区间） */
  daySpan: number
  /** 去重项目数 */
  projectCount: number
  /** 去重作者数 */
  authorCount: number
  /** 最活跃的一天（并列取较早的一天；区间无提交时为 null） */
  busiest: { date: string, count: number } | null
  /** 项目排行（降序，已按 rankLimit 截断） */
  topProjects: { key: string, count: number }[]
  /** 作者排行（降序，已按 rankLimit 截断） */
  topAuthors: { key: string, count: number }[]
}

/**
 * 区间统计：按本地日期把条目裁剪到 [start, end] 后聚合。
 *
 * 与 `summarizeHeatRange` 的分工：后者吃「日值映射」，故 total 是**当前指标之和**
 * （选「活跃作者」时是每日去重作者数累加，不是提交数），用于标题行的口径跟随；
 * 本函数吃原始条目，total 恒为提交条数，用于框选后的区间面板。
 * 两者刻意不复用，避免「同一段文字在标题与面板里指的却不是一件事」。
 */
export function summarizeCommitRange(
  entries: CommitAnalysisEntry[],
  start: string,
  end: string,
  rankLimit = 3,
): CommitRangeSummary {
  const inRange = entries.filter((e) => {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) return false
    const key = formatLocalDate(d)
    return key >= start && key <= end
  })

  const byDay = new Map<string, number>()
  for (const e of inRange) {
    const key = formatLocalDate(new Date(e.date))
    byDay.set(key, (byDay.get(key) || 0) + 1)
  }
  // 并列时取较早的一天：Map 迭代序为插入序，不能依赖，故显式比较日期
  let busiest: { date: string, count: number } | null = null
  for (const [date, count] of byDay) {
    if (!busiest || count > busiest.count || (count === busiest.count && date < busiest.date)) {
      busiest = { date, count }
    }
  }

  const toUtcMs = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }

  return {
    total: inRange.length,
    activeDays: byDay.size,
    // +1 是因为闭区间（同一天起止 = 1 天）
    daySpan: Math.round((toUtcMs(end) - toUtcMs(start)) / 86_400_000) + 1,
    projectCount: new Set(inRange.map((e) => e.projectId)).size,
    authorCount: new Set(inRange.map((e) => e.author)).size,
    busiest,
    topProjects: rankByCountWithTotal(inRange, (e) => e.projectId, rankLimit).rows,
    topAuthors: rankByCountWithTotal(inRange, (e) => e.author, rankLimit).rows,
  }
}

// ── 提交规则原因文案（元数据只存 i18n 键，文案由视图层经 i18n 解析；四处标签共用）──

/**
 * 规则原因简短标签（表格/徽章内展示，如"scope 格式非法"）。
 * 元数据缺失或 i18n 未命中时回退原始 reason 码，避免出现空白标签（同 fileStatusText 的降级口径）。
 */
export function ruleReasonText(reason: CommitRuleReasonKey, i18n: Record<string, any>): string {
  const key = COMMIT_RULE_REASON_META[reason]?.labelKey
  return (key && i18n[key]) || reason
}

/**
 * 规则原因悬停说明（一句话讲清"为什么判违规 + 怎么改"，如"scope 仅允许小写字母、数字、连字符"）。
 * 供各标签的 title 使用，使用户无需查文档即可理解违规含义。
 */
export function ruleReasonDesc(reason: CommitRuleReasonKey, i18n: Record<string, any>): string {
  const key = COMMIT_RULE_REASON_META[reason]?.descKey
  return (key && i18n[key]) || ruleReasonText(reason, i18n)
}
