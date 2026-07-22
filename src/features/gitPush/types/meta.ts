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

// ── 项目状态徽章元数据（颜色 + 文案 + 图标 + 循环顺序）──
export const STATUS_META: Record<string, { color: string, label: string, icon: string }> = {
  active: {
    color: "var(--b3-theme-success)",
    label: "活跃",
    icon: "mdi:circle-medium",
  },
  maintenance: {
    color: "var(--b3-theme-primary)",
    label: "维护中",
    icon: "mdi:circle-medium",
  },
  paused: {
    color: "var(--b3-theme-on-surface)",
    label: "暂停",
    icon: "mdi:pause-circle-outline",
  },
}

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

// ── 统计视图类型 ──
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

/** 项目列表视图模式 */
export type ViewMode = "all" | "needsPush" | "uncommitted" | "starred" | "archived"
