// 远程与本地一致性分析类型（useConsistencyAudit 产出 / ConsistencyAuditDialog 消费）

/** 单分支比对状态：一致 / 需推送 / 需拉取 / 已分叉 / 仅本地 / 仅远程 / 比对失败 */
export type ConsistencyState = "synced" | "ahead" | "behind" | "diverged" | "localOnly" | "remoteOnly" | "error"

/** 单分支 × 单远程比对行 */
export interface ConsistencyBranchRow {
  /** 本地分支名（remoteOnly 时为远程分支名） */
  branch: string
  /** 是否当前分支（remoteOnly 恒为 false） */
  current: boolean
  /** 远程名 */
  remote: string
  state: ConsistencyState
  /** 本地领先远程的提交数 */
  ahead: number
  /** 本地落后远程的提交数 */
  behind: number
}

/** 单项目比对结果行 */
export interface ConsistencyProjectRow {
  id: string
  name: string
  path: string
  /** 路径无效 / git 命令整体失败 */
  error: boolean
  /** 未检测到任何远程 */
  noRemote: boolean
  /** 空仓库或无任何分支 */
  noBranches: boolean
  /** 各远程 fetch 失败信息（key 为远程名），fetch 失败仍用缓存跟踪 ref 比对 */
  fetchErrors: Record<string, string>
  branches: ConsistencyBranchRow[]
}

/** 七态汇总计数（跨全部项目全部分支行） */
export interface ConsistencySummary {
  synced: number
  ahead: number
  behind: number
  diverged: number
  localOnly: number
  remoteOnly: number
  error: number
}

/** 单次分析的项目数量上限（"all" = 全部项目，数字 = 按项目列表顺序取前 N 个） */
export type ProjectLimit = number | "all"

/** 项目数量选择框选项（"all" 在首位 = 默认项） */
export const PROJECT_LIMIT_OPTIONS: readonly ProjectLimit[] = ["all", 10, 20, 30, 50, 100]

/** 一致性分析结果持久化缓存（跨会话复用，打开弹窗直接展示上次结果） */
export interface ConsistencyCache {
  /** 上次分析完成时间（ISO，弹窗展示"上次分析"文案） */
  analyzedAt: string
  /** 项目数量上限（跨会话恢复选择框） */
  projectLimit: ProjectLimit
  /** 全部项目比对结果行 */
  rows: ConsistencyProjectRow[]
}

/** 空缓存默认值（从未分析过时使用） */
export const EMPTY_CONSISTENCY_CACHE: ConsistencyCache = { analyzedAt: "", projectLimit: "all", rows: [] }
