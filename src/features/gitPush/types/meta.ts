// gitPush 平台、状态、文件变更的元数据常量（独立模块，切断 types/index ↔ GitPushManager 循环引用）
import type { GitProject } from "./storage"

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

// ── 文件变更状态元数据（icon + 中文标题，供 WorkingTreePanel 使用）──
export const FILE_STATUS_META: Record<string, { icon: string, title: string }> = {
  modified: { icon: "~", title: "已修改" },
  added: { icon: "+", title: "新增" },
  deleted: { icon: "−", title: "已删除" },
  renamed: { icon: "forward", title: "重命名" },
  untracked: { icon: "?", title: "未跟踪" },
  copied: { icon: "⇋", title: "已复制" },
  unmerged: { icon: "warning", title: "冲突" },
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

/** 分类分布条目（用 category.color 着色的条形区块） */
export interface CategoryDistributionItem {
  id: string
  name: string
  color: string
  count: number
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

/** 类型安全地获取平台状态 */
export function getPlatformStatus(item: PlatformStatusItem, key: PlatformKey): boolean {
  return item[key]
}

// ── 仓库链接一致性审计（useRepoLinkAudit 产出 / RepoLinkAuditSection 消费）──
/** 单平台比对状态：一致 / 不一致 / 仅配置链接 / 仅存在远程 / 两者皆无 */
export type RepoLinkAuditState = "match" | "mismatch" | "linkOnly" | "remoteOnly" | "none"

/** 单项目单平台的审计单元格（link/remoteUrl 保留原文供 tooltip 排错） */
export interface RepoLinkAuditCell {
  key: PlatformKey
  state: RepoLinkAuditState
  /** 手动配置的仓库链接原文（未配置为空串） */
  link: string
  /** 实际检测到的远程 URL 原文（无该平台远程为空串） */
  remoteUrl: string
}

/** 单项目审计行 */
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

/** 审计四态汇总计数 */
export interface RepoLinkAuditSummary {
  match: number
  mismatch: number
  linkOnly: number
  remoteOnly: number
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
  /** 分类分布（按 category.order 排序，仅含非空分类） */
  categoryDistribution: CategoryDistributionItem[]
  /** 平台配置状态明细（每个项目的 GitHub/Gitee/Gitea/CNB 是否已配置） */
  platformStatusProjects: PlatformStatusItem[]
}

/** 面板头部视图（列表/统计/操作日志/提交分析/行数统计/代码统计报告），与 ViewMode（列表内筛选模式 all/needsPush/...）语义不同 */
export type PanelView = "list" | "stats" | "log" | "analysis" | "linestats" | "report"

// ── 提交分析视图（useCommitAnalysis 产出 / CommitAnalysisPanel 消费）──

/** 单条提交分析条目（跨项目合并的提交流最小形状） */
export interface CommitAnalysisEntry {
  projectId: string
  projectName: string
  hash: string
  message: string
  author: string
  /** ISO 时间戳（git %aI 输出，new Date 可直接解析） */
  date: string
}

/** Conventional Commits 类型（提交内容分析分类，other 兜底无前缀提交；与 storage.ts 的 CommitType 提交模板类型语义不同） */
export type CommitAnalysisType =
  | "feat" | "fix" | "docs" | "refactor" | "perf" | "style"
  | "test" | "build" | "ci" | "chore" | "other"

/** 提交类型元数据（labelKey 对应 i18n 键 commitTypeFeat 等，color 用于条形/徽章着色） */
export const COMMIT_ANALYSIS_TYPE_META: Record<CommitAnalysisType, { labelKey: string, color: string }> = {
  feat: { labelKey: "commitTypeFeat", color: "#10b981" },
  fix: { labelKey: "commitTypeFix", color: "#ef4444" },
  docs: { labelKey: "commitTypeDocs", color: "#3b82f6" },
  refactor: { labelKey: "commitTypeRefactor", color: "#8b5cf6" },
  perf: { labelKey: "commitTypePerf", color: "#f59e0b" },
  style: { labelKey: "commitTypeStyle", color: "#ec4899" },
  test: { labelKey: "commitTypeTest", color: "#14b8a6" },
  build: { labelKey: "commitTypeBuild", color: "#f97316" },
  ci: { labelKey: "commitTypeCi", color: "#06b6d4" },
  chore: { labelKey: "commitTypeChore", color: "#64748b" },
  other: { labelKey: "commitTypeOther", color: "#9ca3af" },
}

/** 行数排行基础字段（新增/删除/净增三要素） */
interface LineRankBase {
  /** 新增行数（numstat 聚合） */
  added: number
  /** 删除行数（numstat 聚合） */
  deleted: number
  /** 净增行数 = added - deleted */
  net: number
}

/** 项目代码行数排行条目 */
export interface ProjectLineRankItem extends LineRankBase {
  id: string
  name: string
}

/** 作者代码行数排行条目 */
export interface AuthorLineRankItem extends LineRankBase {
  author: string
}

/** 项目行数详情 — 文件明细行（弹窗内由 aggregateFileStats 即时聚合，不持久化） */
export interface FileLineDetailRow {
  /** 文件路径（相对仓库根） */
  path: string
  /** 新增行数（numstat 聚合，已按扩展名过滤） */
  added: number
  /** 删除行数 */
  deleted: number
  /** 净增行数 = added - deleted */
  net: number
  /** 修改次数（来自 FileAgg.modCount） */
  modCount: number
  /** 参与作者数（来自 FileAgg.authors.size） */
  authorCount: number
  /** 条形宽度百分比（新增行 / 项目最大文件新增行，0~100） */
  pct: string
  /** 新增行数占项目总新增的百分比（保留 1 位小数） */
  share: string
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
  /** 最近 30 天每日提交数（缺天补 0，label 为 YYYY-MM-DD） */
  dailyCommits: { label: string, count: number }[]
  /** 项目提交次数排行（降序） */
  projectRanking: { id: string, name: string, count: number }[]
  /** 提交内容类型分布（降序，仅含非零类型） */
  typeDistribution: { type: CommitAnalysisType, count: number }[]
  /** 作者提交排行（降序） */
  authorRanking: { author: string, count: number }[]
  /** 项目代码行数排行（按新增行降序，行数统计视图分析后非空） */
  projectLineRanking: ProjectLineRankItem[]
  /** 作者代码行数排行（按新增行降序，行数统计视图分析后非空） */
  authorLineRanking: AuthorLineRankItem[]
}

/** 提交分析结果缓存（持久化到插件存储，进入视图直接复用上次结果，避免每次重跑 git log） */
export interface CommitAnalysisCache {
  /** 每项目抓取条数（缓存对应的设置，加载时回填选择器） */
  commitCount: number
  /** 上次分析完成时间（ISO，面板展示"上次分析"文案） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  /** 跨项目合并的提交条目 */
  entries: CommitAnalysisEntry[]
  /** 项目代码行数排行（随缓存持久化，切换视图复用） */
  projectLineRanking: ProjectLineRankItem[]
  /** 作者代码行数排行（随缓存持久化，切换视图复用） */
  authorLineRanking: AuthorLineRankItem[]
}

/** 行数统计全量汇总（基于全量项目数据合计，与截断后的排行解耦，避免项目数超过排行上限时「总」数字偏小） */
export interface LineStatsSummary {
  /** 总新增行数 */
  added: number
  /** 总删除行数 */
  deleted: number
  /** 总净增行数（added − deleted） */
  net: number
}

/** 行数统计独立缓存（与提交分析缓存解耦，独立持久化到 git-push-line-stats-cache） */
export interface LineStatsCache {
  /** 每项目抓取条数（缓存对应的设置，加载时回填选择器） */
  commitCount: number
  /** 上次分析完成时间（ISO，面板展示"上次分析"文案） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  /** 项目代码行数排行（按新增行降序） */
  projectLineRanking: ProjectLineRankItem[]
  /** 作者代码行数排行（按新增行降序） */
  authorLineRanking: AuthorLineRankItem[]
  /** 选中的文件扩展名过滤（空数组 = 不过滤所有文件，持久化恢复上次选择） */
  selectedExtensions: string[]
  /** 全量汇总（旧缓存无此字段时由排行降级累加） */
  summary?: LineStatsSummary
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
}

/** 热力等级阈值：0 次 → level 0；≥1 / ≥3 / ≥6 / ≥12 次 → level 1~4（提交粒度，区别于 statistics 的文档操作阈值） */
export const HEAT_LEVEL_THRESHOLDS = [0, 1, 3, 6, 12] as const

/** 项目列表视图模式（单一事实源，ViewMode 联合类型由此推导） */
export const VIEW_MODES = ["all", "needsPush", "uncommitted", "starred", "archived"] as const
export type ViewMode = typeof VIEW_MODES[number]

/** 智能视图模式元数据（i18n 标签键 + 图标），Record<ViewMode> 保证键与联合类型编译期对齐 */
export const VIEW_MODE_META: Record<ViewMode, { labelKey: string, icon: string }> = {
  all: { labelKey: "viewModeAll", icon: "mdi:view-grid-outline" },
  needsPush: { labelKey: "viewModeNeedsPush", icon: "mdi:cloud-upload-outline" },
  uncommitted: { labelKey: "viewModeUncommitted", icon: "mdi:source-branch" },
  starred: { labelKey: "viewModeStarred", icon: "mdi:star" },
  archived: { labelKey: "viewModeArchived", icon: "mdi:archive-outline" },
}
