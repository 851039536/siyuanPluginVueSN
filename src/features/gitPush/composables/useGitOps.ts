// Git 底层操作封装（push/pull/fetch/commit/stash/tag）
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
import { onUnmounted, ref } from "vue"
import { PLATFORM_META } from "../types"
import {
  findProject,
  pruneRecordCache,
  resolveValidPath,
} from "../utils"

/** 推送/拉取进度项 */
export interface PushOutputEntry {
  platform: PlatformKey
  label: string
  ok: boolean
  skipped: boolean
  duration: number
  summary: string
  fullStdout: string
  fullStderr: string
}

type ProgressStatus = "pending" | "pushing" | "ok" | "fail"

export function useGitOps(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 推送进度：projectId → platformKey → status */
  const pushProgress = ref<Record<string, Record<string, ProgressStatus>>>({})
  /** 推送结构化输出 */
  const pushOutputs = ref<Record<string, PushOutputEntry[]>>({})
  /** 拉取进度 */
  const pullProgress = ref<Record<string, Record<string, ProgressStatus>>>({})
  /** 拉取结构化输出 */
  const pullOutputs = ref<Record<string, PushOutputEntry[]>>({})
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

  /** 待清理的 setTimeout ID，组件卸载时统一 clearTimeout */
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

  /** 创建可追踪的超时，回调执行后自动清理，onUnmounted 时强制清除 */
  function safeTimeout(fn: () => void, delay: number) {
    const id = setTimeout(() => {
      pendingTimers.delete(id)
      fn()
    }, delay)
    pendingTimers.add(id)
    return id
  }

  /** 通用操作进度检查（isPushing / isPulling 共用实现） */
  function isOpInProgress(progressRef: ProgressRef, projectId: string, target?: string): boolean {
    const prog = progressRef.value[projectId]
    if (!prog) return false
    if (target) {
      if (target === "all") {
        return Object.values(prog).some((s) => s === "pushing" || s === "pending")
      }
      return prog[target] === "pushing" || prog[target] === "pending"
    }
    return Object.values(prog).some((s) => s === "pushing" || s === "pending")
  }

  function isPushing(projectId: string, target?: string): boolean {
    return isOpInProgress(pushProgress, projectId, target)
  }

  /** 获取指定项目指定远程的推送进度 */
  function getPushStatus(projectId: string, target: PlatformKey): ProgressStatus {
    return pushProgress.value[projectId]?.[target] ?? "pending"
  }

  function isPulling(projectId: string, target?: string): boolean {
    return isOpInProgress(pullProgress, projectId, target)
  }

  // ── 工具函数 ──

  /**
   * 将 AllPlatformResult 转换为结构化 PushOutputEntry[]
   */
  function buildOutputEntries(
    result: Record<string, any>,
    durations: Record<string, number>,
    usedPath?: string,
  ): PushOutputEntry[] {
    const entries: PushOutputEntry[] = []
    for (const pm of PLATFORM_META) {
      const r = result[pm.key] as any
      if (!r) continue
      entries.push({
        platform: pm.key,
        label: pm.label,
        ok: r.ok ?? false,
        skipped: r.skipped ?? false,
        duration: durations[pm.key] ?? 0,
        summary: r.ok
          ? (r.stdout?.split("\n")?.[0]?.trim() || "OK")
          : (r.stderr?.split("\n")?.[0]?.trim() || "失败"),
        fullStdout: r.stdout ?? "",
        fullStderr: r.stderr ?? "",
      })
    }
    if (usedPath) {
      // 路径信息附加在最后一个条目或新条目
      const last = entries[entries.length - 1]
      if (last) {
        last.fullStdout += `\n\n[使用本地路径: ${usedPath}]`
      }
    }
    return entries
  }

  /** 从输出条目生成纯文本（用于复制） */
  function entriesToText(entries?: PushOutputEntry[]): string {
    if (!entries) return ""
    const lines: string[] = []
    for (const e of entries) {
      lines.push(`[${e.label}] ${e.ok ? "成功" : e.skipped ? "已跳过" : "失败"} (${e.duration}ms)`)
      if (e.fullStdout) lines.push(e.fullStdout)
      if (e.fullStderr) lines.push(`错误: ${e.fullStderr}`)
    }
    return lines.join("\n")
  }

  /** 获取项目有效路径并生成路径提示信息 */
  function getUsedPath(id: string): string | undefined {
    const project = findProject(projects, id)
    if (!project) return undefined
    return resolveValidPath(project)
  }

  // ── 通用推送/拉取实现（pushToAll 与 pullToAll 消除 60 行重复） ──
  type ProgressRef = Ref<Record<string, Record<string, ProgressStatus>>>
  type OutputsRef = Ref<Record<string, PushOutputEntry[]>>

  /** 通用全平台 remote 操作（pushToAll / pullToAll 共用实现） */
  async function remoteOpAll(
    action: "push" | "pull", progressRef: ProgressRef, outputsRef: OutputsRef,
    managerFn: (id: string) => Promise<Record<string, any>>, id: string,
  ) {
    const project = findProject(projects, id)
    const initProg: Record<string, ProgressStatus> = {}
    if (project) {
      for (const pm of PLATFORM_META) {
        const remoteName = project[pm.remoteProp]
        if (remoteName) { initProg[pm.key] = "pending" }
      }
    }
    progressRef.value[id] = initProg

    try {
      // duration 为全平台总耗时（managerFn 内部串行/并行执行各平台，外层无法精确测量单平台耗时）
      const totalStart = Date.now()
      for (const key of Object.keys(initProg)) {
        progressRef.value = {
          ...progressRef.value,
          [id]: { ...progressRef.value[id], [key]: "pushing" },
        }
      }

      const result = await managerFn(id)

      const totalDuration = Date.now() - totalStart
      for (const pm of PLATFORM_META) {
        const key = pm.key
        if (!initProg[key]) continue
        const r = result[key] as any
        progressRef.value = {
          ...progressRef.value,
          [id]: { ...progressRef.value[id], [key]: r?.ok ? "ok" : "fail" },
        }
      }

      // 所有平台共享总耗时
      const sharedDurations: Record<string, number> = {}
      for (const key of Object.keys(initProg)) { sharedDurations[key] = totalDuration }
      outputsRef.value[id] = buildOutputEntries(result, sharedDurations, getUsedPath(id))
      pruneRecordCache(outputsRef.value)
      loadPushStatus(id).catch((e) => console.warn(`[gitPush] 刷新${action === "push" ? "推送" : "拉取"}状态失败:`, e?.message || e))
      return result
    } catch (e) {
      console.error(`[gitPush] ${action === "push" ? "推送" : "拉取"}失败:`, e)
      const failProg: Record<string, ProgressStatus> = {}
      for (const key of Object.keys(initProg)) { failProg[key] = "fail" }
      progressRef.value = { ...progressRef.value, [id]: failProg }
    } finally {
      safeTimeout(() => {
        const current = { ...progressRef.value }
        delete current[id]
        progressRef.value = current
      }, 3000)
    }
  }

  /** 通用单平台 remote 操作（pushSingle / pullSingle 共用实现） */
  async function remoteOpSingle(
    action: "push" | "pull", progressRef: ProgressRef, outputsRef: OutputsRef,
    managerFn: (id: string, target: PlatformKey) => Promise<{ ok: boolean, stdout: string, stderr: string }>,
    id: string, target: PlatformKey,
  ) {
    progressRef.value = {
      ...progressRef.value,
      [id]: { ...progressRef.value[id], [target]: "pushing" },
    }
    const startedAt = Date.now()
    try {
      const result = await managerFn(id, target)
      const duration = Date.now() - startedAt
      progressRef.value = {
        ...progressRef.value,
        [id]: { ...progressRef.value[id], [target]: result.ok ? "ok" : "fail" },
      }

      const pm = PLATFORM_META.find((m) => m.key === target)
      const entries: PushOutputEntry[] = [{
        platform: target,
        label: pm?.label ?? target,
        ok: result.ok,
        skipped: false,
        duration,
        summary: result.ok
          ? (result.stdout?.split("\n")?.[0]?.trim() || "OK")
          : (result.stderr?.split("\n")?.[0]?.trim() || "失败"),
        fullStdout: result.stdout,
        fullStderr: result.stderr,
      }]
      outputsRef.value[id] = entries
      pruneRecordCache(outputsRef.value)
      loadPushStatus(id).catch((e) => console.warn(`[gitPush] 刷新${action === "push" ? "推送" : "拉取"}状态失败:`, e?.message || e))
      return result
    } finally {
      safeTimeout(() => {
        const current = { ...progressRef.value }
        delete current[id]
        progressRef.value = current
      }, 3000)
    }
  }

  // ── 公开推送/拉取（委托通用实现） ──
  function pushToAll(id: string) {
    return remoteOpAll("push", pushProgress, pushOutputs, manager.pushToAll.bind(manager), id)
  }
  function pushSingle(id: string, target: PlatformKey) {
    return remoteOpSingle("push", pushProgress, pushOutputs, manager.pushSingle.bind(manager), id, target)
  }
  function pullToAll(id: string) {
    return remoteOpAll("pull", pullProgress, pullOutputs, manager.pullToAll.bind(manager), id)
  }
  function pullSingle(id: string, target: PlatformKey) {
    return remoteOpSingle("pull", pullProgress, pullOutputs, manager.pullSingle.bind(manager), id, target)
  }

  /** 取消操作（区分 push/pull） */
  function cancelPush(id: string) { manager.cancelOp(id, "push") }
  function cancelPull(id: string) { manager.cancelOp(id, "pull") }

  /** Fetch 所有已配置远程（仅更新跟踪分支，不合并代码）+ 刷新推送状态 */
  async function fetchAllRemotes(id: string) {
    const result = await manager.fetchAllForProject(id)
    await loadPushStatus(id)
    return result
  }

  async function loadPushStatus(id: string, opts?: { branch?: string, fetchFirst?: boolean }) {
    pushStatuses.value[id] = await manager.checkPushStatus(id, opts
      ? {
          branch: opts.branch,
          fetchFirst: opts.fetchFirst,
        }
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

  /**
   * 合并加载 pushStatus + workingTree：一次 rev-parse HEAD 共享给两个子调用。
   * 消除 checkPushStatus 与 getWorkingTreeStatus 各自执行 rev-parse 的浪费。
   * @param skipRefresh 是否跳过 update-index --refresh（首屏/静默刷新时传 true）
   */
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
    if (!project) { return {
      message: "chore: update files",
      source: "heuristic",
    } }
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

  // ── 缓存清理 ──

  /** 项目删除时清理其所有缓存条目，避免陈旧数据残留 */
  function clearProjectCache(id: string) {
    const caches: Record<string, any>[] = [
      pushStatuses.value,
      workingTrees.value,
      commitLogs.value,
      branches.value,
      stashEntries.value,
      pushOutputs.value,
      pullOutputs.value,
    ]
    for (const cache of caches) {
      delete cache[id]
    }
    // fileDiffs 键格式为 "id::staged::file"，需按前缀过滤删除
    const prefix = `${id}::`
    for (const key of Object.keys(fileDiffs.value)) {
      if (key.startsWith(prefix)) { delete fileDiffs.value[key] }
    }
    pruneRecordCache(fileDiffs.value, 50)
  }

  onUnmounted(() => {
    pendingTimers.forEach(clearTimeout)
    pendingTimers.clear()
  })

  return {
    pushProgress,
    getPushStatus,
    isPushing,
    pushOutputs,
    entriesToText,
    pullProgress,
    isPulling,
    pullOutputs,
    pushStatuses,
    workingTrees,
    fileDiffs,
    committing,
    commitLogs,
    branches,
    stashEntries,
    stashLoading,
    loadPushStatus,
    loadWorkingTree,
    loadProjectGitStatus,
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
    cancelPush,
    cancelPull,
    loadStashList,
    doStashSave,
    doStashPop,
    doStashApply,
    doStashDrop,
    generateStashDesc,
    addRemoteOp,
    removeRemoteOp,
    editRemoteOp,
    fetchAllRemotes,
    clearProjectCache,
  }
}
