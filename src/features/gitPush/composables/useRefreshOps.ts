// Git 刷新操作集群（单项/工作区/远程/fetch；日志/标签刷新已下沉卡片）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { CardDataDomain, GitProject, GitPushManager } from "../types"
import type { RunBatch } from "./useBatchProgress"
import { findProject, resolveValidPath, acquireFlag, releaseFlag } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"

export function useRefreshOps(deps: {
  manager: GitPushManager
  projects: Ref<GitProject[]>
  runBatchWithProgress: RunBatch
  tf: (key: string, ...args: (string | number)[]) => string
  /** 按域通知卡片重载自持数据（log/branches/stash 已下沉 ProjectCard） */
  bumpCardRefresh: (id: string, ...domains: CardDataDomain[]) => void
  loadPushStatus: (id: string, opts?: { fetchFirst?: boolean, branch?: string }) => Promise<void>
  loadWorkingTree: (id: string, branch?: string) => Promise<void>
  refreshRemotes: (id: string) => Promise<unknown>
  fetchAllRemotes: (id: string) => Promise<unknown>
}) {
  const {
    manager, projects, runBatchWithProgress, tf,
    bumpCardRefresh,
    loadPushStatus, loadWorkingTree,
    refreshRemotes, fetchAllRemotes,
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
    loadingRef: Ref<Record<string, number>>, id: string, fn: () => Promise<void>,
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
        // 一次 rev-parse 获取 branch；先刷新远程配置再并行加载状态，
        // 避免 loadPushStatus(fetchFirst) 用陈旧的远程名 fetch（refreshRemotes 与状态读取竞态）
        const cwd = resolveValidPath(p)
        const branch = await manager.getBranch(cwd)
        await refreshRemotes(p.id)
        await Promise.all([
          loadPushStatus(p.id, { fetchFirst: true, branch }),
          loadWorkingTree(p.id, branch),
        ])
        // 日志/分支/stash 已下沉卡片，按域通知重载
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
      const branch = await manager.getBranch(resolveValidPath(project))
      await loadWorkingTree(id, branch)
    })
  }

  async function handleRefreshRemoteStatus(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    await withRecordLoading(remoteStatusLoading, id, async () => {
      const branch = await manager.getBranch(resolveValidPath(project))
      // 先刷新远程配置再加载状态，避免 loadPushStatus(fetchFirst) 用陈旧的远程名 fetch（与 handleRefresh 同一致竞态）
      await refreshRemotes(id)
      await loadPushStatus(id, { fetchFirst: true, branch })
    })
  }

  /** Fetch 所有远程 + 刷新状态 */
  async function handleFetchAll(id: string) {
    await withRecordLoading(fetching, id, async () => {
      try {
        await fetchAllRemotes(id)
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
