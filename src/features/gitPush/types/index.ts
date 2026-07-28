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
  COMMIT_TYPE_VALUES,
  GitPushStorage,
  UNGROUPED_ID,
} from "./storage"

// ── 重导出元数据（来自 meta.ts，独立模块切断循环引用）──
export {
  PLATFORM_META,
  FILE_STATUS_META,
  REMOTES,
  VIEW_MODE_META,
  VIEW_MODES,
} from "./meta"
export type { PlatformKey, PlatformStatusItem, ViewMode } from "./meta"
export { getPlatformStatus } from "./meta"
