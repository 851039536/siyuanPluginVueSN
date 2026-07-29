// Git 底层操作封装（加载/提交/暂存/分支切换；远程推送/拉取已提取到 useRemoteProgress）
import type { Ref } from "vue"
import type {
  CardDataDomain,
  CardRefreshSignals,
  GitProject,
  GitPushManager,
  PushStatusInfo,
  WorkingTreeInfo,
} from "../types"
import { onUnmounted, ref } from "vue"
import {
  findProject,
  resolveValidPath,
} from "../utils"
import { useRemoteProgress } from "./useRemoteProgress"
export type { PushOutputEntry, ProgressStatus } from "./useRemoteProgress"

export function useGitOps(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 项目推送状态缓存 */
  const pushStatuses = ref<Record<string, PushStatusInfo>>({})
  /** 工作区状态缓存 */
  const workingTrees = ref<Record<string, WorkingTreeInfo>>({})
  /** 正在提交的项目 id → true */
  const committing = ref<Record<string, boolean>>({})
  /** Stash 操作加载中 */
  const stashLoading = ref<Record<string, boolean>>({})
  /** 卡片自持数据的按域刷新信号（log/branches/stash/tags/conflicts 已下沉 ProjectCard，父层操作后经此通知重载） */
  const cardRefreshSignals = ref<CardRefreshSignals>({})

  /** 按域递增指定项目的刷新信号，触发卡片重载对应数据 */
  function bumpCardRefresh(id: string, ...domains: CardDataDomain[]) {
    const cur = { ...(cardRefreshSignals.value[id] || {}) }
    for (const d of domains) cur[d] = (cur[d] || 0) + 1
    cardRefreshSignals.value = { ...cardRefreshSignals.value, [id]: cur }
  }

  /** 待清理的 setTimeout ID */
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

  /** 创建可追踪的超时 */
  function safeTimeout(fn: () => void, delay: number) {
    const id = setTimeout(() => {
      pendingTimers.delete(id)
      fn()
    }, delay)
    pendingTimers.add(id)
    return id
  }

  // ── 加载函数 ──

  async function loadPushStatus(id: string, opts?: { branch?: string, fetchFirst?: boolean }) {
    pushStatuses.value[id] = await manager.checkPushStatus(id, opts
      ? { branch: opts.branch, fetchFirst: opts.fetchFirst }
      : undefined)
  }

  async function loadWorkingTree(id: string, skipRefresh = false, branch?: string) {
    const project = findProject(projects, id)
    if (!project) return
    workingTrees.value[id] = await manager.getWorkingTreeStatus(resolveValidPath(project), {
      skipRefresh,
      branch,
    })
  }

  /** 合并加载 pushStatus + workingTree（共享 rev-parse HEAD，减少子进程调用） */
  async function loadProjectGitStatus(id: string, skipRefresh = true) {
    const project = findProject(projects, id)
    if (!project) return
    const cwd = resolveValidPath(project)
    const branch = await manager.getBranch(cwd)
    if (!branch) return
    await Promise.all([
      loadPushStatus(id, { branch }),
      loadWorkingTree(id, skipRefresh, branch),
    ])
  }

  async function loadStatsData(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    const cwd = resolveValidPath(project)
    const branch = await manager.getBranch(cwd)
    if (!branch) return
    await Promise.all([
      pushStatuses.value[id] ? Promise.resolve() : loadPushStatus(id, { branch }),
      workingTrees.value[id] ? Promise.resolve() : loadWorkingTree(id, true, branch),
    ])
  }

  async function switchBranch(id: string, branch: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.switchBranch(resolveValidPath(project), branch)
    await loadWorkingTree(id)
    await loadPushStatus(id)
    // 提交日志与分支列表已下沉卡片，切换分支后经信号通知重载
    bumpCardRefresh(id, "log", "branches")
  }

  // ── 工作区操作 ──

  async function withProjectPath(id: string, fn: (path: string) => Promise<void>) {
    const project = findProject(projects, id)
    if (!project) return
    await fn(resolveValidPath(project))
    await loadWorkingTree(id)
  }

  async function stageItem(id: string, file: string) {
    await withProjectPath(id, (path) => manager.stageFile(path, file))
  }

  async function stageAllItems(id: string) {
    await withProjectPath(id, (path) => manager.stageAll(path))
  }

  async function unstageItem(id: string, file: string) {
    await withProjectPath(id, (path) => manager.unstageFile(path, file))
  }

  async function unstageAllItems(id: string) {
    await withProjectPath(id, (path) => manager.unstageAll(path))
  }

  async function discardFile(id: string, file: string, staged: boolean, status: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.discardFile(resolveValidPath(project), file, staged, status)
  }

  async function doCommit(id: string, message: string): Promise<string> {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    committing.value[id] = true
    try {
      const result = await manager.commit(resolveValidPath(project), message)
      // 立即失效推送状态缓存，防止 loadPushStatus 完成前的智能跳过用到陈旧的 ahead=0
      manager.invalidatePushStatusCache(id)
      await loadWorkingTree(id)
      await loadPushStatus(id)
      return result
    } finally {
      delete committing.value[id]
    }
  }

  async function generateCommitMsg(id: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    const project = findProject(projects, id)
    if (!project) { return { message: "chore: update files", source: "heuristic" } }
    return manager.generateCommitMessage(resolveValidPath(project))
  }

  // ── Stash 操作 ──

  async function withProjectPathStash(id: string, fn: (path: string) => Promise<void>) {
    stashLoading.value[id] = true
    try {
      const project = findProject(projects, id)
      if (!project) return
      await fn(resolveValidPath(project))
      // Stash 列表已下沉卡片，操作后经信号通知重载
      bumpCardRefresh(id, "stash")
      await loadWorkingTree(id)
    } finally {
      delete stashLoading.value[id]
    }
  }

  async function doStashSave(id: string, message?: string) {
    await withProjectPathStash(id, (path) => manager.stashSave(path, message))
  }

  async function doStashPop(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashPop(path, index))
  }

  async function doStashApply(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashApply(path, index))
  }

  async function doStashDrop(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashDrop(path, index))
  }

  async function generateStashDesc(id: string): Promise<string> {
    const project = findProject(projects, id)
    if (!project) return ""
    return manager.generateStashDescription(resolveValidPath(project))
  }

  // ── 远程仓库 CRUD ──

  async function addRemoteOp(id: string, name: string, url: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.addRemote(resolveValidPath(project), name, url)
    await loadPushStatus(id)
  }

  async function removeRemoteOp(id: string, name: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.removeRemote(resolveValidPath(project), name)
    await loadPushStatus(id)
  }

  async function editRemoteOp(id: string, name: string, url: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.setRemoteUrl(resolveValidPath(project), name, url)
    await loadPushStatus(id)
  }

  // ── 缓存清理 ──

  function clearProjectCache(id: string) {
    delete pushStatuses.value[id]
    delete workingTrees.value[id]
    delete cardRefreshSignals.value[id]
  }

  // ── 远程推送/拉取（委托 useRemoteProgress）──
  const remote = useRemoteProgress(manager, projects, { loadPushStatus, safeTimeout })

  onUnmounted(() => {
    pendingTimers.forEach(clearTimeout)
    pendingTimers.clear()
  })

  return {
    // 远程进度（来自 useRemoteProgress）
    pushProgress: remote.pushProgress,
    getPushStatus: remote.getPushStatus,
    isPushing: remote.isPushing,
    pushOutputs: remote.pushOutputs,
    entriesToText: remote.entriesToText,
    pullProgress: remote.pullProgress,
    isPulling: remote.isPulling,
    pullOutputs: remote.pullOutputs,
    pushToAll: remote.pushToAll,
    pushSingle: remote.pushSingle,
    pullToAll: remote.pullToAll,
    pullSingle: remote.pullSingle,
    cancelPush: remote.cancelPush,
    cancelPull: remote.cancelPull,
    fetchAllRemotes: remote.fetchAllRemotes,
    // 本地状态
    pushStatuses,
    workingTrees,
    committing,
    stashLoading,
    // 卡片刷新信号（下沉数据的父层写入替代通道）
    cardRefreshSignals,
    bumpCardRefresh,
    // 加载
    loadPushStatus,
    loadWorkingTree,
    loadProjectGitStatus,
    loadStatsData,
    switchBranch,
    // 工作区
    stageItem,
    stageAllItems,
    unstageItem,
    unstageAllItems,
    discardFile,
    doCommit,
    generateCommitMsg,
    // Stash
    doStashSave,
    doStashPop,
    doStashApply,
    doStashDrop,
    generateStashDesc,
    // 远程 CRUD
    addRemoteOp,
    removeRemoteOp,
    editRemoteOp,
    // 清理
    clearProjectCache,
  }
}

