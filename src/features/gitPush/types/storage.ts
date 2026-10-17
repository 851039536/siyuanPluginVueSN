// Git 项目持久化存储与类型定义
import type { Plugin } from "siyuan"
import type { BfgPrefs, CommitAnalysisCache, CommitAnalysisViewSettings, CommitFixPrefs, DropCommitPrefs, LineStatsCache, PlatformKey, RepoCleanPrefs, RuleCheckPrefs } from "./meta"
import { DEFAULT_COMMIT_RULE_CONFIG } from "./meta"
import type { IndexMeta } from "./indexCache"
import { DEFAULT_INDEX_MAX_COMMITS, DEFAULT_INDEX_META } from "./indexCache"
import type { ConsistencyCache } from "./consistency"
import { EMPTY_CONSISTENCY_CACHE } from "./consistency"
import type { CodeReportData, CodeReportPrefs } from "./report"
import { DEFAULT_REPORT_PREFS } from "./report"
import type { ProbeConfig } from "./probeConfig"
import { DEFAULT_PROBE_CONFIG } from "./probeConfig"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 未分组分类的 ID（魔法字符串收敛为单一常量） */
export const UNGROUPED_ID = "__ungrouped__"

/** Git 并发数允许范围（设置弹窗输入与 GitExecutor 钳位的单一数据源） */
export const GIT_CONCURRENCY_MIN = 1
export const GIT_CONCURRENCY_MAX = 10

/**
 * 默认 git 并发数。
 *
 * 为什么从 3 提到 10：git 调用耗时的绝对主体是**子进程创建**（本机实测单次
 * `git log -n1` ≈ 290ms，其中进程启动占绝大部分），CPU 占用很低、主要是 IO 等待，
 * 因此并发是可观的杠杆。真机实测（同一仓库跑 30 次 `git log -n1`）：
 *
 * | 并发 | 总耗时 | 相对并发 3 |
 * |------|--------|-----------|
 * | 3 | 4.48s | 1.00x |
 * | 6 | 3.82s | 0.85x |
 * | 10 | **3.35s** | **0.75x** |
 * | 12 | 3.52s | 0.79x（回落） |
 * | 16 | 3.83s | 0.86x（更差） |
 *
 * 10 是实测拐点（与 GIT_CONCURRENCY_MAX 一致）：再高会因 OS 进程创建争抢与磁盘饱和反噬。
 *
 * 端到端（30 项目 × 2 次调用）：并发 3 → 21.2s，并发 10 → 12.9s（快 39%）。
 */
export const DEFAULT_GIT_CONCURRENCY = 10

/**
 * 默认并发数变更前的历史值（迁移用）。
 *
 * 老版本默认就是 3，且**无法区分**「用户从没改过（存的是 3）」与「用户主动设成 3」——
 * 两者在存储里都是数字 3。为避免覆盖用户显式选择，迁移只在
 * **该键从未被写过**时才生效（见 migrateGitConcurrency），而不是「值等于 3 就改」。
 */
export const LEGACY_GIT_CONCURRENCY = 3

/**
 * 并发数默认值迁移标记。
 *
 * 语义：该标记**存在**即表示「已跑过一次性迁移」。
 * - 标记存在 → 什么都不做（不覆盖用户任何选择，包括后续手动改回 3）
 * - 标记不存在 → 视情况迁移一次，然后写入标记
 *
 * 为什么需要标记而不是只看并发值：一次性迁移必须**幂等且只用一次**。
 * 若只按「存储里还是旧默认值」判断，用户主动把并发设回 3 后，
 * 下次启动又会被改回 10——这正是必须避免的「覆盖用户设置」。
 */
export const GIT_CONCURRENCY_MIGRATION_VERSION = 1

/** 将 git 并发数整数化并钳位到允许范围 */
export function clampGitConcurrency(n: number): number {
  const num = Math.round(Number(n) || GIT_CONCURRENCY_MIN)
  return Math.max(GIT_CONCURRENCY_MIN, Math.min(GIT_CONCURRENCY_MAX, num))
}

/** Git 网络命令超时允许范围（秒，设置弹窗输入与 GitExecutor 钳位的单一数据源） */
export const NETWORK_TIMEOUT_MIN = 30
export const NETWORK_TIMEOUT_MAX = 600
/** 网络命令默认超时（秒）：大仓库弱网络 120s 偏短，默认放宽到 240s */
export const DEFAULT_NETWORK_TIMEOUT = 240

/** 将网络超时（秒）整数化并钳位到允许范围 */
export function clampNetworkTimeout(n: number): number {
  const num = Math.round(Number(n) || DEFAULT_NETWORK_TIMEOUT)
  return Math.max(NETWORK_TIMEOUT_MIN, Math.min(NETWORK_TIMEOUT_MAX, num))
}

/** 提交描述最短字数允许范围（设置弹窗输入与规则检查钳位的单一数据源） */
export const MIN_SUBJECT_LENGTH_MIN = 1
export const MIN_SUBJECT_LENGTH_MAX = 100

/** 将描述最短字数整数化并钳位到允许范围 */
export function clampMinSubjectLength(n: number): number {
  const num = Math.round(Number(n) || DEFAULT_COMMIT_RULE_CONFIG.minSubjectLength)
  return Math.max(MIN_SUBJECT_LENGTH_MIN, Math.min(MIN_SUBJECT_LENGTH_MAX, num))
}

/** 提交正文单行最大字符数允许范围（设置弹窗输入与规则检查钳位的单一数据源） */
export const BODY_LINE_LENGTH_MIN = 1
export const BODY_LINE_LENGTH_MAX = 500

/** 将正文单行最大字符数整数化并钳位到允许范围 */
export function clampMaxBodyLineLength(n: number): number {
  const num = Math.round(Number(n) || DEFAULT_COMMIT_RULE_CONFIG.maxBodyLineLength)
  return Math.max(BODY_LINE_LENGTH_MIN, Math.min(BODY_LINE_LENGTH_MAX, num))
}

/** AI 生成提交信息的 diff 上下文字符预算允许范围（设置弹窗输入钳位的单一数据源） */
export const DIFF_CONTEXT_BUDGET_MIN = 1000
export const DIFF_CONTEXT_BUDGET_MAX = 50000

/** 将 diff 上下文字符预算整数化并钳位到允许范围 */
export function clampDiffContextBudget(n: number): number {
  const num = Math.round(Number(n) || DEFAULT_COMMIT_RULE_CONFIG.diffContextBudget)
  return Math.max(DIFF_CONTEXT_BUDGET_MIN, Math.min(DIFF_CONTEXT_BUDGET_MAX, num))
}

/** 预设 IDE 条目（扫描结果与预设列表共用，useIdeManagement 持有） */
export interface IdeEntry {
  name: string
  icon: string
  cmds: string[]
  knownPaths: string[]
}

/** 自定义 IDE 条目（仅 name + 可执行路径，多路径按同名聚合） */
export interface CustomIde { name: string, path: string }

/** 项目映射条目 */
export interface GitProject {
  /** 唯一标识（时间戳生成） */
  id: string
  /** 项目名称 */
  name: string
  /** 项目绝对路径 */
  path: string
  /** 分类 ID（默认 UNGROUPED_ID） */
  categoryId: string
  /** GitHub 远程名称（自动检测） */
  githubRemote?: string
  /** GitHub 远程 URL */
  githubUrl?: string
  /** Gitee 远程名称（自动检测） */
  giteeRemote?: string
  /** Gitee 远程 URL */
  giteeUrl?: string
  /** Gitea 远程名称（自建实例，自动检测） */
  giteaRemote?: string
  /** Gitea 远程 URL */
  giteaUrl?: string
  /** CNB (cnb.cool) 远程名称（自动检测） */
  cnbRemote?: string
  /** CNB 远程 URL */
  cnbUrl?: string
  /** 添加时间 */
  addedAt: number
  /** 多标签（自由文本，用于横向聚合筛选） */
  tags?: string[]
  /** 收藏/置顶（排序优先级最高） */
  starred?: boolean
  /** 归档（默认隐藏，需 toggle 显示） */
  archived?: boolean
  /** 最后活动时间（ISO，由最近提交时间持久化，首屏直接读取展示） */
  lastActivity?: string
  /** 项目备注（编辑弹窗可填，展开面板可显示） */
  note?: string
  /** 多设备本地路径列表（不含主路径 path），用于跨电脑适配 */
  localPaths?: string[]
  /** 路径 → 设备电脑名映射（可选标注，键为路径原文；旧数据无此字段，向后兼容） */
  pathDevices?: Record<string, string>
}

/** 新增项目时的多设备路径附加信息（备选路径 + 设备名映射） */
export interface ProjectPathExtras {
  /** 备选本地路径（不含主路径） */
  localPaths?: string[]
  /** 路径 → 设备电脑名映射（仅保留非空标注） */
  pathDevices?: Record<string, string>
}

/** 代码统计报告结果缓存（持久化到 git-push-report-cache，进入视图秒开上次结果后由索引增量刷新替换） */
export interface ReportCacheEntry {
  /** 缓存对应的项目 id（与当前选中项目不一致时不展示，避免张冠李戴） */
  projectId: string
  /** 缓存对应的时间范围 */
  range: string
  /** 报告生成时间（ISO，即 report.generatedAt） */
  generatedAt: string
  /** 报告聚合数据（null = 尚未生成过，模型层零 i18n 快照） */
  report: CodeReportData | null
}

/** 项目分类 */
export interface ProjectCategory {
  id: string
  name: string
  color: string
  order: number
}

/** GitHub/Gitee/Gitea/CNB 远程信息 */
export interface GitRemoteInfo {
  /** 远程名称（如 origin, github, gitee） */
  name: string
  /** 远程 URL */
  url: string
  /** 是否是 GitHub */
  isGithub: boolean
  /** 是否是 Gitee */
  isGitee: boolean
  /** 是否是 Gitea（自建 Git 服务） */
  isGitea: boolean
  /** 是否是 CNB (cnb.cool) */
  isCnb: boolean
}

/** 单个远程的推送状态 */
export interface RemotePushStatus {
  /** 本地超前远程的提交数（需要推送） */
  ahead: number
  /** 本地落后远程的提交数（需要拉取） */
  behind: number
  /** 远程分支是否不存在（尚未推送过） */
  noUpstream: boolean
  /** 错误信息（如命令执行失败） */
  error?: string
}

/** 项目推送状态汇总 */
export interface PushStatusInfo {
  /** 当前分支名 */
  branch: string
  /** 各远程推送状态（key 为远程名，如 github/gitee） */
  remotes: Record<string, RemotePushStatus>
  /** 是否有任何远程需要推送（ahead > 0 或 noUpstream） */
  needsPush: boolean
}

/** Conventional Commit 类型常量（单一数据源） */
export const COMMIT_TYPE_VALUES = ["feat", "fix", "chore", "docs", "style", "refactor", "test"] as const
export type CommitType = typeof COMMIT_TYPE_VALUES[number]

/** 文件变更状态 */
export type FileChangeStatus = "modified" | "added" | "deleted" | "renamed" | "untracked" | "copied" | "unmerged"

/** 工作区单个文件变更 */
export interface FileChange {
  /** 文件路径（相对仓库根目录） */
  path: string
  /** 变更类型 */
  status: FileChangeStatus
  /** 是否已在暂存区（index） */
  staged: boolean
  /** 重命名前的路径（仅 status=renamed 时） */
  oldPath?: string
  /** 工作区侧是否也存在改动（porcelain Y 位）；与 staged 同时为 true 表示暂存区与工作区各有一份差异 */
  unstaged?: boolean
}

/** 工作区状态汇总 */
export interface WorkingTreeInfo {
  /** 当前分支 */
  branch: string
  /** 全部变更文件列表 */
  files: FileChange[]
  /** 已暂存文件数 */
  stagedCount: number
  /** 未暂存文件数 */
  unstagedCount: number
  /** 未跟踪文件数 */
  untrackedCount: number
  /** 是否有任何变更 */
  hasChanges: boolean
}

/** 提交历史单条记录 */
export interface CommitLogEntry {
  /** 短 hash（7 位） */
  hash: string
  /** 提交信息 */
  message: string
  /** 作者 */
  author: string
  /** 相对时间（如 "3 hours ago"） */
  relativeDate: string
  /** 绝对时间（ISO 格式） */
  date: string
  /** 是否 merge 提交（父提交数 > 1；规则检查豁免、修正弹窗阻止） */
  isMerge: boolean
}

/**
 * 单条提交的变更规模统计（git log --shortstat 派生，供 LOG Tab 行悬停提示展示）。
 * 注意：这是「该提交本身的改动量」——merge 提交按 git 约定不计入（无 shortstat 行），
 * 根提交正常统计；deltas 为 0 与「无统计」两种情形由 UI 区分（后者不展示提示）。
 */
export interface CommitStat {
  /** 变更文件数 */
  files: number
  /** 新增行数 */
  insertions: number
  /** 删除行数 */
  deletions: number
}

/** 分支信息 */
export interface BranchInfo {
  /** 分支名（短名称） */
  name: string
  /** 是否为当前分支 */
  current: boolean
}

/** 扫描到的 Git 仓库 */
export interface ScannedGitRepo {
  /** 目录名（用作项目名） */
  name: string
  /** 完整路径 */
  path: string
}

/** Stash 条目 */
export interface StashEntry {
  /** 序号（0=最近） */
  index: number
  /** 描述信息 */
  message: string
}

/** Tag 信息 */
export interface TagInfo {
  /** Tag 名称 */
  name: string
  /** 注解信息（annotated tag） */
  message?: string
  /** 创建日期（ISO） */
  date?: string
  /** Tag 指向的 commit hash（annotated tag 为解引用后的 commit，lightweight tag 即 object 本身） */
  hash?: string
}

/** 冲突文件信息 */
export interface ConflictFile {
  path: string
  status: "both-modified" | "added-by-us" | "added-by-them" | "deleted-by-us" | "deleted-by-them"
}

// ── Git 操作日志（持久化追查推送/拉取/提交历史）──

/** 操作类型 */
export type GitOpAction = "push" | "pull" | "commit"

/** 推送/拉取单平台结构化输出（useRemoteProgress 产出，卡片 OutputPanel 消费） */
export interface PushOutputEntry {
  platform: PlatformKey
  label: string
  ok: boolean
  skipped: boolean
  duration: number
  summary: string
  fullStdout: string
  fullStderr: string
}

/** 操作日志单平台结果（PushOutputEntry 的精简投影，不存 fullStdout/fullStderr 防撑爆存储） */
export interface GitOpLogPlatform {
  key: string
  label: string
  ok: boolean
  skipped: boolean
  summary: string
}

/** 操作日志条目 */
export interface GitOpLogEntry {
  id: string
  /** ISO 时间戳 */
  time: string
  /** 项目 ID */
  projectId: string
  /** 项目名称（存储时不实时反查，打点方传入快照） */
  projectName: string
  /** 操作类型 */
  action: GitOpAction
  /** 整体成功/失败 */
  ok: boolean
  /** 摘要（第一行输出或错误消息） */
  summary: string
  /** commit 信息（仅 action=commit 时有值） */
  message?: string
  /** 逐平台结果（仅 push/pull 时有值） */
  platforms?: GitOpLogPlatform[]
}

/** 操作日志环形上限 */
export const MAX_OP_LOG_COUNT = 300

// ── 提交信息模板 ──

/** 提价信息模板 */
export interface CommitTemplate {
  id: string
  name: string
  pattern: string // 支持占位符 {branch} / {files}
  builtin?: boolean
}

const DEFAULT_TEMPLATES: CommitTemplate[] = [
  {
    id: "tpl-feat",
    name: "新功能",
    pattern: "feat: ",
    builtin: true,
  },
  {
    id: "tpl-fix",
    name: "修复",
    pattern: "fix: ",
    builtin: true,
  },
  {
    id: "tpl-chore",
    name: "杂项",
    pattern: "chore: ",
    builtin: true,
  },
  {
    id: "tpl-refactor",
    name: "重构",
    pattern: "refactor: ",
    builtin: true,
  },
  {
    id: "tpl-docs",
    name: "文档",
    pattern: "docs: ",
    builtin: true,
  },
]

const DEFAULT_PROJECTS: GitProject[] = []

/** 提交分析缓存默认值（entries 为空即视为未分析过） */
const DEFAULT_ANALYSIS_CACHE: CommitAnalysisCache = {
  commitCount: 100,
  analyzedAt: "",
  failedCount: 0,
  entries: [],
  projectLineRanking: [],
}

/** 行数统计独立缓存默认值（与提交分析缓存解耦，空排行即视为未分析过） */
const DEFAULT_LINE_STATS_CACHE: LineStatsCache = {
  analyzedAt: "",
  failedCount: 0,
  projectLineRanking: [],
  selectedExtensions: [],
}

/** 提交分析显示设置默认值（热力图 + 最近一年 + 周一起始 + GitHub 绿） */
export const DEFAULT_ANALYSIS_VIEW_SETTINGS: CommitAnalysisViewSettings = {
  view: "heatmap",
  range: "lastYear",
  weekStart: 1,
  color: "#2ea44f",
}

/** 提交规则检查偏好默认值（默认过滤全部项目 + 规则配置全默认：过短阈值 10 字 + 可选规则全开） */
const DEFAULT_RULE_CHECK_PREFS: RuleCheckPrefs = { projectId: "", ...DEFAULT_COMMIT_RULE_CONFIG }

/** 提交信息修正偏好默认值（默认保留原始提交时间） */
const DEFAULT_COMMIT_FIX_PREFS: CommitFixPrefs = { preserveDate: true }

/** 删除历史提交偏好默认值（默认删除前自动备份，保持安全行为） */
const DEFAULT_DROP_COMMIT_PREFS: DropCommitPrefs = { autoBackup: true }

/** 仓库清理视图偏好默认值（默认取第一个项目 + 10MB 阈值） */
const DEFAULT_REPO_CLEAN_PREFS: RepoCleanPrefs = { projectId: "", thresholdMb: 10 }

/** BFG 运行时路径覆盖默认值（空 = 自动探测 java + 默认缓存 jar） */
const DEFAULT_BFG_PREFS: BfgPrefs = { javaPath: "", jarPath: "" }

/** 代码统计报告结果缓存默认值（无缓存时按 null 语义处理，见 useCodeReport） */
const DEFAULT_REPORT_CACHE: ReportCacheEntry = { projectId: "", range: "6m", generatedAt: "", report: null }

const DEFAULT_UNGROUPED: ProjectCategory = {
  id: UNGROUPED_ID,
  name: "未分组",
  color: "#888888",
  order: 0,
}

export class GitPushStorage {
  readonly projects: TypedStorage<GitProject[]>
  readonly categories: TypedStorage<ProjectCategory[]>
  readonly gitConcurrency: TypedStorage<number>
  /** 网络命令超时（秒，GitExecutor 加载后转换为毫秒生效；默认 240s） */
  readonly networkTimeout: TypedStorage<number>
  /** 全局标签缓存（所有用过的标签，用于筛选条与输入建议） */
  readonly tags: TypedStorage<string[]>
  /** 提交信息模板 */
  readonly commitTemplates: TypedStorage<CommitTemplate[]>
  /** git 操作暂停状态（持久化） */
  readonly gitOpsPaused: TypedStorage<boolean>
  /** 是否显示已归档项目（持久化） */
  readonly showArchived: TypedStorage<boolean>
  /** 推送分支模式：all=全部分支, head=仅当前分支（持久化） */
  readonly pushBranchMode: TypedStorage<"all" | "head">
  /** 操作日志（环形上限 300 条，防抖落盘） */
  readonly opLogs: TypedStorage<GitOpLogEntry[]>
  /** 提交分析结果缓存（跨会话复用，进入分析视图直接展示上次结果，手动重新分析后更新） */
  readonly commitAnalysisCache: TypedStorage<CommitAnalysisCache>
  /** 行数统计独立缓存（与提交分析缓存解耦，进入行数统计视图直接复用上次结果） */
  readonly lineStatsCache: TypedStorage<LineStatsCache>
  /** 提交分析显示设置（热力图/日历视图、显示范围、每周第一天、格子主色） */
  readonly commitAnalysisView: TypedStorage<CommitAnalysisViewSettings>
  /** 代码统计报告偏好（上次选中项目 + 时间范围，进入视图恢复选择） */
  readonly reportPrefs: TypedStorage<CodeReportPrefs>
  /** 远程与本地一致性分析结果缓存（跨会话复用，打开弹窗直接展示上次结果） */
  readonly consistencyCache: TypedStorage<ConsistencyCache>
  /** 提交规则检查偏好（上次选中的过滤项目，跨会话恢复选择） */
  readonly ruleCheckPrefs: TypedStorage<RuleCheckPrefs>
  /** 提交信息修正偏好（上次选择的提交时间策略，跨会话恢复选择） */
  readonly commitFixPrefs: TypedStorage<CommitFixPrefs>
  /**
   * 并发数默认值一次性迁移标记（见 GIT_CONCURRENCY_MIGRATION_VERSION）。
   * 存在即表示迁移已跑过；**默认 0 = 未迁移**。
   */
  readonly gitConcurrencyMigration: TypedStorage<number>
  /** 删除历史提交偏好（是否删除前自动备份，跨会话恢复选择） */
  readonly dropCommitPrefs: TypedStorage<DropCommitPrefs>
  /** 仓库清理视图偏好（上次选中项目 + 大文件阈值，跨会话恢复选择） */
  readonly repoCleanPrefs: TypedStorage<RepoCleanPrefs>
  /** BFG 运行时路径覆盖（自定义 java / jar 路径，空 = 自动） */
  readonly bfgPrefs: TypedStorage<BfgPrefs>
  /** 代码统计报告结果缓存（进度视图秒开上次结果；数据新鲜度由本地提交索引的后台增量刷新保证） */
  readonly reportCache: TypedStorage<ReportCacheEntry>
  /** 本地提交索引元数据（每项目仓库身份/HEAD 判据与截断游标；大体积提交数据在插件数据目录的 NDJSON 中） */
  readonly indexMeta: TypedStorage<IndexMeta>
  /** 本地提交索引总开关（关闭后全部统计路径回退到直接跑 git，作为最终安全阀） */
  readonly indexEnabled: TypedStorage<boolean>
  /** 单项目索引提交条数上限（超出即标记截断并提示重建） */
  readonly indexMaxCommits: TypedStorage<number>
  /** 上次扫描导入使用的目录（下次打开弹窗预填，避免重复选择同一根目录） */
  readonly scanDir: TypedStorage<string>
  /** 实时探测配置（文件监听 / 工作区轮询 / 网络轮询三层，持久化） */
  readonly probeConfig: TypedStorage<ProbeConfig>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.projects = new TypedStorage(storage, "git-push-projects", DEFAULT_PROJECTS)
    this.categories = new TypedStorage(storage, "git-push-categories", [DEFAULT_UNGROUPED])
    this.gitConcurrency = new TypedStorage(storage, "git-push-concurrency", DEFAULT_GIT_CONCURRENCY)
    // 默认 0 = 未迁移（迁移完成后写入 GIT_CONCURRENCY_MIGRATION_VERSION）
    this.gitConcurrencyMigration = new TypedStorage(storage, "git-push-concurrency-migration", 0)
    this.networkTimeout = new TypedStorage(storage, "git-push-network-timeout", DEFAULT_NETWORK_TIMEOUT)
    this.tags = new TypedStorage(storage, "git-push-tags", [])
    this.commitTemplates = new TypedStorage(storage, "git-push-commit-templates", DEFAULT_TEMPLATES)
    this.gitOpsPaused = new TypedStorage(storage, "git-push-ops-paused", false)
    this.showArchived = new TypedStorage(storage, "git-push-show-archived", false)
    this.pushBranchMode = new TypedStorage<"all" | "head">(storage, "git-push-branch-mode", "all")
    this.opLogs = new TypedStorage(storage, "git-push-op-logs", [])
    this.commitAnalysisCache = new TypedStorage(storage, "git-push-analysis-cache", DEFAULT_ANALYSIS_CACHE)
    this.lineStatsCache = new TypedStorage(storage, "git-push-line-stats-cache", DEFAULT_LINE_STATS_CACHE)
    this.commitAnalysisView = new TypedStorage(storage, "git-push-analysis-view", DEFAULT_ANALYSIS_VIEW_SETTINGS)
    this.reportPrefs = new TypedStorage(storage, "git-push-report-prefs", DEFAULT_REPORT_PREFS)
    this.consistencyCache = new TypedStorage(storage, "git-push-consistency-cache", EMPTY_CONSISTENCY_CACHE)
    this.ruleCheckPrefs = new TypedStorage(storage, "git-push-rulecheck-prefs", DEFAULT_RULE_CHECK_PREFS)
    this.commitFixPrefs = new TypedStorage(storage, "git-push-commitfix-prefs", DEFAULT_COMMIT_FIX_PREFS)
    this.dropCommitPrefs = new TypedStorage(storage, "git-push-dropcommit-prefs", DEFAULT_DROP_COMMIT_PREFS)
    this.repoCleanPrefs = new TypedStorage(storage, "git-push-repoclean-prefs", DEFAULT_REPO_CLEAN_PREFS)
    this.bfgPrefs = new TypedStorage(storage, "git-push-bfg-prefs", DEFAULT_BFG_PREFS)
    this.reportCache = new TypedStorage(storage, "git-push-report-cache", DEFAULT_REPORT_CACHE)
    this.indexMeta = new TypedStorage(storage, "git-push-index-meta", DEFAULT_INDEX_META)
    this.indexEnabled = new TypedStorage(storage, "git-push-index-enabled", true)
    this.indexMaxCommits = new TypedStorage(storage, "git-push-index-max-commits", DEFAULT_INDEX_MAX_COMMITS)
    this.scanDir = new TypedStorage(storage, "git-push-scan-dir", "")
    this.probeConfig = new TypedStorage(storage, "git-push-probe-config", DEFAULT_PROBE_CONFIG)
  }

  async init(): Promise<void> {
    const cats = await this.categories.loadOrDefault()
    // 确保默认分类始终存在
    if (!cats.some((c) => c.id === UNGROUPED_ID)) {
      cats.unshift(DEFAULT_UNGROUPED)
      await this.categories.save(cats)
    }
    // 迁移旧项目：补 categoryId
    const projs = await this.projects.loadOrDefault()
    let needsSave = false
    for (const p of projs) {
      if (!p.categoryId) {
        p.categoryId = UNGROUPED_ID
        needsSave = true
      }
    }
    if (needsSave) await this.projects.save(projs)
    // 一次性迁移：并发数默认值 3 → 10
    await this.migrateGitConcurrency()
  }

  /**
   * 一次性迁移：把「旧默认并发 3」提升到新默认 10。
   *
   * 为什么需要迁移而不是直接改默认值：`loadOrDefault()` 是**已保存值优先**，
   * 老用户存储里若已有 3，改默认值对他们完全无效。但也不能无脑覆盖——
   * 「用户主动设成 3」与「从没设置过」在存储里都表现为数字 3。
   *
   * 判定策略（保守，只动「确定没被用户碰过」的情况）：
   * 1. 标记已存在 → 直接返回（幂等；用户之后手动改回 3 也不会再被改）
   * 2. 并发键**从未写入**（`load()` 返回 null）→ 无需迁移，新默认值自然生效，
   *    只写标记以便下次短路（覆盖「新装用户」与「从没进过设置面板的老用户」）
   * 3. 并发键存在且值等于旧默认 3 → 视为「沿用历史默认、从未自定义」，升到 10
   * 4. 其他任何值（用户主动选过 6/8 等，或已是 10）→ 保留原值，只写标记
   *
   * 已知局限：无法识别「用户主动选了 3」这一种情况（会被当成沿用默认而升到 10）。
   * 这是有意的取舍——3 恰是历史默认值，主动选它的概率远低于从未改过；
   * 且无论结果如何，用户之后仍可在设置面板改回，不会反复弹回（标记已落盘）。
   */
  private async migrateGitConcurrency(): Promise<void> {
    const done = await this.gitConcurrencyMigration.loadOrDefault()
    // 已迁移过：不覆盖用户的任何后续选择
    if (done >= GIT_CONCURRENCY_MIGRATION_VERSION) return

    // 关键：必须区分「键不存在」与「读取失败」。
    //
    // PluginStorage.load() 在**读取异常**时也返回 null，与「键不存在」无法区分。
    // 若把异常当成「从未设置」并落标记，而存储里其实还躺着旧默认 3，
    // 这次迁移就被永久跳过 —— 用户再也享受不到提升，且没有任何报错。
    // 故用 loadSafe()（返回判别联合）：读取失败时**不落标记**，下次启动重试。
    const probe = await this.gitConcurrency.loadSafe()
    if (!probe.ok) {
      console.warn("[gitPush] 并发数读取失败，本次跳过默认值迁移（下次启动重试）")
      return
    }
    const saved = probe.value
    if (saved === null) {
      // 键确实不存在：从未设置过，新默认值已生效，只落标记
      await this.gitConcurrencyMigration.save(GIT_CONCURRENCY_MIGRATION_VERSION)
      return
    }

    const num = typeof saved === "number" ? saved : Number(saved)
    // 非有限数（NaN/Infinity）视为数据损坏：既不提升也不落标记，下次启动重试。
    // 为什么必须拦：`Number({})` / `Number("abc")` 得到 NaN，若直接落标记，
    // 这个项目就永久停在「已迁移」状态且值从未被修正。
    if (!Number.isFinite(num)) {
      console.warn("[gitPush] 并发数存储值无效，本次跳过默认值迁移（下次启动重试）")
      return
    }
    // 仅当仍是历史默认值时才提升；其余值视为用户自定义，原样保留
    if (num === LEGACY_GIT_CONCURRENCY) {
      // 必须检查写入结果：PluginStorage.save() **失败时不抛错、只返回 false**。
      // 若忽略返回值继续落标记，会出现「值为 3 + 标记说已迁移」的永久不一致——
      // 正是本迁移要避免的失效模式。
      const written = await this.gitConcurrency.save(DEFAULT_GIT_CONCURRENCY)
      if (!written) {
        console.warn("[gitPush] 并发数升级写入失败，本次不落迁移标记（下次启动重试）")
        return
      }
      console.info(
        `[gitPush] 并发数默认值已从 ${LEGACY_GIT_CONCURRENCY} 升级到 ${DEFAULT_GIT_CONCURRENCY}`
        + `（实测分析速度提升约 39%）；如不满意可在设置面板调整。`,
      )
    }
    // 标记写入失败无妨：下次会重跑，此时值已非 3（或本就非 3），迁移天然幂等
    await this.gitConcurrencyMigration.save(GIT_CONCURRENCY_MIGRATION_VERSION)
  }
}
