// gitPush 代码统计报告：类型定义 + 元数据常量（labelKey 驱动 i18n，颜色驱动徽章/条形着色）

/** 统计时间范围（value 与下拉框绑定，since 为 git log --since 参数，all 为空=全量） */
export type ReportRange = "all" | "3m" | "6m" | "1y"

/** 时间范围选项（单一数据源：下拉框 + git 命令参数共用） */
export const REPORT_RANGES: ReadonlyArray<{ value: ReportRange, since: string }> = [
  { value: "all", since: "" },
  { value: "3m", since: "3 months ago" },
  { value: "6m", since: "6 months ago" },
  { value: "1y", since: "1 year ago" },
]

/** 时间范围对应的 i18n 键（reportRangeAll / reportRange3M / reportRange6M / reportRange1Y，下拉框与范围标签共用） */
export const REPORT_RANGE_LABEL_KEYS: Record<ReportRange, string> = {
  all: "reportRangeAll",
  "3m": "reportRange3M",
  "6m": "reportRange6M",
  "1y": "reportRange1Y",
}

// ── 作者贡献度 ──

/** 作者贡献度排行行（代码贡献度分析报告数据源） */
export interface AuthorReportRow {
  /** 作者名 */
  author: string
  /** 提交次数 */
  commits: number
  /** 新增代码行数（numstat 新增行合计，即"代码行数"） */
  linesAdded: number
  /** 删除代码行数（numstat 删除行合计，代码流失量） */
  linesDeleted: number
  /** 净增行数（新增 - 删除） */
  netLines: number
  /** 平均提交大小（新增行/提交数，四舍五入） */
  avgCommitSize: number
  /** 提交频率（提交数/跨度周数，次/周） */
  frequency: number
  /** 影响文件数 */
  filesTouched: number
  /** 活跃天数（首个提交与末次提交之间的日历天数，最小 1） */
  activeDays: number
  /** 最早提交时间（ISO，活跃时间范围起点；无有效日期时为空串） */
  firstCommitAt: string
  /** 最近提交时间（ISO，活跃时间范围终点；无有效日期时为空串） */
  lastCommitAt: string
  /** 代码流失率（删除行/新增行，0~1 小数；无新增时为 0） */
  churnRate: number
  /** 修改最多的文件 Top3 [路径, 修改次数]，按次数降序 */
  topFiles: Array<{ path: string, count: number }>
}

// ── 技术债务 ──

/** 技术债务严重度（分组标题） */
export type DebtSeverity = "severe" | "high" | "medium" | "low"

/** 严重度元数据（labelKey 为 i18n 键，color 用于徽章） */
export const DEBT_SEVERITY_META: Record<DebtSeverity, { labelKey: string, color: string }> = {
  severe: { labelKey: "reportDebtSevere", color: "#ef4444" },
  high: { labelKey: "reportDebtHigh", color: "#f59e0b" },
  medium: { labelKey: "reportDebtMedium", color: "#64748b" },
  low: { labelKey: "reportDebtLow", color: "#9ca3af" },
}

/** 严重度顺序（由 META 键序派生的唯一源：severe → high → medium → low，分组遍历与组间排序共用） */
export const DEBT_SEVERITY_ORDER: DebtSeverity[] = Object.keys(DEBT_SEVERITY_META) as DebtSeverity[]

/** 文件统计基础行（技术债务/热点共用，由 git numstat + fs 读取派生） */
export interface FileStatRow {
  /** 相对仓库根目录路径 */
  path: string
  /** 修改次数 */
  modCount: number
  /** 参与作者数 */
  authorCount: number
  /** 最后修改时间（ISO，无记录时为空串） */
  lastModified: string
  /** 代码行数（fs 直接读取，null=暂无数据，与参考报告一致） */
  loc: number | null
  /** 新增代码行数（numstat 汇总，分析范围内该文件被新增的总行数） */
  added: number
  /** 删除代码行数（numstat 汇总，分析范围内该文件被删除的总行数） */
  deleted: number
}

/** 技术债务文件行（含风险评分；由修改次数+参与人数派生） */
export interface DebtFileRow extends FileStatRow {
  severity: DebtSeverity
  /** 风险评分（越高越需要关注，展示列"评分"） */
  riskScore: number
}

// ── 代码热点 ──

/** 热点等级（按热度阈值划分，见 reportMetrics.heatLevel） */
export type HotspotLevel = "hot" | "warm" | "cool" | "cold"

/** 热点等级元数据 */
export const HOTSPOT_LEVEL_META: Record<HotspotLevel, { labelKey: string, color: string }> = {
  hot: { labelKey: "reportHeatHot", color: "#ef4444" },
  warm: { labelKey: "reportHeatWarm", color: "#f59e0b" },
  cool: { labelKey: "reportHeatCool", color: "#3b82f6" },
  cold: { labelKey: "reportHeatCold", color: "#9ca3af" },
}

/** 热点等级顺序（由 META 键序派生的唯一源：hot → warm → cool → cold，汇总表遍历共用） */
export const HOTSPOT_LEVEL_ORDER: HotspotLevel[] = Object.keys(HOTSPOT_LEVEL_META) as HotspotLevel[]

/** 热点文件行（含热度评分） */
export interface HotspotFileRow extends FileStatRow {
  level: HotspotLevel
  /** 热度评分 0~100 */
  heat: number
}

/** 热点等级汇总（统计摘要表行） */
export interface HotspotLevelSummary {
  level: HotspotLevel
  /** 该等级文件数 */
  count: number
  /** 占比（0~100 整数百分比） */
  pct: number
}

// ── 提交 K 线图 ──

/**
 * 每日提交统计（提交 K 线图数据源）。
 * 以「一天中的时刻（小时，含分钟小数，0~24）」为 y 轴，每个活跃日一根蜡烛：
 * - 开盘 open：当日第一条提交的时刻；收盘 close：当日最后一条提交的时刻（实体 = 当日提交活跃时间跨度）
 * - 影线 low/high：在实体上下各外扩 0.5 小时形成上下影线视觉，实体颜色按提交量较前一活跃日增减区分（红跌/绿涨）
 */
export interface DailyCommitStat {
  /** 日期 YYYY-MM-DD */
  date: string
  /** 开盘：当日第一条提交的时刻（小时，含分钟小数，如 9.25 = 09:15） */
  open: number
  /** 收盘：当日最后一条提交的时刻（小时，含分钟小数） */
  close: number
  /** 最高：影线上沿（= max(open, close) + 0.5h） */
  high: number
  /** 最低：影线下沿（= min(open, close) - 0.5h） */
  low: number
  /** 当日提交总数（实体颜色涨跌依据） */
  count: number
}

// ── 提交节奏（星期分布 / 时段分布 / 最长连续提交）──

/** 星期分布统计（7 项，下标 0=周日 ~ 6=周六，与 Date.getDay 对齐） */
export interface WeekdayStat {
  /** 星期数字（0=周日 ~ 6=周六） */
  dow: number
  /** 该星期提交总数 */
  count: number
}

/** 时段分布统计（24h 按 2 小时分桶，共 12 桶） */
export interface HourBucketStat {
  /** 桶起始小时（0~22，步长 2） */
  start: number
  /** 桶结束小时（start+2） */
  end: number
  /** 该时段提交总数 */
  count: number
}

/**
 * 提交节奏聚合（提交趋势分区的迷你图表 + 扩展摘要卡片数据源）。
 * 全部由 commits 派生，与 dailyStats 同源。
 */
export interface CommitRhythmStats {
  /** 周一~周日提交分布（7 项，下标 0=周日，与 getDay 对齐；无提交的星期 count=0） */
  weekday: WeekdayStat[]
  /** 24h 分桶（12 项，每桶 2 小时；无提交的时段 count=0） */
  hourly: HourBucketStat[]
  /** 最活跃星期（提交数最多的星期；全部为 0 时 dow 取 1=周一） */
  topWeekday: WeekdayStat
  /** 高峰提交时段（提交数最多的一桶；全部为 0 时取首桶） */
  peakHours: HourBucketStat
  /** 最长连续提交天数（按本地日历日去重后计算，无提交为 0） */
  maxStreak: number
}

/** 星期标签的 i18n 键（下标 0=周日 ~ 6=周六，与 Date.getDay 对齐，供迷你图表与摘要卡片取文案） */
export const WEEKDAY_LABEL_KEYS: readonly string[] = [
  "reportWeekSun",
  "reportWeekMon",
  "reportWeekTue",
  "reportWeekWed",
  "reportWeekThu",
  "reportWeekFri",
  "reportWeekSat",
]

// ── 报告聚合视图 ──

/** 代码统计报告聚合视图（CodeReportPanel 唯一数据 prop，由 useCodeReport 产出） */
export interface CodeReportData {
  /** 是否成功（false = git 命令失败/路径无效/非仓库） */
  ok: boolean
  /** 分析时间范围标签（all 时为首次提交的相对时间，如 "5 months ago"；其余为范围名） */
  rangeLabel: string
  /** 生成时间（ISO） */
  generatedAt: string
  /** 时间范围内的提交总数 */
  totalCommits: number
  /** 团队总览（KPI 卡片数据源） */
  teamOverview: {
    /** 团队成员数（去重作者数） */
    memberCount: number
    /** 总提交数 */
    totalCommits: number
    /** 总代码量（全部新增行合计） */
    totalLines: number
    /** 最活跃贡献者（提交次数最多的作者） */
    topAuthor: string
  }
  /** 作者贡献度排行（按提交次数降序） */
  authors: AuthorReportRow[]
  /** 技术债务文件（按严重度分组、组内按风险分降序排列） */
  debtFiles: DebtFileRow[]
  /** 严重度计数（无数据的分组为 0） */
  debtSummary: Record<DebtSeverity, number>
  /** 热点文件排行（全部文件按热度降序取前 N） */
  hotspots: HotspotFileRow[]
  /** 四类热度汇总（按等级排序） */
  hotspotSummary: HotspotLevelSummary[]
  /** 优化建议文案的 i18n 键（如 reportSugNormal，由 UI 层解析，避免语言快照烤入数据层） */
  suggestionKey: string
  /** 每日提交统计（提交 K 线图数据源，按日期升序；git 失败或零提交时为空数组） */
  dailyStats: DailyCommitStat[]
  /** 提交节奏聚合（星期分布/时段分布/最长连续提交；与 dailyStats 同源，git 失败时为零值结构） */
  rhythm: CommitRhythmStats
  /** 分析涉及的文件数（numstat 去重后） */
  analyzedFiles: number
  /** 作者 Top 修改文件详情查找表（路径 → 完整统计行，含预读 LOC；供文件详情弹窗随机访问） */
  fileDetailsMap: Record<string, FileStatRow>
}

/** 统计报告偏好设置（持久化到 git-push-report-prefs：进入视图恢复上次选择） */
export interface CodeReportPrefs {
  /** 上次选中的项目 ID（空串=自动取首个项目） */
  projectId: string
  /** 时间范围 */
  range: ReportRange
}

/** 统计报告偏好默认值 */
export const DEFAULT_REPORT_PREFS: CodeReportPrefs = {
  projectId: "",
  range: "6m",
}
