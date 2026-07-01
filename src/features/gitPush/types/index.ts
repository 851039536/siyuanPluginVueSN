/** gitPush 模块类型定义入口 */

import type { GitProject } from "./storage"

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
  GitProject,
  GitRemoteInfo,
  ProjectCategory,
  ProjectStatus,
  PushStatusInfo,
  RemotePushStatus,
  ScannedGitRepo,
  StashEntry,
  TagInfo,
  WorkingTreeInfo,
} from "./storage"
export {
  COMMIT_TYPE_VALUES,
  GitPushStorage,
  PROJECT_STATUS_VALUES,
} from "./storage"

// ── 远程平台元数据（共享常量）──
export const PLATFORM_META = [
  {
    key: "github" as const,
    icon: "mdi:github",
    label: "GitHub",
    remoteProp: "githubRemote" as const,
    urlProp: "githubUrl" as const,
  },
  {
    key: "gitee" as const,
    icon: "mdi:git",
    label: "Gitee",
    remoteProp: "giteeRemote" as const,
    urlProp: "giteeUrl" as const,
  },
  {
    key: "gitea" as const,
    icon: "mdi:tea",
    label: "Gitea",
    remoteProp: "giteaRemote" as const,
    urlProp: "giteaUrl" as const,
  },
  {
    key: "cnb" as const,
    icon: "mdi:cloud-braces",
    label: "CNB",
    remoteProp: "cnbRemote" as const,
    urlProp: "cnbUrl" as const,
  },
]

export type PlatformKey = typeof PLATFORM_META[number]["key"]

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
