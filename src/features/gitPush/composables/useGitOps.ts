// Git 底层操作封装（加载/提交/暂存/分支切换；远程推送/拉取已提取到 useRemoteProgress）
import type { Ref } from "vue"
import type {
  BranchInfo,
  CommitLogEntry,
  GitProject,
  GitPushManager,
  PushStatusInfo,
  StashEntry,
  WorkingTreeInfo,
} from "../types"
import { onUnmounted, ref } from "vue"
import {
  findProject,
  pruneRecordCache,
  resolveValidPath,
} from "../utils"
import { useRemoteProgress } from "./useRemoteProgress"
export type { PushOutputEntry, ProgressStatus } from "./useRemoteProgress"

export function useGitOps(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 项目推送状态缓存 */
  const pushStatuses = ref<Record<string, PushStatusInfo>>({})
  /** 工作区状态缓存 */
  const workingTrees = ref<Record<string, WorkingTreeInfo>>({})
  /** 文件差异缓存 */
  const fileDiffs = ref<Record<string, string>>({})
  /** 正在提交的项目 id → true */
  const committing = ref<Record<string, boolean>>({})
  /** 提交日志缓存 */
  const commitLogs = ref<Record<string, CommitLogEntry[]>>({})
  /** 分支列表缓存 */
  const branches = ref<Record<string, BranchInfo[]>>({})
  /** Stash 条目缓存 */
  const stashEntries = ref<Record<string, StashEntry[]>>({})
  /** Stash 操作加载中 */
  const stashLoading = ref<Record<string, boolean>>({})

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

  async function loadFileDiff(id: string, file: string, staged: boolean) {
    const project = findProject(projects, id)
    if (!project) return ""
    const key = `${id}::${staged ? "s" : "u"}::${file}`
    const diff = await manager.getFileDiff(resolveValidPath(project), file, staged)
    fileDiffs.value[key] = diff
    return diff
  }

  async function loadCommitLog(id: string, count?: number) {
    const project = findProject(projects, id)
    if (!project) return
    const entries = await manager.getCommitLog(resolveValidPath(project), count)
    commitLogs.value[id] = entries
    const latest = entries[0]?.date
    if (latest) {
      await manager.recordLastActivity(id, latest).catch(() => {})
      if (project.lastActivity !== latest) {
        project.lastActivity = latest
        projects.value = [...projects.value]
      }
    }
  }

  async function loadBranches(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    branches.value[id] = await manager.getBranches(resolveValidPath(project))
  }

  async function switchBranch(id: string, branch: string) {
    const project = findProject(projects, id)
    if (!project) throw new Error("项目未找到")
    await manager.switchBranch(resolveValidPath(project), branch)
    await loadWorkingTree(id)
    await loadPushStatus(id)
    await loadCommitLog(id)
    await loadBranches(id)
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
      await loadStashList(id)
      await loadWorkingTree(id)
    } finally {
      delete stashLoading.value[id]
    }
  }

  async function loadStashList(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    stashEntries.value[id] = await manager.stashList(resolveValidPath(project))
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

  // ── 缓存清理 ──

  function clearProjectCache(id: string) {
    const caches: Record<string, any>[] = [
      pushStatuses.value, workingTrees.value, commitLogs.value,
      branches.value, stashEntries.value,
    ]
    for (const cache of caches) { delete cache[id] }
    const prefix = `${id}::`
    for (const key of Object.keys(fileDiffs.value)) {
      if (key.startsWith(prefix)) { delete fileDiffs.value[key] }
    }
    pruneRecordCache(fileDiffs.value, 50)
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
    fileDiffs,
    committing,
    commitLogs,
    branches,
    stashEntries,
    stashLoading,
    // 加载
    loadPushStatus,
    loadWorkingTree,
    loadProjectGitStatus,
    loadStatsData,
    loadFileDiff,
    loadCommitLog,
    loadBranches,
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
    loadStashList,
    doStashSave,
    doStashPop,
    doStashApply,
    doStashDrop,
    generateStashDesc,
    // 清理
    clearProjectCache,
  }
}

