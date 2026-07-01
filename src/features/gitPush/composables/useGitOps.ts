import type { Ref } from "vue"
import type {
  BranchInfo,
  CommitLogEntry,
  GitProject,
  GitPushManager,
  PlatformKey,
  PushStatusInfo,
  StashEntry,
  WorkingTreeInfo,
} from "../types"
import { ref } from "vue"
import { PLATFORM_META } from "../types"
import { findProject, pruneRecordCache, resolveValidPath } from "../utils"

export function useGitOps(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 正在推送的项目 id → platformKey|"all" */
  const pushingRemote = ref<Record<string, string>>({})
  const pushOutputs = ref<Record<string, string>>({})
  /** 正在拉取的项目 id → platformKey|"all" */
  const pullingRemote = ref<Record<string, string>>({})
  const pullOutputs = ref<Record<string, string>>({})
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
  /** 提交输出 */
  const commitOutputs = ref<Record<string, string>>({})
  /** Stash 条目缓存 */
  const stashEntries = ref<Record<string, StashEntry[]>>({})
  /** Stash 操作加载中 */
  const stashLoading = ref<Record<string, boolean>>({})

  function isPushing(projectId: string, target?: string): boolean {
    const v = pushingRemote.value[projectId]
    if (!v) return false
    if (target) return v === target
    return true
  }

  function isPulling(projectId: string, target?: string): boolean {
    const v = pullingRemote.value[projectId]
    if (!v) return false
    if (target) return v === target
    return true
  }

  // ── 工具函数 ──
  function formatGitOutput(
    target: Record<string, string>,
    id: string,
    opName: string,
    entries: { label: string, ok: boolean, stdout: string, stderr: string }[],
    usedPath?: string,
  ) {
    const lines: string[] = []
    for (const e of entries) {
      lines.push(`[${e.label}] ${e.ok ? `${opName}成功` : `${opName}失败`}`)
      if (e.stdout) lines.push(e.stdout)
      if (e.stderr) lines.push(`错误: ${e.stderr}`)
    }
    if (usedPath) {
      lines.push(`[使用本地路径: ${usedPath}]`)
    }
    target[id] = lines.join("\n")
    pruneRecordCache(target)
  }

  /** 获取项目有效路径并生成路径提示信息 */
  function getUsedPath(id: string): string | undefined {
    const project = findProject(projects, id)
    if (!project) return undefined
    return resolveValidPath(project)
  }

  function platformLabel(target: string): string {
    return PLATFORM_META.find((pm) => pm.key === target)?.label ?? "Gitea"
  }

  function resultToEntries(result: { [key: string]: any }) {
    return PLATFORM_META
      .filter((pm) => (result[pm.key] as any)?.skipped !== true)
      .map((pm) => ({
        label: pm.label,
        ok: result[pm.key]?.ok ?? false,
        stdout: result[pm.key]?.stdout ?? "",
        stderr: result[pm.key]?.stderr ?? "",
      }))
  }

  // ── 推送/拉取 ──
  async function pushToAll(id: string) {
    pushingRemote.value[id] = "all"
    try {
      const result = await manager.pushToAll(id)
      formatGitOutput(pushOutputs.value, id, "推送", resultToEntries(result), getUsedPath(id))
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pushSingle(id: string, target: PlatformKey) {
    pushingRemote.value[id] = target
    try {
      const result = await manager.pushSingle(id, target)
      formatGitOutput(pushOutputs.value, id, "推送", [{
        label: platformLabel(target), ok: result.ok, stdout: result.stdout, stderr: result.stderr,
      }], getUsedPath(id))
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pullToAll(id: string) {
    pullingRemote.value[id] = "all"
    try {
      const result = await manager.pullToAll(id)
      formatGitOutput(pullOutputs.value, id, "拉取", resultToEntries(result), getUsedPath(id))
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } finally {
      delete pullingRemote.value[id]
    }
  }

  async function pullSingle(id: string, target: PlatformKey) {
    pullingRemote.value[id] = target
    try {
      const result = await manager.pullSingle(id, target)
      formatGitOutput(pullOutputs.value, id, "拉取", [{
        label: platformLabel(target), ok: result.ok, stdout: result.stdout, stderr: result.stderr,
      }], getUsedPath(id))
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } finally {
      delete pullingRemote.value[id]
    }
  }

  async function loadPushStatus(id: string, opts?: { branch?: string }) {
    pushStatuses.value[id] = await manager.checkPushStatus(id, opts ? { branch: opts.branch } : undefined)
  }

  async function loadWorkingTree(id: string, skipRefresh = false, branch?: string) {
    const project = findProject(projects, id)
    if (!project) return
    workingTrees.value[id] = await manager.getWorkingTreeStatus(resolveValidPath(project), { skipRefresh, branch })
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

  async function loadCommitLog(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    const entries = await manager.getCommitLog(resolveValidPath(project))
    commitLogs.value[id] = entries
    const latest = entries[0]?.date
    if (latest && project.lastActivity !== latest) {
      project.lastActivity = latest
      projects.value = [...projects.value]
      manager.recordLastActivity(id, latest).catch(() => {})
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

  // ── 远程操作 ──
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

  return {
    pushingRemote,
    isPushing,
    pushOutputs,
    pullingRemote,
    isPulling,
    pullOutputs,
    pushStatuses,
    workingTrees,
    fileDiffs,
    committing,
    commitLogs,
    branches,
    commitOutputs,
    stashEntries,
    stashLoading,
    loadPushStatus,
    loadWorkingTree,
    loadStatsData,
    loadFileDiff,
    loadCommitLog,
    loadBranches,
    switchBranch,
    stageItem,
    stageAllItems,
    unstageItem,
    unstageAllItems,
    discardFile,
    doCommit,
    generateCommitMsg,
    pushToAll,
    pushSingle,
    pullToAll,
    pullSingle,
    loadStashList,
    doStashSave,
    doStashPop,
    doStashApply,
    doStashDrop,
    generateStashDesc,
    addRemoteOp,
    removeRemoteOp,
    editRemoteOp,
  }
}
