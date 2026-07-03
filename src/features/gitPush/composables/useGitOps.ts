// Git 底层操作封装（push/pull/fetch/commit）
// Git 底层操作封装（push/pull/fetch/commit）
// Git 底层操作封装（push/pull/fetch/commit）
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
  /** 提交输出 */
  const commitOutputs = ref<Record<string, string>>({})
  /** Stash 条目缓存 */
  const stashEntries = ref<Record<string, StashEntry[]>>({})
  /** Stash 操作加载中 */
  const stashLoading = ref<Record<string, boolean>>({})

  /** 检查是否有推送进行中 */
  function isPushing(projectId: string, target?: string): boolean {
    const prog = pushProgress.value[projectId]
    if (!prog) return false
    if (target) {
      if (target === "all") {
        return Object.values(prog).some((s) => s === "pushing" || s === "pending")
      }
      return prog[target] === "pushing" || prog[target] === "pending"
    }
    return Object.values(prog).some((s) => s === "pushing" || s === "pending")
  }

  /** 获取指定项目指定远程的推送进度 */
  function getPushStatus(projectId: string, target: PlatformKey): ProgressStatus {
    return pushProgress.value[projectId]?.[target] ?? "pending"
  }

  /** 检查是否有拉取进行中 */
  function isPulling(projectId: string, target?: string): boolean {
    const prog = pullProgress.value[projectId]
    if (!prog) return false
    if (target) {
      if (target === "all") {
        return Object.values(prog).some((s) => s === "pushing" || s === "pending")
      }
      return prog[target] === "pushing" || prog[target] === "pending"
    }
    return Object.values(prog).some((s) => s === "pushing" || s === "pending")
  }

  /** 获取指定项目指定远程的拉取进度 */
  function getPullStatus(projectId: string, target: PlatformKey): ProgressStatus {
    return pullProgress.value[projectId]?.[target] ?? "pending"
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

  // ── 推送/拉取 ──
  async function pushToAll(id: string) {
    // 初始化进度：标记所有已配置远程为 pending
    const project = findProject(projects, id)
    const initProg: Record<string, ProgressStatus> = {}
    if (project) {
      for (const pm of PLATFORM_META) {
        const remoteName = project[pm.remoteProp]
        if (remoteName) { initProg[pm.key] = "pending" }
      }
    }
    pushProgress.value[id] = initProg

    try {
      // 设置各远程为 pushing
      const startedAt: Record<string, number> = {}
      const durations: Record<string, number> = {}
      for (const key of Object.keys(initProg)) {
        pushProgress.value = {
          ...pushProgress.value,
          [id]: {
            ...pushProgress.value[id],
            [key]: "pushing",
          },
        }
        startedAt[key] = Date.now()
      }

      const result = await manager.pushToAll(id)

      // 计算耗时并更新状态
      for (const pm of PLATFORM_META) {
        const key = pm.key
        if (!initProg[key]) continue
        durations[key] = Date.now() - (startedAt[key] || Date.now())
        const r = result[key] as any
        pushProgress.value = {
          ...pushProgress.value,
          [id]: {
            ...pushProgress.value[id],
            [key]: r?.ok ? "ok" : "fail",
          },
        }
      }

      pushOutputs.value[id] = buildOutputEntries(result, durations, getUsedPath(id))
      pruneRecordCache(pushOutputs)
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } catch {
      // 异常情况：所有待处理远程标记 fail
      const failProg: Record<string, ProgressStatus> = {}
      for (const key of Object.keys(initProg)) { failProg[key] = "fail" }
      pushProgress.value = {
        ...pushProgress.value,
        [id]: failProg,
      }
    } finally {
      // 延迟清理进度（让 UI 显示最终状态 3 秒）
      setTimeout(() => {
        const current = { ...pushProgress.value }
        delete current[id]
        pushProgress.value = current
      }, 3000)
    }
  }

  async function pushSingle(id: string, target: PlatformKey) {
    pushProgress.value = {
      ...pushProgress.value,
      [id]: {
        ...pushProgress.value[id],
        [target]: "pushing",
      },
    }
    const startedAt = Date.now()
    try {
      const result = await manager.pushSingle(id, target)
      const duration = Date.now() - startedAt
      pushProgress.value = {
        ...pushProgress.value,
        [id]: {
          ...pushProgress.value[id],
          [target]: result.ok ? "ok" : "fail",
        },
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
      pushOutputs.value[id] = entries
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } finally {
      setTimeout(() => {
        const current = { ...pushProgress.value }
        delete current[id]
        pushProgress.value = current
      }, 3000)
    }
  }

  async function pullToAll(id: string) {
    const project = findProject(projects, id)
    const initProg: Record<string, ProgressStatus> = {}
    if (project) {
      for (const pm of PLATFORM_META) {
        const remoteName = project[pm.remoteProp]
        if (remoteName) { initProg[pm.key] = "pending" }
      }
    }
    pullProgress.value[id] = initProg

    try {
      const startedAt: Record<string, number> = {}
      const durations: Record<string, number> = {}
      for (const key of Object.keys(initProg)) {
        pullProgress.value = {
          ...pullProgress.value,
          [id]: {
            ...pullProgress.value[id],
            [key]: "pushing",
          },
        }
        startedAt[key] = Date.now()
      }

      const result = await manager.pullToAll(id)

      for (const pm of PLATFORM_META) {
        const key = pm.key
        if (!initProg[key]) continue
        durations[key] = Date.now() - (startedAt[key] || Date.now())
        const r = result[key] as any
        pullProgress.value = {
          ...pullProgress.value,
          [id]: {
            ...pullProgress.value[id],
            [key]: r?.ok ? "ok" : "fail",
          },
        }
      }

      pullOutputs.value[id] = buildOutputEntries(result, durations, getUsedPath(id))
      pruneRecordCache(pullOutputs)
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } catch {
      const failProg: Record<string, ProgressStatus> = {}
      for (const key of Object.keys(initProg)) { failProg[key] = "fail" }
      pullProgress.value = {
        ...pullProgress.value,
        [id]: failProg,
      }
    } finally {
      setTimeout(() => {
        const current = { ...pullProgress.value }
        delete current[id]
        pullProgress.value = current
      }, 3000)
    }
  }

  async function pullSingle(id: string, target: PlatformKey) {
    pullProgress.value = {
      ...pullProgress.value,
      [id]: {
        ...pullProgress.value[id],
        [target]: "pushing",
      },
    }
    const startedAt = Date.now()
    try {
      const result = await manager.pullSingle(id, target)
      const duration = Date.now() - startedAt
      pullProgress.value = {
        ...pullProgress.value,
        [id]: {
          ...pullProgress.value[id],
          [target]: result.ok ? "ok" : "fail",
        },
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
      pullOutputs.value[id] = entries
      loadPushStatus(id).catch((e) => console.warn("[gitPush] 刷新推送状态失败:", e?.message || e))
      return result
    } finally {
      setTimeout(() => {
        const current = { ...pullProgress.value }
        delete current[id]
        pullProgress.value = current
      }, 3000)
    }
  }

  /** 取消推送 */
  function cancelPush(id: string) {
    manager.cancelOp(id)
  }

  /** 取消拉取 */
  function cancelPull(id: string) {
    manager.cancelOp(id)
  }

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

  return {
    pushProgress,
    getPushStatus,
    isPushing,
    pushOutputs,
    entriesToText,
    pullProgress,
    getPullStatus,
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
  }
}
