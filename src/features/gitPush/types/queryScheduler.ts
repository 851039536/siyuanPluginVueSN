// gitPush 查询调度契约（独立模块：切断 cardServices ↔ composable 的循环引用）
import type { Ref } from "vue"
import type {
  PushStatusInfo,
  WorkingTreeInfo,
} from "./storage"

/**
 * 项目级查询域。调度器对每个 (项目, 域) 维护单飞 Promise 与新鲜度时间戳，
 * 是「同一查询在任一时刻至多 1 个在飞 git 任务」的唯一权威。
 */
export type ProjectQueryKind =
  /** rev-parse --abbrev-ref HEAD（分支名，其余查询的共同前置） */
  | "branch"
  /** ahead/behind/noUpstream 检查 */
  | "pushStatus"
  /** 工作区变更摘要 */
  | "workingTree"
  /** 远程配置刷新 + fetch + 状态重查（复合网络管线） */
  | "remoteRefresh"
  // ── 卡片自持数据域（原 CardDataDomain）──
  | "log"
  | "branches"
  | "stash"
  | "tags"
  | "remoteTags"
  | "conflicts"

/** `loadStatus` 的两档语义 */
export type ProjectStatusMode =
  /** 已有缓存即跳过（视图切换 / 首屏补齐用） */
  | "ensure"
  /** 强制重查（显式刷新用） */
  | "refresh"

/** `loadPushStatus` / `loadWorkingTree` 选项 */
export interface LoadStatusOptions {
  /** 已知分支名（调用方持有，传入可省一次 rev-parse） */
  branch?: string
  /** 绕过单飞共享，始终发起新查询（写操作后必须拿到写后状态时用） */
  force?: boolean
}

/** `loadStatus` 选项（在 LoadStatusOptions 之上增加模式与节流） */
export interface LoadProjectStatusOptions extends LoadStatusOptions {
  mode?: ProjectStatusMode
  /** refresh 模式下的最小重查间隔（ms），距上次成功过近则跳过；默认 0 = 不节流 */
  minIntervalMs?: number
}

/** `run` 选项 */
export interface RunQueryOptions {
  /** true 时绕过单飞，始终发起新查询（显式刷新用） */
  force?: boolean
}

/**
 * 项目查询调度器。三档职责：
 *   ① 单飞     — run/branch/pushStatus/workingTree/remoteRefresh 同键共享在飞 Promise
 *   ② 新鲜度   — lastLoadedAt 支撑 ensure 模式与 minIntervalMs 节流
 *   ③ 脏标记   — invalidate 标脏 + epoch 递增，卡片按需消费（取代 push 型 per-域信号）
 */
export interface ProjectQueryScheduler {
  /** 单值响应式脏信号：任何 invalidate 递增一次（卡片只 watch 它，避免 O(卡片数×域数) 求值） */
  epoch: Ref<number>
  /** 推送状态缓存（所有权在此，经 useGitOps 重导出保持公共面不变） */
  pushStatuses: Ref<Record<string, PushStatusInfo>>
  /** 工作区状态缓存（所有权在此，经 useGitOps 重导出保持公共面不变） */
  workingTrees: Ref<Record<string, WorkingTreeInfo>>

  // ── 通用单飞原语 ──
  /** 单飞执行任意项目级查询（同 id+kind 在飞时共享同一 Promise） */
  run: <T>(id: string, kind: ProjectQueryKind, load: () => Promise<T>, opts?: RunQueryOptions) => Promise<T>
  /** 该域是否已有成功结果（替代卡片 detailsLoaded 布尔） */
  has: (id: string, kind: ProjectQueryKind) => boolean
  /** 该域结果是否在 withinMs 内加载过（自动刷新节流用） */
  isFresh: (id: string, kind: ProjectQueryKind, withinMs: number) => boolean

  // ── 脏标记 ──
  /** 标记指定项目的若干域为脏并递增 epoch（原 bumpCardRefresh） */
  invalidate: (id: string, ...kinds: ProjectQueryKind[]) => void
  /** 取出并清空该项目的脏域集合（卡片 epoch watch 调用） */
  consumeDirty: (id: string) => Set<ProjectQueryKind> | undefined

  // ── 状态查询（Tier 1） ──
  /** 解析当前分支名（单飞 + 缓存；force 时重查） */
  resolveBranch: (id: string, opts?: { force?: boolean }) => Promise<string>
  /** 直接写入已知分支名（切换分支后调用，避免后续查询再发一次 rev-parse） */
  setBranch: (id: string, branch: string) => void
  /** 加载推送状态（branch 缺省走 resolveBranch 缓存） */
  loadPushStatus: (id: string, opts?: LoadStatusOptions) => Promise<void>
  /** 加载工作区状态（branch 缺省走 resolveBranch 缓存） */
  loadWorkingTree: (id: string, opts?: LoadStatusOptions) => Promise<void>
  /** 一次 resolveBranch 后并行加载 pushStatus + workingTree（取代 loadProjectGitStatus / loadStatsData） */
  loadStatus: (id: string, opts?: LoadProjectStatusOptions) => Promise<void>
  /** 统一远程刷新：refreshRemotes(配置) → fetchAllForProject(网络一次) → loadPushStatus(纯本地比对) */
  refreshRemote: (id: string, opts?: { force?: boolean }) => Promise<void>

  // ── 缓存清理 ──
  /** 删除项目 / 项目路径或远程变更后清空其全部调度状态 */
  clearProject: (id: string) => void
}
