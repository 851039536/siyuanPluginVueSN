// Git 刷新操作集群（单项/工作区/远程；去重与分支复用统一由 useProjectQueryScheduler 承担）
import type { Ref } from "vue"
import type { RunBatch } from "./useBatchProgress"
import type { GitProject, ProjectQueryKind, ProjectQueryScheduler } from "../types"
import { ref } from "vue"
import { showMessage } from "siyuan"
import { getErrorMessage } from "@/utils/stringUtils"
import { acquireFlag, findProject, releaseFlag } from "../utils"

/**
 * 工作区状态快照（用于「刷新后是否需要重载卡片自持数据」的变化判定）。
 * 只取对 log/branches/stash 有指示意义的维度，避免把无关字段抖动误判为变化。
 */
interface WorkingTreeSnapshot {
  /** 当前分支名（切分支 ⇒ 日志/分支列表必然要重载） */
  branch: string
  /** 变更文件数 */
  fileCount: number
  /** 已暂存 / 未暂存 / 未跟踪计数（提交、暂存、丢弃都会改动其中之一） */
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  /** 是否存在变更 */
  hasChanges: boolean
}

/** 读取某项目当前工作区快照（无缓存时返回 null，交由调用方按「已变化」保守处理） */
function snapshotWorkingTree(
  scheduler: ProjectQueryScheduler,
  id: string,
): WorkingTreeSnapshot | null {
  const wt = scheduler.workingTrees.value[id]
  if (!wt) return null
  return {
    branch: wt.branch,
    fileCount: wt.files.length,
    stagedCount: wt.stagedCount,
    unstagedCount: wt.unstagedCount,
    untrackedCount: wt.untrackedCount,
    hasChanges: wt.hasChanges,
  }
}

/**
 * 两次快照间是否发生了「会影响提交日志 / 分支列表 / stash」的变化。
 *
 * 任一快照缺失（首次加载 / 状态查询失败）一律判定为「已变化」：
 * 宁可多标脏一次（代价是重载，用户看到的是最新数据），
 * 也不可漏报（代价是卡片停留在陈旧数据上且无任何提示）。
 */
function workingTreeChanged(
  before: WorkingTreeSnapshot | null,
  after: WorkingTreeSnapshot | null,
): boolean {
  if (!before || !after) return true
  return before.branch !== after.branch
    || before.fileCount !== after.fileCount
    || before.stagedCount !== after.stagedCount
    || before.unstagedCount !== after.unstagedCount
    || before.untrackedCount !== after.untrackedCount
    || before.hasChanges !== after.hasChanges
}

export function useRefreshOps(deps: {
  projects: Ref<GitProject[]>
  runBatchWithProgress: RunBatch
  tf: (key: string, ...args: (string | number)[]) => string
  /** 查询调度器：唯一的状态查询 / 远程刷新入口（单飞 + 分支复用 + 脏标记） */
  scheduler: ProjectQueryScheduler
  /** 按域标记卡片自持数据为脏（log/branches/stash 已下沉 ProjectCard） */
  bumpCardRefresh: (id: string, ...domains: ProjectQueryKind[]) => void
}) {
  const {
    projects,
    runBatchWithProgress,
    tf,
    scheduler,
    bumpCardRefresh,
  } = deps

  const refreshing = ref<string | null>(null)
  /** FETCH 操作加载中 id → 计数 */
  const fetching = ref<Record<string, number>>({})
  /** 远程状态刷新加载中 id → 计数 */
  const remoteStatusLoading = ref<Record<string, number>>({})
  /** 工作区刷新加载中 id → 计数 */
  const refreshingWorkingTree = ref<Record<string, number>>({})

  /** 按项目 id 维护 Record 型 loading 状态（引用计数 + finally 浅拷贝触发响应式）。
   * 计数防止并发同类操作时先完成者提前清除标志；统一 refreshingWorkingTree / remoteStatusLoading / fetching 三处重复模式 */
  async function withRecordLoading(
    loadingRef: Ref<Record<string, number>>,
    id: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    acquireFlag(loadingRef.value, id)
    loadingRef.value = { ...loadingRef.value }
    try {
      await fn()
    } finally {
      releaseFlag(loadingRef.value, id)
      loadingRef.value = { ...loadingRef.value }
    }
  }

  async function handleRefresh(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    // 重入守卫：连点"全部刷新"会并发执行且先结束者 finally 置 null 使旋转指示提前消失
    if (refreshing.value) return
    refreshing.value = id
    try {
      await runBatchWithProgress([project], tf("refreshingLabel"), async (p) => {
        // 统一远程管线（调度器单飞）：refreshRemotes → fetch → 状态重查。
        // 内含一次 rev-parse 并缓存分支名，供工作区重载复用（不再各自解析）。
        // 不传 force：与并发的「Fetch」「刷新远程状态」共享同一轮网络请求（去重关键）
        await scheduler.refreshRemote(p.id)
        // 记录刷新前的工作区快照：仅当确实发生变化时才重载卡片自持数据
        const before = snapshotWorkingTree(scheduler, p.id)
        await handleRefreshWorkingTree(p.id)
        const after = snapshotWorkingTree(scheduler, p.id)
        // 无条件标脏 log/branches/stash 会让每次「刷新」都白跑 3+ 次 git 子进程
        // （每次调用固定约 210ms 进程费，与命令本身无关）。
        // 绝大多数刷新是「网络 fetch 后确认无变化」，此时这些域的数据必然未变，重载纯属浪费。
        // 判定依据取工作区快照 + 分支名：两者覆盖了提交、暂存、切换分支、stash 等全部会改动这些域的本地操作。
        if (workingTreeChanged(before, after)) {
          bumpCardRefresh(p.id, "log", "branches", "stash")
        }
      })
    } finally {
      refreshing.value = null
    }
  }

  // ---- 细分刷新操作 ----

  async function handleRefreshWorkingTree(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    await withRecordLoading(refreshingWorkingTree, id, async () => {
      // 分支名经调度器缓存复用，避免每次刷新都重新 rev-parse
      const branch = await scheduler.resolveBranch(id)
      await scheduler.loadWorkingTree(id, { branch, force: true })
    })
  }

  async function handleRefreshRemoteStatus(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    await withRecordLoading(remoteStatusLoading, id, async () => {
      // 与 handleFetchAll 共用同一单飞管线且不传 force：同时触发两者只产生一轮网络 fetch
      await scheduler.refreshRemote(id)
    })
  }

  /** Fetch 所有远程 + 刷新状态（与 handleRefreshRemoteStatus 共用调度器单飞管线） */
  async function handleFetchAll(id: string) {
    await withRecordLoading(fetching, id, async () => {
      try {
        await scheduler.refreshRemote(id)
      } catch (e: unknown) {
        showMessage(getErrorMessage(e) || tf("fetchFailed"), 5000, "error")
      }
    })
  }

  return {
    refreshing,
    fetching,
    remoteStatusLoading,
    refreshingWorkingTree,
    handleRefresh,
    handleRefreshWorkingTree,
    handleRefreshRemoteStatus,
    handleFetchAll,
  }
}
