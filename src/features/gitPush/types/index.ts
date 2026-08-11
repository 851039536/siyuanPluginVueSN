// gitPush 模块类型定义入口

// ── 重导出管理器（运行时逻辑已迁移至 ../GitPushManager.ts）──
export { GitPushManager } from "../GitPushManager"

// ── 重导出存储类型与常量 ──
export type {
  BranchInfo,
  CommitLogEntry,
  CommitTemplate,
  CommitType,
  ConflictFile,
  FileChange,
  FileChangeStatus,
  GitOpAction,
  GitOpLogEntry,
  GitOpLogPlatform,
  GitProject,
  GitRemoteInfo,
  ProjectCategory,
  ProjectPathExtras,
  PushStatusInfo,
  RemotePushStatus,
  ScannedGitRepo,
  StashEntry,
  TagInfo,
  WorkingTreeInfo,
} from "./storage"
export {
  clampGitConcurrency,
  COMMIT_TYPE_VALUES,
  DEFAULT_ANALYSIS_VIEW_SETTINGS,
  GIT_CONCURRENCY_MAX,
  GIT_CONCURRENCY_MIN,
  GitPushStorage,
  MAX_OP_LOG_COUNT,
  UNGROUPED_ID,
} from "./storage"

// ── 重导出卡片注入契约（provide/inject 消除中间人 props/emits）──
export { CARD_SERVICES_KEY } from "./cardServices"
export type { CardDataDomain, CardRefreshSignals, CardServices } from "./cardServices"

// ── 重导出元数据（来自 meta.ts，独立模块切断循环引用）──
export {
  PLATFORM_META,
  FILE_STATUS_META,
  REMOTES,
  VIEW_MODE_META,
  VIEW_MODES,
  COMMIT_ANALYSIS_TYPE_META,
  HEAT_LEVEL_THRESHOLDS,
} from "./meta"
export type { AuthorLineRankItem, CategoryDistributionItem, CommitAnalysisCache, CommitAnalysisEntry, CommitAnalysisStats, CommitAnalysisType, CommitAnalysisViewSettings, LineStatsCache, NeedsPullItem, NeedsPushItem, PanelView, PendingProjectItem, PlatformKey, PlatformStatusItem, ProjectLineRankItem, PushStatusStats, RemoteCoverage, RepoLinkAuditCell, RepoLinkAuditRow, RepoLinkAuditState, RepoLinkAuditSummary, StatsView, UncommittedItem, ViewMode } from "./meta"
export { getPlatformStatus } from "./meta"

// ── 重导出代码统计报告类型与常量（来自 report.ts）──
export {
  DEFAULT_REPORT_PREFS,
  DEBT_SEVERITY_META,
  HOTSPOT_LEVEL_META,
  REPORT_RANGES,
  REPORT_RANGE_LABEL_KEYS,
  WEEKDAY_LABEL_KEYS,
} from "./report"
export type { AuthorReportRow, CodeReportData, CodeReportPrefs, CommitRhythmStats, DailyCommitStat, DebtFileRow, DebtSeverity, FileStatRow, HotspotFileRow, HotspotLevel, HotspotLevelSummary, HourBucketStat, ReportRange, WeekdayStat } from "./report"
