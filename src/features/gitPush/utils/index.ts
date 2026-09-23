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
  isAheadOfRemote,
  normalizeGitUrl,
  PLATFORM_FLAG_BY_KEY,
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
  parseBranches,
  parseCommitFiles,
  parseCommitLog,
  parseCommitShortStats,
  parseStashList,
  parseWorktreeStatus,
} from "./gitOutput"
export type { WorktreeStatusParse } from "./gitOutput"

export {
  buildDailyCommitBuckets,
  buildDayCountMap,
  formatIsoDate,
  formatLocalDate,
  heatCellColor,
  heatCellTooltip,
  heatLevel,
  parseCommitAnalysisType,
  rankByCount,
  resolveAnalysisRange,
  ruleReasonDesc,
  ruleReasonText,
} from "./analysis"

export {
  activityLevel,
  analysisStatusText,
  buildYearOptions,
  DEFAULT_LOG_LIMIT,
  formatDateTime,
  formatLogTime,
  hasLogPlatforms,
  logActionLabel,
  relativeTime,
} from "./format"

export {
  barPct,
  compareProjectLineRank,
  maxOf,
  netClass,
  ratioPct,
  withBarPct,
  withLineBarPct,
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
  classifyFetchFailure,
  fetchFailureReason,
  ProjectFetchError,
} from "./errors"
