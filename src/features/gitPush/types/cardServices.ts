// gitPush 卡片依赖注入契约（index.vue provide，ListView/卡片 inject，消除中间人 props/emits）
import type { InjectionKey, Ref } from "vue"
import type { GitPushManager } from "../GitPushManager"
import type { PlatformKey } from "./meta"
import type {
  CommitTemplate,
  CustomIde,
  GitProject,
  IdeEntry,
  ProjectCategory,
  PushOutputEntry,
  PushStatusInfo,
  WorkingTreeInfo,
} from "./storage"

/** 卡片自持数据域（父层操作完成后经 cardRefreshSignals 按域通知卡片重载） */
export type CardDataDomain = "log" | "branches" | "stash" | "tags" | "conflicts"

/** 按项目 id 键控的刷新信号计数（域计数递增 = 该域需要重载） */
export type CardRefreshSignals = Record<string, Partial<Record<CardDataDomain, number>>>

/** 跨卡片共享数据（原 ProjectCard props 的静态/共享类，index.vue 持有） */
export interface CardSharedData {
  i18n: Record<string, any>
  categories: Ref<ProjectCategory[]>
  detectedIdes: Ref<IdeEntry[]>
  customIdes: Ref<CustomIde[]>
  commitTemplates: Ref<CommitTemplate[]>
  searchQuery: Ref<string>
}

/** 父层响应式 Record（原 props 的切片类，卡片经 useCardServices 派生单项目值） */
export interface CardRecordData {
  pushStatuses: Ref<Record<string, PushStatusInfo>>
  workingTrees: Ref<Record<string, WorkingTreeInfo>>
  committing: Ref<Record<string, boolean>>
  /** 引用计数（>0 视为 loading），防并发同类操作先完成者提前清除标志 */
  stashLoading: Ref<Record<string, number>>
  pushOutputs: Ref<Record<string, PushOutputEntry[]>>
  pullOutputs: Ref<Record<string, PushOutputEntry[]>>
  commitOutputs: Ref<Record<string, string>>
  generatingMsgs: Ref<Record<string, { generating: boolean, text: string }>>
  /** 引用计数（>0 视为 loading） */
  gitOpLoading: Ref<Record<string, number>>
  genStashDescLoading: Ref<Record<string, boolean>>
  /** 全局单值（非按 id）：外部生成的 stash 描述文案 */
  generatedStashMsg: Ref<string>
  tagPushLoading: Ref<Record<string, string>>
  /** 引用计数（>0 视为 loading） */
  fetching: Ref<Record<string, number>>
  /** 引用计数（>0 视为 loading） */
  remoteStatusLoading: Ref<Record<string, number>>
  /** 引用计数（>0 视为 loading） */
  refreshingWorkingTree: Ref<Record<string, number>>
  /** 当前"全部刷新"的项目 id（仅该卡片旋转图标） */
  refreshing: Ref<string | null>
}

/** 派生函数（原函数 props，来自 usePushStatusView / useGitPush） */
export interface CardDerivedFns {
  getPushStatus: (id: string, key: string) => string | undefined
  isPulling: (id: string, key?: string) => boolean
  isPushing: (id: string) => boolean
  statusLabel: (id: string, key: string) => string
  statusBadgeClass: (id: string, key: string) => string
  needsPushFor: (id: string, key: string) => boolean
  hasBehind: (id: string) => boolean
}

/** 卡片操作函数（原 40+ emits 对应的 handler 集群，index.vue 提供） */
export interface CardOps {
  toggleStar: (id: string) => void
  moveProject: (id: string, categoryId: string) => void
  switchBranch: (id: string, branch: string) => Promise<void>
  handleRemove: (project: GitProject) => void
  openEditDialog: (project: GitProject) => void
  openMarkdownPreview: (project: GitProject, fileName: string) => void
  openProjectGitConfig: (id: string) => void
  handleOpenIde: (path: string, ide: IdeEntry) => void
  handleOpenCustomIde: (path: string, name: string) => void
  showIdeDialog: (show?: boolean) => void
  removeCustomIdeByName: (name: string) => void
  handleRefresh: (id: string) => void
  handleRefreshWorkingTree: (id: string) => void
  handleRefreshRemoteStatus: (id: string) => void
  handleGitOp: (label: string, fn: () => Promise<void>, id: string) => Promise<void>
  stageItem: (id: string, file: string) => Promise<void>
  unstageItem: (id: string, file: string) => Promise<void>
  stageAllItems: (id: string) => Promise<void>
  unstageAllItems: (id: string) => Promise<void>
  handleCommit: (id: string, msg: string) => Promise<void>
  handleGenerateMsg: (id: string) => void
  clearOutput: (id: string) => void
  handleDiscard: (id: string, file: string, staged: boolean, status: string) => void
  handleStashConfirmMsg: (id: string, msg: string) => void
  handleGenStashDesc: (id: string) => void
  handleStashPop: (id: string, index: number) => void
  handleStashApply: (id: string, index: number) => void
  handleStashDrop: (id: string, index: number) => void
  handleCreateTag: (id: string, name: string, message?: string) => void
  handlePushTag: (id: string, tag: string) => void
  handleDeleteTag: (id: string, tag: string) => void
  handleResolveConflict: (id: string, file: string, strategy: "theirs" | "ours") => void
  handleAbortMerge: (id: string) => void
  confirmPullSingle: (id: string, key: PlatformKey) => void
  pushSingle: (id: string, key: PlatformKey) => Promise<{ ok: boolean, stdout: string, stderr: string }>
  pushToAll: (id: string) => Promise<Record<string, any>>
  handleForcePushToAll: (id: string) => void
  cancelPush: (id: string) => void
  handleFetchAll: (id: string) => void
  openRepoWebUrl: (url: string) => void
  openLocalPath: (path: string) => void
}

/** 卡片可直接调用的父层服务（按分组注入，消除中间人 props/emits 透传） */
export interface CardServices {
  /** Git 操作门面（卡片经 manager 直取自持数据，不再走父层 Record 切片） */
  manager: GitPushManager
  /** 更新项目元信息并同步父层项目列表（useProjectCrud 版本，含 patchProject 本地同步） */
  updateProjectMeta: (id: string, patch: Partial<Pick<GitProject, "name">>) => Promise<GitProject | null>
  /** 父层操作（提交/stash/tag/冲突/批量刷新）完成后的按域重载信号，卡片 watch 响应 */
  cardRefreshSignals: Ref<CardRefreshSignals>
  /** 提交日志加载后同步项目最近活动时间（原 useGitOps.loadCommitLog 的副作用） */
  recordCommitActivity: (id: string, isoTime: string) => Promise<void>
  /** 跨卡片共享数据 */
  shared: CardSharedData
  /** 父层响应式 Record（卡片经 useCardServices 派生单项目值） */
  records: CardRecordData
  /** 派生函数 */
  derived: CardDerivedFns
  /** 卡片操作函数集群 */
  ops: CardOps
}

export const CARD_SERVICES_KEY: InjectionKey<CardServices> = Symbol("gitPushCardServices")
