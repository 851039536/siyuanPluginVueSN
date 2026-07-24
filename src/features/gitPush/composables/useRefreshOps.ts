// Git 刷新操作集群（单项/工作区/日志/标签/远程 + 全局刷新与 fetch）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { GitProject, GitPushManager } from "../types"
import { resolveValidPath } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"

/** 步骤上下文：测量并记录每个 git 操作的耗时 */
interface StepCtx {
  step: <R>(name: string, fn: () => Promise<R>) => Promise<R>
}
/** runBatchWithProgress 的类型（由 index.vue 注入） */
type RunBatch = <T>(
  items: T[],
  label: string,
  fn: (item: T, ctx: StepCtx) => Promise<void>,
  getName?: (item: T) => string,
  options?: { keepVisible?: boolean },
) => Promise<void>

/** 全局刷新防抖冷却时间（毫秒） */
const REFRESH_COOLDOWN_MS = 500

export function useRefreshOps(deps: {
  manager: GitPushManager
  projects: Ref<GitProject[]>
  activeCategory: Ref<string>
  gitOpsPaused: Ref<boolean>
  runBatchWithProgress: RunBatch
  tf: (key: string, fallback: string, ...args: (string | number)[]) => string
  commitLogLoading: Ref<Record<string, boolean>>
  tagLoading: Ref<Record<string, boolean>>
  loadProjectGitStatus: (id: string, skipRefresh?: boolean) => Promise<void>
  loadPushStatus: (id: string, opts?: { fetchFirst?: boolean, branch?: string }) => Promise<void>
  loadWorkingTree: (id: string, skipRefresh?: boolean, branch?: string) => Promise<void>
  loadCommitLog: (id: string, count?: number) => Promise<void>
  loadBranches: (id: string) => Promise<void>
  loadStashList: (id: string) => Promise<void>
  loadTags: (id: string) => Promise<unknown>
  refreshRemotes: (id: string) => Promise<unknown>
  fetchAllRemotes: (id: string) => Promise<unknown>
}) {
  const {
    manager, projects, activeCategory, gitOpsPaused, runBatchWithProgress, tf,
    commitLogLoading, tagLoading,
    loadProjectGitStatus, loadPushStatus, loadWorkingTree, loadCommitLog,
    loadBranches, loadStashList, loadTags, refreshRemotes, fetchAllRemotes,
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
  /** 工作区刷新加载中 id → true */
  const workingTreeLoading = ref<Record<string, boolean>>({})
  /** 远程状态刷新加载中 id → true */
  const remoteStatusLoading = ref<Record<string, boolean>>({})
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

    await runBatchWithProgress(projList, tf("refreshingLabel", "刷新中"), async (p, ctx) => {
      const prev = headHashes.value[p.id] || ""
      const [, curr] = await Promise.all([
        ctx.step(tf("stepStatus", "状态"), () => loadProjectGitStatus(p.id, true)),
        ctx.step(tf("stepHead", "HEAD"), () => manager.getHeadHash(resolveValidPath(p))),
      ])

      if (curr && curr !== prev) {
        headHashes.value[p.id] = curr
        await Promise.all([
          ctx.step(tf("stepLog", "日志"), () => loadCommitLog(p.id)),
          ctx.step(tf("stepBranch", "分支"), () => loadBranches(p.id)),
          ctx.step(tf("stepStash", "Stash"), () => loadStashList(p.id)),
        ])
      } else if (curr) {
        await ctx.step(tf("stepStash", "Stash"), () => loadStashList(p.id))
      }
    }, undefined, { keepVisible })
  }

  async function handleRefresh(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    refreshing.value = id
    try {
      await runBatchWithProgress([project], tf("refreshingLabel", "刷新中"), async (p, ctx) => {
        // 一次 rev-parse 获取 branch，六项操作全部并行（git 信号量自动限流到 3）
        const cwd = resolveValidPath(p)
        const branch = await manager.getBranch(cwd)
        await Promise.all([
          ctx.step(tf("stepRemote", "远程"), () => refreshRemotes(p.id)),
          ctx.step(tf("stepPush", "推送"), () => loadPushStatus(p.id, { fetchFirst: true, branch })),
          ctx.step(tf("stepWorkingTree", "工作区"), () => loadWorkingTree(p.id, false, branch)),
          ctx.step(tf("stepLog", "日志"), () => loadCommitLog(p.id)),
          ctx.step(tf("stepBranch", "分支"), () => loadBranches(p.id)),
          ctx.step(tf("stepStash", "Stash"), () => loadStashList(p.id)),
        ])
      }, (p) => p.name, { keepVisible: true })
    } finally {
      refreshing.value = null
    }
  }

  // ---- 细分刷新操作 ----

  async function handleRefreshWorkingTree(id: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    workingTreeLoading.value = { ...workingTreeLoading.value, [id]: true }
    try {
      const branch = await manager.getBranch(resolveValidPath(project))
      await loadWorkingTree(id, false, branch)
    } finally {
      delete workingTreeLoading.value[id]
      workingTreeLoading.value = { ...workingTreeLoading.value }
    }
  }

  async function handleRefreshCommitLog(id: string) {
    commitLogLoading.value = { ...commitLogLoading.value, [id]: true }
    try {
      await loadCommitLog(id)
    } finally {
      delete commitLogLoading.value[id]
      commitLogLoading.value = { ...commitLogLoading.value }
    }
  }

  async function handleRefreshTags(id: string) {
    tagLoading.value = { ...tagLoading.value, [id]: true }
    try {
      await loadTags(id)
    } finally {
      delete tagLoading.value[id]
      tagLoading.value = { ...tagLoading.value }
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
      await runBatchWithProgress(projList, tf("fetchAll", "更新远程状态"), async (p) => {
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
      showMessage(getErrorMessage(e) || tf("fetchFailed", "Fetch 失败"), 5000, "error")
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
    workingTreeLoading,
    remoteStatusLoading,
    headHashes,
    silentRefreshAll,
    handleRefresh,
    handleRefreshWorkingTree,
    handleRefreshCommitLog,
    handleRefreshTags,
    handleRefreshRemoteStatus,
    handleRefreshAll,
    handleRefreshAllLocal,
    handleRefreshAllRemote,
    handleFetchAll,
  }
}
