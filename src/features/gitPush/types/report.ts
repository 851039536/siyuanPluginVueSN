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

/** 质量等级（S/A/B/C/D，评分阈值见 reportMetrics.qualityGrade） */
export type QualityGrade = "S" | "A" | "B" | "C" | "D"

/** 质量等级元数据（stars 为星级展示数量，color 用于评级徽章） */
export const GRADE_META: Record<QualityGrade, { labelKey: string, stars: number, color: string }> = {
  S: { labelKey: "reportGradeS", stars: 5, color: "#10b981" },
  A: { labelKey: "reportGradeA", stars: 5, color: "#10b981" },
  B: { labelKey: "reportGradeB", stars: 4, color: "#f59e0b" },
  C: { labelKey: "reportGradeC", stars: 3, color: "#f59e0b" },
  D: { labelKey: "reportGradeD", stars: 2, color: "#ef4444" },
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
  /** 代码质量评分（启发式公式，见 reportMetrics.qualityScore） */
  quality: number
  /** 质量等级 */
  grade: QualityGrade
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

/** 热点文件行（含热度评分与建议文案键） */
export interface HotspotFileRow extends FileStatRow {
  level: HotspotLevel
  /** 热度评分 0~100 */
  heat: number
  /** 建议文案的 i18n 键（如 reportHeatAdviceHot，由 UI 层解析，避免语言快照烤入数据层） */
  adviceKey: string
}

/** 热点等级汇总（统计摘要表行） */
export interface HotspotLevelSummary {
  level: HotspotLevel
  /** 该等级文件数 */
  count: number
  /** 占比（0~100 整数百分比） */
  pct: number
}

// ── 报告聚合视图 ──

/** 代码统计报告聚合视图（CodeReportPanel 唯一数据 prop，由 useCodeReport 产出） */
export interface CodeReportData {
  /** 是否成功（false = git 命令失败/路径无效/非仓库） */
  ok: boolean
  /** 项目 ID */
  projectId: string
  /** 项目名称 */
  projectName: string
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
    /** 平均代码质量（作者质量分简单平均，四舍五入） */
    avgQuality: number
    /** 最活跃贡献者（提交次数最多的作者） */
    topAuthor: string
  }
  /** 作者贡献度排行（按提交次数降序） */
  authors: AuthorReportRow[]
  /** 技术债务文件（按严重度分组、组内按风险分升序排列） */
  debtFiles: DebtFileRow[]
  /** 严重度计数（无数据的分组为 0） */
  debtSummary: Record<DebtSeverity, number>
  /** 热点文件排行（全部文件按热度降序取前 N） */
  hotspots: HotspotFileRow[]
  /** 四类热度汇总（按等级排序） */
  hotspotSummary: HotspotLevelSummary[]
  /** 优化建议文案的 i18n 键（如 reportSugNormal，由 UI 层解析，避免语言快照烤入数据层） */
  suggestionKey: string
  /** 分析涉及的文件数（numstat 去重后） */
  analyzedFiles: number
}

/** 统计报告偏好设置（持久化到 git-push-report-prefs：进入视图恢复上次选择） */
export interface CodeReportPrefs {
  /** 上次选中的项目 ID（空串=自动取首个项目） */
  projectId: string
  /** 时间范围 */
  range: ReportRange
  /** 技术债务门槛（修改次数低于该值不列为债务；可选字段兼容旧存储，缺省用 DEBT_MIN_MOD_COUNT） */
  debtMinModCount?: number
}

/** 统计报告偏好默认值 */
export const DEFAULT_REPORT_PREFS: CodeReportPrefs = {
  projectId: "",
  range: "6m",
}
