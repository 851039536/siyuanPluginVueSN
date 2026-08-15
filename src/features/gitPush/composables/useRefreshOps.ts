// Git 刷新操作集群（单项/工作区/远程 + 全局刷新与 fetch；日志/标签刷新已下沉卡片）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { CardDataDomain, GitProject, GitPushManager } from "../types"
import type { RunBatch } from "./useBatchProgress"
import { resolveValidPath } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"

/** 全局刷新防抖冷却时间（毫秒） */
const REFRESH_COOLDOWN_MS = 500

export function useRefreshOps(deps: {
  manager: GitPushManager
  projects: Ref<GitProject[]>
  activeCategory: Ref<string>
  gitOpsPaused: Ref<boolean>
  runBatchWithProgress: RunBatch
  tf: (key: string, ...args: (string | number)[]) => string
  /** 按域通知卡片重载自持数据（log/branches/stash 已下沉 ProjectCard） */
  bumpCardRefresh: (id: string, ...domains: CardDataDomain[]) => void
  loadProjectGitStatus: (id: string, skipRefresh?: boolean) => Promise<void>
  loadPushStatus: (id: string, opts?: { fetchFirst?: boolean, branch?: string }) => Promise<void>
  loadWorkingTree: (id: string, skipRefresh?: boolean, branch?: string) => Promise<void>
  refreshRemotes: (id: string) => Promise<unknown>
  fetchAllRemotes: (id: string) => Promise<unknown>
}) {
  const {
    manager, projects, activeCategory, gitOpsPaused, runBatchWithProgress, tf,
    bumpCardRefresh,
    loadProjectGitStatus, loadPushStatus, loadWorkingTree,
    refreshRemotes, fetchAllRemotes,
  } = deps

  const refreshing = ref<string | null>(null)
  const refreshingAll = ref(false)
  /** 本地状态刷新 loading（不 fetch） */
  const refreshingAllLocal = ref(false)
  /** 远程状态刷新 loading（含 fetch） */
  const refreshingAllRemote = ref(false)
  /** Header 刷新下拉菜单开关 */
  const showRefreshMenu = ref(false)
  /** FETCH 操作加载中 id → true */
  const fetching = ref<Record<string, boolean>>({})
  /** 远程状态刷新加载中 id → true */
  const remoteStatusLoading = ref<Record<string, boolean>>({})
  /** 工作区刷新加载中 id → true */
  const refreshingWorkingTree = ref<Record<string, boolean>>({})
  /** HEAD hash 缓存，用于跳过无变动项目的 commit log / branches 刷新 */
  const headHashes = ref<Record<string, string>>({})

  /** 全局刷新防抖时间戳 */
  let allRefreshLastTime = 0
  /** 远程刷新防抖时间戳 */
  let remoteRefreshLastTime = 0

  /** 静默刷新当前分类下的项目状态（批次处理，每批 3 个匹配 git 信号量上限） */
  async function silentRefreshAll(keepVisible = false) {
    if (gitOpsPaused.value) return
    const catId = activeCategory.value
    const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
    if (projList.length === 0) return

    await runBatchWithProgress(projList, tf("refreshingLabel"), async (p, ctx) => {
      const prev = headHashes.value[p.id] || ""
      const [, curr] = await Promise.all([
        ctx.step(tf("stepStatus"), () => loadProjectGitStatus(p.id, true)),
        ctx.step(tf("stepHead"), () => manager.getHeadHash(resolveValidPath(p))),
      ])

      // 日志/分支/stash 已下沉卡片，HEAD 变化时按域通知重载，未变仅刷 stash
      if (curr && curr !== prev) {
        headHashes.value[p.id] = curr
        bumpCardRefresh(p.id, "log", "branches", "stash")
      } else if (curr) {
        bumpCardRefresh(p.id, "stash")
      }
    }, undefined, { keepVisible })
  }

  async function handleRefresh(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    refreshing.value = id
    try {
      await runBatchWithProgress([project], tf("refreshingLabel"), async (p, ctx) => {
        // 一次 rev-parse 获取 branch；先刷新远程配置再并行加载状态，
        // 避免 loadPushStatus(fetchFirst) 用陈旧的远程名 fetch（refreshRemotes 与状态读取竞态）
        const cwd = resolveValidPath(p)
        const branch = await manager.getBranch(cwd)
        await ctx.step(tf("stepRemote"), () => refreshRemotes(p.id))
        await Promise.all([
          ctx.step(tf("stepPush"), () => loadPushStatus(p.id, { fetchFirst: true, branch })),
          ctx.step(tf("stepWorkingTree"), () => loadWorkingTree(p.id, false, branch)),
        ])
        // 日志/分支/stash 已下沉卡片，按域通知重载
        bumpCardRefresh(p.id, "log", "branches", "stash")
      }, (p) => p.name, { keepVisible: true })
    } finally {
      refreshing.value = null
    }
  }

  // ---- 细分刷新操作 ----

  async function handleRefreshWorkingTree(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    refreshingWorkingTree.value = { ...refreshingWorkingTree.value, [id]: true }
    try {
      const branch = await manager.getBranch(resolveValidPath(project))
      await loadWorkingTree(id, false, branch)
    } finally {
      delete refreshingWorkingTree.value[id]
      refreshingWorkingTree.value = { ...refreshingWorkingTree.value }
    }
  }

  async function handleRefreshRemoteStatus(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    remoteStatusLoading.value = { ...remoteStatusLoading.value, [id]: true }
    try {
      const branch = await manager.getBranch(resolveValidPath(project))
      await Promise.all([
        refreshRemotes(id),
        loadPushStatus(id, { fetchFirst: true, branch }),
      ])
    } finally {
      delete remoteStatusLoading.value[id]
      remoteStatusLoading.value = { ...remoteStatusLoading.value }
    }
  }

  async function handleRefreshAll() {
    if (gitOpsPaused.value) return
    // 防抖：全局刷新的冷却期内跳过
    if (Date.now() - allRefreshLastTime < REFRESH_COOLDOWN_MS) return
    allRefreshLastTime = Date.now()
    refreshingAll.value = true
    try {
      await silentRefreshAll(true)
    } finally {
      refreshingAll.value = false
    }
  }

  /** Header 下拉：刷新本地状态（不含 git fetch，快） */
  async function handleRefreshAllLocal() {
    if (gitOpsPaused.value) return
    if (Date.now() - allRefreshLastTime < REFRESH_COOLDOWN_MS) return
    allRefreshLastTime = Date.now()
    showRefreshMenu.value = false
    refreshingAllLocal.value = true
    try {
      await silentRefreshAll(true)
    } finally {
      refreshingAllLocal.value = false
    }
  }

  /** Header 下拉：刷新远程状态（含 git fetch，慢） */
  async function handleRefreshAllRemote() {
    if (gitOpsPaused.value) return
    if (Date.now() - remoteRefreshLastTime < REFRESH_COOLDOWN_MS) return
    remoteRefreshLastTime = Date.now()
    showRefreshMenu.value = false
    refreshingAllRemote.value = true
    try {
      const catId = activeCategory.value
      const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
      if (projList.length === 0) return
      await runBatchWithProgress(projList, tf("fetchAll"), async (p) => {
        await fetchAllRemotes(p.id)
      }, undefined, { keepVisible: true })
    } finally {
      refreshingAllRemote.value = false
    }
  }

  /** Fetch 所有远程 + 刷新状态 */
  async function handleFetchAll(id: string) {
    fetching.value = {
      ...fetching.value,
      [id]: true,
    }
    try {
      await fetchAllRemotes(id)
    } catch (e: unknown) {
      showMessage(getErrorMessage(e) || tf("fetchFailed"), 5000, "error")
    } finally {
      delete fetching.value[id]
      fetching.value = { ...fetching.value }
    }
  }

  return {
    refreshing,
    refreshingAll,
    refreshingAllLocal,
    refreshingAllRemote,
    showRefreshMenu,
    fetching,
    remoteStatusLoading,
    refreshingWorkingTree,
    headHashes,
    silentRefreshAll,
    handleRefresh,
    handleRefreshWorkingTree,
    handleRefreshRemoteStatus,
    handleRefreshAll,
    handleRefreshAllLocal,
    handleRefreshAllRemote,
    handleFetchAll,
  }
}
