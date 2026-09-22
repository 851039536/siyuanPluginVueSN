// Git 刷新操作集群（单项/工作区/远程；去重与分支复用统一由 useProjectQueryScheduler 承担）
import type { Ref } from "vue"
import type { RunBatch } from "./useBatchProgress"
import type { GitProject, ProjectQueryKind, ProjectQueryScheduler } from "../types"
import { ref } from "vue"
import { showMessage } from "siyuan"
import { getErrorMessage } from "@/utils/stringUtils"
import { acquireFlag, findProject, releaseFlag } from "../utils"

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
        await handleRefreshWorkingTree(p.id)
        // 日志/分支/stash 已下沉卡片，按域标记脏通知重载
        bumpCardRefresh(p.id, "log", "branches", "stash")
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
