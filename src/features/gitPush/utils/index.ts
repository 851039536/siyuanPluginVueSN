// gitPush 工具函数汇聚入口（按域拆分到同名模块，导出面与拆分前一致；消费方仍从 "../utils" 导入）
// 域划分：project 项目与路径 / platform 平台与远程 / fileStatus 文件状态标记 / diffText 差异文本
//        gitOutput git 输出解析 / analysis 提交分析 / format 展示格式化 / metrics 指标计算
//        search 搜索高亮 / runtime 缓存与并发 / errors 失败分类

export {
  findProject,
  findProjectIndex,
  getAllProjectPathsForDedup,
  getCurrentDeviceName,
  gitUrlToWebUrl,
  normalizePathForDedup,
  openLocalPath,
  openRepoWebUrl,
  requireProject,
  resolveValidPath,
  resolveValidPathFromPaths,
  resolveValidPathWithSource,
  sortProjects,
} from "./project"

export {
  findPlatformRemote,
  getProjectRemoteNames,
  hasAnyRemote,
  hasPlatformRemote,
  hasUnpushedCommits,
  mayAttemptPush,
  normalizeGitUrl,
  orderRemotesForPullCheck,
  PLATFORM_FLAG_BY_KEY,
  platformLabel,
  PULL_CHECK_REMOTE_ORDER,
  resolveRemotePlatform,
} from "./platform"

export {
  fileStatusIcon,
  fileStatusIconKey,
  fileStatusText,
  fileStatusTitle,
  isIconFileStatus,
} from "./fileStatus"

export {
  buildDiffContext,
  countDiffStats,
  diffCacheKey,
  DIFF_SIGN,
  parseDiffLines,
} from "./diffText"
export type { DiffLine, DiffLineType, DiffSegment } from "./diffText"

export {
  parseAheadBehind,
  parseBranches,
  parseCommitFiles,
  parseCommitLog,
  parseCommitShortStats,
  parseStashList,
  parseWorktreeStatus,
  parseWorktreeStatusV2,
} from "./gitOutput"
export type { WorktreeStatusParse, WorktreeStatusV2Parse } from "./gitOutput"
export type { DayCellView } from "./analysis"

export {
  buildDayCell,
  buildDayCountMap,
  buildDayMetricMap,
  computeHeatThresholds,
  formatIsoDate,
  formatLocalDate,
  heatCellColor,
  heatCellTooltip,
  heatLevel,
  rankByCountWithTotal,
  resolveAnalysisRange,
  ruleReasonDesc,
  ruleReasonText,
  summarizeCommitRange,
  summarizeHeatRange,
} from "./analysis"
export type { CommitRangeSummary, DayCellOptions, HeatRangeSummary } from "./analysis"

export {
  activityLevel,
  analysisStatusText,
  buildYearOptions,
  DEFAULT_LOG_LIMIT,
  deriveOpOk,
  formatDateTime,
  formatLogEntryText,
  formatLogTime,
  hasLogDetail,
  hasLogPlatforms,
  logActionLabel,
  logDateKey,
  logDateLabel,
  opLogSummary,
  relativeTime,
  statsStatusText,
} from "./format"

export {
  churnText,
  formatNet,
  formatSignedNet,
  splitPath,
} from "./reportFormat"

export {
  compareProjectLineRank,
  maxOf,
  netClass,
  withLineShare,
} from "./metrics"

export { highlightSegments } from "./search"
export type { HighlightSegment } from "./search"

export {
  acquireFlag,
  poolProcess,
  pruneRecordCache,
  releaseFlag,
} from "./runtime"

export {
  buildFileTreeRows,
  buildSectionedTreeRows,
  filterFilesByQuery,
  topLevelDirPaths,
} from "./fileTree"
export type { FileTreeDirRow, FileTreeFileRow, FileTreeRow, FileTreeSectionId, FileTreeSectionRow } from "./fileTree"

export {
  classifyFetchFailure,
  fetchFailureReason,
  ProjectFetchError,
} from "./errors"

export {
  scanProjectScripts,
} from "./scriptScan"
export type { PackageJsonEntry, ScriptFileSet } from "./scriptScan"
export { createScriptOutputDecoder } from "./scriptDecode"
export type { ScriptOutputDecoder } from "./scriptDecode"
