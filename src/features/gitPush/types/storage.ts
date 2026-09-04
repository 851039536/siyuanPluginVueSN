// Git 项目持久化存储与类型定义
import type { Plugin } from "siyuan"
import type { CommitAnalysisCache, CommitAnalysisViewSettings, CommitFixPrefs, LineStatsCache, PlatformKey, RuleCheckPrefs } from "./meta"
import type { ConsistencyCache } from "./consistency"
import { EMPTY_CONSISTENCY_CACHE } from "./consistency"
import type { CodeReportPrefs } from "./report"
import { DEFAULT_REPORT_PREFS } from "./report"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 未分组分类的 ID（魔法字符串收敛为单一常量） */
export const UNGROUPED_ID = "__ungrouped__"

/** Git 并发数允许范围（设置弹窗输入与 GitExecutor 钳位的单一数据源） */
export const GIT_CONCURRENCY_MIN = 1
export const GIT_CONCURRENCY_MAX = 10

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
  authorLineRanking: [],
}

/** 行数统计独立缓存默认值（与提交分析缓存解耦，空排行即视为未分析过） */
const DEFAULT_LINE_STATS_CACHE: LineStatsCache = {
  commitCount: 100,
  analyzedAt: "",
  failedCount: 0,
  projectLineRanking: [],
  authorLineRanking: [],
  selectedExtensions: [],
}

/** 提交分析显示设置默认值（热力图 + 最近一年 + 周一起始 + GitHub 绿） */
export const DEFAULT_ANALYSIS_VIEW_SETTINGS: CommitAnalysisViewSettings = {
  view: "heatmap",
  range: "lastYear",
  weekStart: 1,
  color: "#2ea44f",
}

/** 提交规则检查偏好默认值（默认过滤全部项目） */
const DEFAULT_RULE_CHECK_PREFS: RuleCheckPrefs = { projectId: "" }

/** 提交信息修正偏好默认值（默认保留原始提交时间） */
const DEFAULT_COMMIT_FIX_PREFS: CommitFixPrefs = { preserveDate: true }

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

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.projects = new TypedStorage(storage, "git-push-projects", DEFAULT_PROJECTS)
    this.categories = new TypedStorage(storage, "git-push-categories", [DEFAULT_UNGROUPED])
    this.gitConcurrency = new TypedStorage(storage, "git-push-concurrency", 3)
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
  }
}
