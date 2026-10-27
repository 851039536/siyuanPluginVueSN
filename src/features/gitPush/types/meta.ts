// gitPush 平台、状态、文件变更的元数据常量（独立模块，切断 types/index ↔ GitPushManager 循环引用）
import type { FileChangeStatus, GitProject } from "./storage"

// ── 远程平台元数据（共享常量）──
export const PLATFORM_META = [
  {
    key: "github" as const,
    icon: "mdi:github",
    label: "GitHub",
    remoteProp: "githubRemote" as const,
    urlProp: "githubUrl" as const,
    webUrl: "https://github.com",
  },
  {
    key: "gitee" as const,
    icon: "mdi:git",
    label: "Gitee",
    remoteProp: "giteeRemote" as const,
    urlProp: "giteeUrl" as const,
    webUrl: "https://gitee.com",
  },
  {
    key: "gitea" as const,
    icon: "mdi:tea",
    label: "Gitea",
    remoteProp: "giteaRemote" as const,
    urlProp: "giteaUrl" as const,
    webUrl: "https://about.gitea.com",
  },
  {
    key: "cnb" as const,
    icon: "mdi:cloud-braces",
    label: "CNB",
    remoteProp: "cnbRemote" as const,
    urlProp: "cnbUrl" as const,
    webUrl: "https://cnb.cool",
  },
]

export type PlatformKey = typeof PLATFORM_META[number]["key"]

// ── 文件变更状态元数据（icon + 文案键；模块层零文案，文案由视图层经 utils 的 fileStatusText 解析）──
export const FILE_STATUS_META: Record<FileChangeStatus, { icon: string, titleKey: string }> = {
  modified: { icon: "~", titleKey: "fileStatusModified" },
  added: { icon: "+", titleKey: "fileStatusAdded" },
  deleted: { icon: "−", titleKey: "fileStatusDeleted" },
  renamed: { icon: "forward", titleKey: "fileStatusRenamed" },
  untracked: { icon: "?", titleKey: "fileStatusUntracked" },
  copied: { icon: "⇋", titleKey: "fileStatusCopied" },
  unmerged: { icon: "warning", titleKey: "fileStatusUnmerged" },
}

// ── 远程平台精简视图（PLATFORM_META 投影，供卡片 + 状态栏使用）──
export const REMOTES = PLATFORM_META.map((pm) => ({
  key: pm.key,
  icon: pm.icon,
  label: pm.label,
  remoteProp: pm.remoteProp,
}))

// ── 统计视图类型（useGitStats 产出 / StatsPanel 消费的共享形状）──
/** 远程覆盖率统计 */
export interface RemoteCoverage {
  github: number
  gitee: number
  gitea: number
  cnb: number
  hasRemote: number
  multiple: number
}

/** 推送状态统计 */
export interface PushStatusStats {
  ahead: number
  behind: number
  synced: number
  noRemote: number
}

/** 需要推送的项目项 */
export interface NeedsPushItem {
  project: GitProject
  aheadByRemote: { key: string, ahead: number }[]
  totalAhead: number
}

/** 有未提交变更的项目项 */
export interface UncommittedItem {
  project: GitProject
  staged: number
  unstaged: number
  untracked: number
}

/** 需要拉取的项目项 */
export interface NeedsPullItem {
  project: GitProject
  behindByRemote: { key: string, behind: number }[]
  totalBehind: number
}

/** 待处理项目（需要推送 + 需要拉取 + 有未提交变更 的合并视图） */
export interface PendingProjectItem {
  project: GitProject
  aheadByRemote: { key: string, ahead: number }[]
  totalAhead: number
  behindByRemote: { key: string, behind: number }[]
  totalBehind: number
  staged: number
  unstaged: number
  untracked: number
}

/** 平台配置状态明细项 */
export interface PlatformStatusItem {
  /** 仅引用 id/name/path，避免完整 GitProject 导致类型依赖链循环 */
  project: Pick<GitProject, "id" | "name" | "path">
  github: boolean
  gitee: boolean
  gitea: boolean
  cnb: boolean
  missingCount: number
}

// ── 仓库链接一致性校验（useRepoLinkAudit 产出 / 平台配置状态卡片消费）──
/** 单平台比对状态：一致 / 不一致 / 仅配置链接 / 仅存在远程 / 两者皆无 */
export type RepoLinkAuditState = "match" | "mismatch" | "linkOnly" | "remoteOnly" | "none"

/** 单项目单平台的校验单元格（link/remoteUrl 保留原文供 tooltip 排错） */
export interface RepoLinkAuditCell {
  key: PlatformKey
  state: RepoLinkAuditState
  /** 手动配置的仓库链接原文（未配置为空串） */
  link: string
  /** 实际检测到的远程 URL 原文（无该平台远程为空串） */
  remoteUrl: string
}

/** 单项目校验行 */
export interface RepoLinkAuditRow {
  id: string
  name: string
  path: string
  /** 路径无效或 git 检测失败 */
  error: boolean
  cells: RepoLinkAuditCell[]
  /** 存在 mismatch/linkOnly/remoteOnly 或 error */
  hasIssue: boolean
}

// ── 统计视图平台矩阵表格视图模型（PlatformSection 消费）──
/** 平台单元格视图（icon 为空串时渲染占位符 -） */
export interface PlatformTableCellView {
  key: string
  /** hover 提示原文（状态名 / 链接与远程 URL 原文等，由调用方预计算） */
  title: string
  /** 图标名（空串 = 渲染占位符 -） */
  icon: string
  /** 图标颜色修饰类（如 gps-platform-ok / gps-audit-mismatch） */
  iconCls?: string
}

/** 平台矩阵表格行视图（项目名 + 平台单元格序列） */
export interface PlatformTableRowView {
  id: string
  name: string
  path: string
  /** 名称后缀标注（审计"路径无效或检测失败"；空串不渲染） */
  nameSuffix?: string
  cells: PlatformTableCellView[]
}

/** 统计面板聚合视图（单对象 prop，消除 useGitStats → useGitPush → index.vue → StatsPanel 四层透传的字段遗漏风险） */
export interface StatsView {
  projectCount: number
  remoteCoverage: RemoteCoverage
  pushStatusStats: PushStatusStats
  /** 待处理项目（已在 useGitStats 中合并排序） */
  pendingProjects: PendingProjectItem[]
  /** 有未提交变更的项目数（仅供总览卡片展示） */
  uncommittedCount: number
  /** 收藏项目数（总览卡片） */
  starredCount: number
  /** 已归档项目数（总览卡片） */
  archivedCount: number
  /** 平台配置状态明细（每个项目的 GitHub/Gitee/Gitea/CNB 是否已配置） */
  platformStatusProjects: PlatformStatusItem[]
}

/** 面板头部视图（列表/统计/操作日志/提交分析/统计报告/仓库清理）。
 * 规则检查与行数排行已合并为「提交分析」视图的内部 Tab（三者同属一次 git 抓取的不同切面），故不再是独立面板视图。
 * 与 ViewMode（列表内筛选模式 all/needsPush/...）语义不同 */
export type PanelView = "list" | "stats" | "log" | "analysis" | "report" | "repoclean"

// ── 提交分析视图（useCommitAnalysis 产出 / CommitAnalysisPanel 消费）──

/** 单条提交分析条目（跨项目合并的提交流最小形状） */
export interface CommitAnalysisEntry {
  projectId: string
  projectName: string
  /** 完整 hash（40 位，与 CommitLogEntry.hash 同口径；列表短展示由 UI 层截取） */
  hash: string
  message: string
  author: string
  /** ISO 时间戳（git %aI 输出，new Date 可直接解析） */
  date: string
  /** 是否 merge 提交（父提交数 > 1；规则检查豁免，不判违规） */
  isMerge?: boolean
}

/** Conventional Commits 类型（提交内容分析分类，other 兜底无前缀提交；与 storage.ts 的 CommitType 提交模板类型语义不同） */
export type CommitAnalysisType =
  | "feat" | "fix" | "docs" | "refactor" | "perf" | "style"
  | "test" | "build" | "ci" | "chore" | "other"

/** 提交类型元数据（labelKey 对应 i18n 键 commitTypeFeat 等；提交类型按钮与规则提示共用同一份文案口径） */
export const COMMIT_ANALYSIS_TYPE_META: Record<CommitAnalysisType, { labelKey: string }> = {
  feat: { labelKey: "commitTypeFeat" },
  fix: { labelKey: "commitTypeFix" },
  docs: { labelKey: "commitTypeDocs" },
  refactor: { labelKey: "commitTypeRefactor" },
  perf: { labelKey: "commitTypePerf" },
  style: { labelKey: "commitTypeStyle" },
  test: { labelKey: "commitTypeTest" },
  build: { labelKey: "commitTypeBuild" },
  ci: { labelKey: "commitTypeCi" },
  chore: { labelKey: "commitTypeChore" },
  other: { labelKey: "commitTypeOther" },
}

// ── 提交规则检查（useCommitAnalysis 产出 / CommitRuleCheckPanel 消费）──

/** 提交信息不合规原因（Conventional Commits 规则 + GitHub 建议，type 限 COMMIT_TYPE_VALUES 中的值） */
export type CommitRuleReasonKey =
  | "whitespace"
  | "missingType"
  | "invalidType"
  | "invalidScope"
  | "invalidScopeFormat"
  | "badSeparator"
  | "emptySubject"
  | "notChinese"
  | "subjectEndsWithPeriod"
  | "subjectTooShort"
  | "missingBlankLine"
  | "subjectNotCapitalized"
  | "wipSubject"
  | "bodyLineTooLong"

/**
 * 提交规则原因元数据。
 * labelKey = 简短标签（表格/徽章内展示，如"scope 格式非法"）；
 * descKey = 一句话说明（悬停提示，讲清"为什么判违规 + 怎么改"，如"scope 仅允许小写字母、数字、连字符"）。
 */
export const COMMIT_RULE_REASON_META: Record<CommitRuleReasonKey, { labelKey: string, descKey: string }> = {
  whitespace: { labelKey: "ruleCheckReasonWhitespace", descKey: "ruleCheckReasonWhitespaceDesc" },
  missingType: { labelKey: "ruleCheckReasonMissingType", descKey: "ruleCheckReasonMissingTypeDesc" },
  invalidType: { labelKey: "ruleCheckReasonInvalidType", descKey: "ruleCheckReasonInvalidTypeDesc" },
  invalidScope: { labelKey: "ruleCheckReasonInvalidScope", descKey: "ruleCheckReasonInvalidScopeDesc" },
  invalidScopeFormat: { labelKey: "ruleCheckReasonInvalidScopeFormat", descKey: "ruleCheckReasonInvalidScopeFormatDesc" },
  badSeparator: { labelKey: "ruleCheckReasonBadSeparator", descKey: "ruleCheckReasonBadSeparatorDesc" },
  emptySubject: { labelKey: "ruleCheckReasonEmptySubject", descKey: "ruleCheckReasonEmptySubjectDesc" },
  notChinese: { labelKey: "ruleCheckReasonNotChinese", descKey: "ruleCheckReasonNotChineseDesc" },
  subjectEndsWithPeriod: { labelKey: "ruleCheckReasonEndsWithPeriod", descKey: "ruleCheckReasonEndsWithPeriodDesc" },
  subjectTooShort: { labelKey: "ruleCheckReasonSubjectTooShort", descKey: "ruleCheckReasonSubjectTooShortDesc" },
  missingBlankLine: { labelKey: "ruleCheckReasonMissingBlankLine", descKey: "ruleCheckReasonMissingBlankLineDesc" },
  subjectNotCapitalized: { labelKey: "ruleCheckReasonNotCapitalized", descKey: "ruleCheckReasonNotCapitalizedDesc" },
  wipSubject: { labelKey: "ruleCheckReasonWipSubject", descKey: "ruleCheckReasonWipSubjectDesc" },
  bodyLineTooLong: { labelKey: "ruleCheckReasonBodyLineTooLong", descKey: "ruleCheckReasonBodyLineTooLongDesc" },
}

/** 提交规则可配置项（规则引擎纯函数的显式配置注入，不依赖模块级状态） */
export interface CommitRuleConfig {
  /** 描述最短字数（冒号后 subject 少于此值判违规；设置弹窗可自定义） */
  minSubjectLength: number
  /** 可选规则：描述首字母大写（仅描述以小写英文字母开头判违规，中文开头天然合规） */
  requireCapitalizedSubject: boolean
  /** 可选规则：WIP 临时提交检测（描述以 wip/todo/fixme/tbd 开头判违规） */
  detectWipSubject: boolean
  /**
   * 可选规则：scope 格式校验（scope 仅允许小写字母、数字、连字符，如 `hid-helper`）。
   * 关闭后任意 scope 写法（含大写、下划线、中文、带点/斜杠）均不判违规——仅保留"scope 为空"的校验。
   * 默认关闭：该规则偏严格（`feat(HidHelper)` 这类驼峰写法很常见），交由用户按团队习惯自行开启。
   * 详细说明见 i18n 键 ruleCheckOptScopeFormatHint（设置项下方提示）。
   */
  scopeFormatEnabled: boolean
  /** 可选规则：正文行长限制开关（多行消息 body 每行超限判违规） */
  bodyLineLimitEnabled: boolean
  /** 正文单行最大字符数（bodyLineLimitEnabled 开启时生效） */
  maxBodyLineLength: number
  /** AI 生成提交信息时送入的 diff 上下文字符预算（按文件分块分配，设置弹窗可自定义） */
  diffContextBudget: number
}

/** 提交规则默认配置（描述过短阈值 10 字 + 可选规则默认值 + diff 上下文预算 10000 字符） */
export const DEFAULT_COMMIT_RULE_CONFIG: CommitRuleConfig = {
  minSubjectLength: 10,
  requireCapitalizedSubject: true,
  detectWipSubject: true,
  // scope 格式校验默认关闭：`feat(HidHelper)` / `feat(用户模块)` 等写法普遍且无害，
  // 默认开启会把大量正常提交判为违规（用户反馈"scope 格式非法"即源于此），故改为按需开启
  scopeFormatEnabled: false,
  bodyLineLimitEnabled: true,
  maxBodyLineLength: 72,
  diffContextBudget: 10000,
}

/** 从规则检查偏好读取规则配置（旧数据缺字段时逐字段回退默认值） */
export function readCommitRuleConfig(prefs: RuleCheckPrefs): CommitRuleConfig {
  return {
    minSubjectLength: prefs.minSubjectLength ?? DEFAULT_COMMIT_RULE_CONFIG.minSubjectLength,
    requireCapitalizedSubject: prefs.requireCapitalizedSubject ?? DEFAULT_COMMIT_RULE_CONFIG.requireCapitalizedSubject,
    detectWipSubject: prefs.detectWipSubject ?? DEFAULT_COMMIT_RULE_CONFIG.detectWipSubject,
    scopeFormatEnabled: prefs.scopeFormatEnabled ?? DEFAULT_COMMIT_RULE_CONFIG.scopeFormatEnabled,
    bodyLineLimitEnabled: prefs.bodyLineLimitEnabled ?? DEFAULT_COMMIT_RULE_CONFIG.bodyLineLimitEnabled,
    maxBodyLineLength: prefs.maxBodyLineLength ?? DEFAULT_COMMIT_RULE_CONFIG.maxBodyLineLength,
    diffContextBudget: prefs.diffContextBudget ?? DEFAULT_COMMIT_RULE_CONFIG.diffContextBudget,
  }
}

/** 单条不合规提交（提交信息 + 命中原因） */
export interface CommitRuleViolation extends CommitAnalysisEntry {
  /** 不合规原因 */
  reason: CommitRuleReasonKey
}

/** 提交信息修正目标（规则检查违规项与提交日志条目共用，reason 仅规则检查场景提供） */
export type CommitFixTarget = Pick<CommitAnalysisEntry, "projectId" | "projectName" | "hash" | "message"> & {
  /** 违规原因（提交日志场景无此字段） */
  reason?: CommitRuleReasonKey
  /** 是否 merge 提交（修正弹窗据此阻止保存；来自提交日志的 merge 提交仍可打开查看但不可修正） */
  isMerge?: boolean
}

/** 提交规则检查聚合统计（含违规列表，供提交规则检查面板消费） */
export interface CommitRuleCheckStats {
  /** 检查的提交总数 */
  totalCommits: number
  /** 不合规提交数 */
  violationCount: number
  /** 合规提交数 */
  compliantCount: number
  /** 各原因计数（降序） */
  byReason: { reason: CommitRuleReasonKey, count: number }[]
  /** 不合规提交列表（按日期降序） */
  violations: CommitRuleViolation[]
}

/** 提交规则检查偏好（上次选中的过滤项目 + 规则配置，持久化到 git-push-rulecheck-prefs；空串 = 全部项目） */
export interface RuleCheckPrefs {
  /** 选中的项目 ID（"" = 全部项目） */
  projectId: string
  /** 描述最短字数（"描述过短"规则阈值，缺省回退 DEFAULT_COMMIT_RULE_CONFIG.minSubjectLength） */
  minSubjectLength?: number
  /** 描述首字母大写开关（缺省回退默认值 true） */
  requireCapitalizedSubject?: boolean
  /** WIP 临时提交检测开关（缺省回退默认值 true） */
  detectWipSubject?: boolean
  /** scope 格式校验开关（缺省回退默认值 false = 不校验 scope 字符集） */
  scopeFormatEnabled?: boolean
  /** 正文行长限制开关（缺省回退默认值 true） */
  bodyLineLimitEnabled?: boolean
  /** 正文单行最大字符数（缺省回退 DEFAULT_COMMIT_RULE_CONFIG.maxBodyLineLength） */
  maxBodyLineLength?: number
  /** AI 生成提交信息的 diff 上下文字符预算（缺省回退 DEFAULT_COMMIT_RULE_CONFIG.diffContextBudget） */
  diffContextBudget?: number
}

/** 提交信息修正偏好（上次选择的提交时间策略，持久化到 git-push-commitfix-prefs） */
export interface CommitFixPrefs {
  /** true = 保留原始提交时间，false = 按当前时间提交 */
  preserveDate: boolean
}

/** 删除历史提交偏好（是否删除前自动备份，持久化到 git-push-dropcommit-prefs） */
export interface DropCommitPrefs {
  /** true = 删除前创建 bundle 全量备份，false = 跳过备份直接删除（仅 reflog 可恢复） */
  autoBackup: boolean
}

/**
 * 项目代码行数排行条目。
 *
 * 口径说明：本项目排行已从「增删增量排行」调整为「存量规模 + 生命周期」视图
 * （列表不再展示新增/删除/净增），故不再继承 LineRankBase。
 * 排序与占比一律以 totalLines（存量）为准。
 */
export interface ProjectLineRankItem {
  id: string
  name: string
  /** 当前项目实际总行数（存量，git ls-files + 逐文件行数统计；旧缓存无此字段时为 undefined，渲染时降级 0） */
  totalLines?: number
  /** 仓库首次提交时间（ISO %aI，历史根；"项目新建日期"口径；空串 = 空仓库/未取到） */
  firstCommit?: string
  /** 最后一次提交时间（ISO %aI，HEAD 提交时间；"最后修改"口径；空串 = 无提交） */
  lastCommit?: string
}

/** 提交分析聚合视图（单对象 prop，与 StatsView 同模式） */
export interface CommitAnalysisStats {
  /** 跨项目提交总数 */
  totalCommits: number
  /** 全部项目数 */
  projectCount: number
  /** 成功抓取提交的项目数 */
  analyzedCount: number
  /** 抓取失败的项目数（路径无效/git 失败） */
  failedCount: number
  /** 跨项目合并的原始条目 */
  entries: CommitAnalysisEntry[]
  /** 项目提交次数排行（降序，已按 PROJECT_RANK_LIMIT 截断） */
  projectRanking: { id: string, name: string, count: number }[]
  /** 项目排行的截断前项目总数（> projectRanking.length 时 UI 须提示「仅显示前 N 名」） */
  projectRankingTotal: number
}

/** 提交分析结果缓存（持久化到插件存储，进入视图直接复用上次结果，避免每次重跑 git log） */
export interface CommitAnalysisCache {
  /** 每项目抓取条数（"all" = 全部提交；缓存对应的设置，加载时回填选择器） */
  commitCount: number | "all"
  /** 上次分析完成时间（ISO，面板展示"上次分析"文案） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  /** 跨项目合并的提交条目 */
  entries: CommitAnalysisEntry[]
  /** 项目代码行数排行（随缓存持久化，切换视图复用） */
  projectLineRanking: ProjectLineRankItem[]
}

/**
 * 行数统计全量汇总（基于全量项目数据独立累加，供顶部汇总卡片展示）。
 *
 * 只保留存量口径：列表已移除新增/删除/净增，汇总卡片同步移除「总新增/总删除/总净增」，
 * 改为「项目数 / 文件数 / 当前总行数」三个存量指标。
 */
export interface LineStatsSummary {
  /** 纳入统计的项目数 */
  projectCount: number
  /** 纳入统计的已跟踪文件数（所有项目合计） */
  fileCount: number
  /** 当前工作区已跟踪文件总行数（存量口径，所有项目合计） */
  totalLines: number
}

/** 失败原因分类 → i18n 标签键（弹窗与统计共用同一映射；新增分类必须在此登记） */
export const FETCH_FAILURE_KIND_KEYS = {
  /** 本地路径不存在（多设备未配置该机路径 / 盘符或目录已变更） */
  pathMissing: "fetchFailReasonPathMissing",
  /** 目录存在但不是 Git 仓库（指向了非仓库目录或仓库子目录被移动） */
  notRepo: "fetchFailReasonNotRepo",
  /** 仓库已初始化但没有任何提交（git log 退出码非 0，属合法空数据但命令层报错） */
  noCommits: "fetchFailReasonNoCommits",
  /** git 命令超时（大仓库/网络盘，execFile 以 SIGTERM 终止子进程） */
  timeout: "fetchFailReasonTimeout",
  /** Git 环境不可用（未安装 git / PATH 缺失 / 非 Electron 环境） */
  gitUnavailable: "fetchFailReasonGitUnavailable",
  /** 仓库所有权校验失败（git 2.35+ safe.directory，常见于其他用户创建的目录） */
  dubiousOwner: "fetchFailReasonDubiousOwner",
  /** index.lock 残留（上一次超时被硬终止，后续写操作全部失败） */
  lock: "fetchFailReasonLock",
  /** 其他未归类错误（原因文本保留原始报错供排查） */
  other: "fetchFailReasonOther",
} as const

/** 项目抓取失败原因分类（由标签键映射推导，保证分类与 i18n 键一一对应） */
export type FetchFailureKind = keyof typeof FETCH_FAILURE_KIND_KEYS

/** 单项目抓取失败明细（失败项目名 + 本次使用路径 + 分类与原始报错，供失败明细弹窗展示） */
export interface ProjectFetchFailure {
  /** 项目 id */
  projectId: string
  /** 项目名（项目删除后由加载侧按有效项目过滤剔除） */
  projectName: string
  /** 本次实际使用的本地路径（resolveValidPath 解析结果；路径无效时即失败路径） */
  path: string
  /** 失败原因分类 */
  kind: FetchFailureKind
  /** 原始报错文本（git stderr / 路径信息，保留完整排查细节） */
  reason: string
}

/** 行数统计独立缓存（与提交分析缓存解耦，独立持久化到 git-push-line-stats-cache） */
export interface LineStatsCache {
  /** 上次分析完成时间（ISO，面板展示"上次分析"文案） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  /** 抓取失败项目明细（旧缓存无此字段时按空数组兜底，仅有计数可展示） */
  failures?: ProjectFetchFailure[]
  /** 项目代码行数排行（按总行数降序） */
  projectLineRanking: ProjectLineRankItem[]
  /** 选中的文件扩展名过滤（空数组 = 不过滤所有文件，持久化恢复上次选择） */
  selectedExtensions: string[]
  /** 全量汇总（旧缓存无此字段时由排行降级累加） */
  summary?: LineStatsSummary
}

/** 热力分级方式：auto=按当前范围内非零日的分位数自适应；fixed=固定阈值 HEAT_LEVEL_THRESHOLDS */
export type CommitHeatScaleMode = "auto" | "fixed"

/**
 * 热力指标口径：格子的深浅统计什么。
 * 三者都来自同一次 commit log 抓取（entries 已含 author / projectId），切换不额外跑 git。
 */
export type CommitHeatMetric = "commits" | "projects" | "authors"

/** 热力指标元数据（labelKey = 图例/设置文案，unitKey = 格子 tooltip 的量词） */
export const COMMIT_HEAT_METRIC_META: Record<CommitHeatMetric, { labelKey: string, unitKey: string }> = {
  commits: { labelKey: "analysisHeatMetricCommits", unitKey: "analysisHeatUnitCommits" },
  projects: { labelKey: "analysisHeatMetricProjects", unitKey: "analysisHeatUnitProjects" },
  authors: { labelKey: "analysisHeatMetricAuthors", unitKey: "analysisHeatUnitAuthors" },
}

/** 热力格子密度：compact=12px（一屏更宽）/ normal=14px（大屏更舒适） */
export type CommitHeatDensity = "compact" | "normal"

/** 热力格子边长（px，随密度档位）：网格列宽/行高、格子尺寸、图例色块共用同一来源 */
export const HEAT_CELL_SIZES: Record<CommitHeatDensity, number> = {
  compact: 12,
  normal: 14,
}

/** 提交分析显示设置（热力图/日历视图配置，持久化到 git-push-analysis-view） */
export interface CommitAnalysisViewSettings {
  /** 视图：热力图 / 日历 */
  view: "heatmap" | "calendar"
  /** 显示范围："lastYear"=最近一年；number=起始年份，连续显示到今年 */
  range: "lastYear" | number
  /** 每周第一天（与 Date.getDay 一致）：1=周一, 0=周日 */
  weekStart: 0 | 1
  /** 热力主色（#RRGGBB，格子由主色按等级加透明度渲染） */
  color: string
  /**
   * 热力分级方式（旧数据缺该字段时按默认 auto 兜底）。
   * auto 解决「多项目合并后固定阈值 1/3/6/12 让大片格子顶到最高级、颜色失去分辨率」。
   */
  heatScale: CommitHeatScaleMode
  /** 热力指标口径（旧数据缺该字段时按默认 commits 兜底） */
  heatMetric: CommitHeatMetric
  /** 热力格子密度（旧数据缺该字段时按默认 compact 兜底） */
  heatDensity: CommitHeatDensity
}

/** 热力等级阈值（固定档）：0 次 → level 0；≥1 / ≥3 / ≥6 / ≥12 次 → level 1~4（提交粒度，区别于 statistics 的文档操作阈值） */
export const HEAT_LEVEL_THRESHOLDS = [0, 1, 3, 6, 12] as const

/**
 * 提交分析星期短名 i18n 键（数组下标 = Date.getDay）。
 * 热力图与日历共用：两者都需按 weekStart 取星期名，各存一份会漂移。
 */
export const ANALYSIS_WEEKDAY_KEYS = [
  "analysisWdSun", "analysisWdMon", "analysisWdTue", "analysisWdWed",
  "analysisWdThu", "analysisWdFri", "analysisWdSat",
] as const

/** 提交分析月份短名 i18n 键（数组下标 = 月份 0~11，热力图月份标签使用） */
export const ANALYSIS_MONTH_KEYS = [
  "analysisMonthJan", "analysisMonthFeb", "analysisMonthMar", "analysisMonthApr",
  "analysisMonthMay", "analysisMonthJun", "analysisMonthJul", "analysisMonthAug",
  "analysisMonthSep", "analysisMonthOct", "analysisMonthNov", "analysisMonthDec",
] as const

/** 项目列表视图模式（单一事实源，ViewMode 联合类型由此推导） */
export const VIEW_MODES = ["all", "needsPush", "needsPull", "uncommitted", "starred", "archived"] as const
export type ViewMode = typeof VIEW_MODES[number]

/** 智能视图模式元数据（i18n 标签键 + 图标），Record<ViewMode> 保证键与联合类型编译期对齐 */
export const VIEW_MODE_META: Record<ViewMode, { labelKey: string, icon: string }> = {
  all: { labelKey: "viewModeAll", icon: "mdi:view-grid-outline" },
  needsPush: { labelKey: "viewModeNeedsPush", icon: "mdi:cloud-upload-outline" },
  needsPull: { labelKey: "viewModeNeedsPull", icon: "mdi:cloud-download-outline" },
  uncommitted: { labelKey: "viewModeUncommitted", icon: "mdi:source-branch" },
  starred: { labelKey: "viewModeStarred", icon: "mdi:star" },
  archived: { labelKey: "viewModeArchived", icon: "mdi:archive-outline" },
}

// ── 仓库清理视图（RepoCleanOps 产出 / RepoCleanPanel 消费）──

/** 单个大文件 blob 条目（可达对象扫描聚合） */
export interface RepoBlobItem {
  /** blob 完整 hash */
  hash: string
  /** 最后出现的路径（rev-list --objects 输出；树对象无路径，blob 均有） */
  path: string
  /** 字节大小 */
  size: number
  /**
   * 锚定来源（BFG 清理后残留诊断）：
   * undefined = 本地分支/标签可达（正常状态）；
   * "remote" = 仅被远程跟踪引用（refs/remotes/*）锚定 → 远端仍保留旧历史或存在未重写的远程分支；
   * "other" = 被其他引用（stash 等）锚定
   */
  anchor?: "remote" | "other"
}

/** 仓库体检扫描结果（体积汇总 + 可达大文件 Top N） */
export interface RepoScanResult {
  /** .git 打包体积（count-objects size-pack，字节） */
  packSize: number
  /** 松散对象体积（count-objects size，字节） */
  looseSize: number
  /** 全部对象总数（count-objects count + in-pack） */
  objectCount: number
  /** 最大 blob Top N（降序，默认 50） */
  topBlobs: RepoBlobItem[]
  /** 超过阈值的可达 blob 数 */
  oversizedCount: number
  /** 超过阈值 blob 的累计字节（含 Top N 之外的） */
  oversizedBytes: number
  /** 扫描完成时间（ISO） */
  scannedAt: string
}

/** 仓库清理视图偏好（上次选中项目 + 大文件阈值，持久化到 git-push-repoclean-prefs） */
export interface RepoCleanPrefs {
  /** 上次选中的项目 ID（空串 = 取项目列表第一个） */
  projectId: string
  /** 大文件阈值（MB，默认 10） */
  thresholdMb: number
}

/** BFG 运行时探测状态（Java + bfg.jar 就绪情况，供清理向导检查清单展示） */
export interface BfgRuntimeState {
  /** Java 可用 */
  javaOk: boolean
  /** Java 版本串（如 openjdk 17.0.2） */
  javaVersion: string
  /** 实际解析的 java 可执行文件路径 */
  javaPath: string
  /** bfg.jar 已就绪（文件存在） */
  jarOk: boolean
  /** jar 实际路径 */
  jarPath: string
}

/** BFG 清理计划（向导弹窗表单产出，RepoCleanOps 组装为 bfg 命令行参数） */
export interface BfgCleanPlan {
  /** 清理大于此值的 blob（MB；0 = 不启用 → --strip-blobs-bigger-than） */
  stripBiggerThanMb: number
  /** 按名删除文件 glob（文件名匹配非路径；多值合并为 {g1,g2} → --delete-files） */
  deleteFileGlobs: string[]
  /** 按名删除文件夹 glob（多值合并 → --delete-folders） */
  deleteFolderGlobs: string[]
  /** 敏感文本替换规则（每行一条："原文" 或 "原文==>替换值" 或 "regex:..."，写临时文件 → --replace-text） */
  replaceRules: string[]
}

/** BFG 清理结果（前后体积 + 备份路径 + 各阶段耗时） */
export interface BfgCleanResult {
  /** 清理前 .git 体积（字节） */
  sizeBefore: number
  /** 清理后 .git 体积（字节） */
  sizeAfter: number
  /** 备份 bundle 文件路径（git clone <bundle> 可恢复） */
  backupPath: string
  /** 各阶段耗时（ms，键为 backup/mirror/bfg/gc/sync） */
  durations: Record<string, number>
}

/** BFG 运行时路径覆盖偏好（空串 = 自动探测/默认缓存路径，持久化到 git-push-bfg-prefs） */
export interface BfgPrefs {
  /** 自定义 java 可执行文件路径（空 = JAVA_HOME → PATH 自动探测） */
  javaPath: string
  /** 自定义 bfg.jar 路径（空 = 插件数据目录 bin/ 下自动管理） */
  jarPath: string
}
