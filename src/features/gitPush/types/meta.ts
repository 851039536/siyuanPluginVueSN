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

/** 面板头部视图（列表/统计/操作日志），与 ViewMode（列表内筛选模式 all/needsPush/...）语义不同 */
export type PanelView = "list" | "stats" | "log"

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
