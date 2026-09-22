// Git 底层操作封装（加载/提交/暂存/分支切换；远程推送/拉取已提取到 useRemoteProgress，查询调度已下沉 useProjectQueryScheduler）
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  LoadStatusOptions,
  ProjectQueryKind,
} from "../types"
import { onUnmounted, ref } from "vue"
import {
  findProject,
  requireProject,
  resolveValidPath,
  acquireFlag,
  releaseFlag,
} from "../utils"
import { useRemoteProgress } from "./useRemoteProgress"
import { useOpLog } from "./useOpLog"
import { useProjectQueryScheduler } from "./useProjectQueryScheduler"
export type { PushOutputEntry, ProgressStatus } from "./useRemoteProgress"

export function useGitOps(manager: GitPushManager, projects: Ref<GitProject[]>) {
  /** 正在提交的项目 id → true */
  const committing = ref<Record<string, boolean>>({})
  /** Stash 操作加载中（引用计数防并发同类操作先完成者提前清除标志） */
  const stashLoading = ref<Record<string, number>>({})

  // ── 查询调度（单飞/新鲜度/脏标记唯一权威；pushStatuses / workingTrees 由调度器持有）──
  const scheduler = useProjectQueryScheduler(manager, projects)
  const { pushStatuses, workingTrees } = scheduler

  /** 按域标记卡片自持数据为脏，触发卡片重载对应数据（原 cardRefreshSignals 的 push 型信号入口） */
  function bumpCardRefresh(id: string, ...domains: ProjectQueryKind[]) {
    scheduler.invalidate(id, ...domains)
  }

  /** 项目状态补齐（ensure 语义：已有缓存即跳过） */
  function ensureProjectStatus(id: string) {
    return scheduler.loadStatus(id, { mode: "ensure" })
  }

  /** 项目状态显式刷新（refresh 语义 + 2s 最小间隔，合并面板内操作与自动刷新的重复触发） */
  function refreshProjectStatus(id: string) {
    return scheduler.loadStatus(id, { mode: "refresh", minIntervalMs: 2000 })
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

  // ── 加载函数（委托调度器，保持既有调用签名） ──

  function loadPushStatus(id: string, opts?: LoadStatusOptions) {
    return scheduler.loadPushStatus(id, opts)
  }

  function loadWorkingTree(id: string, opts?: LoadStatusOptions) {
    return scheduler.loadWorkingTree(id, opts)
  }

  /** 合并加载 pushStatus + workingTree（共享 rev-parse HEAD，减少子进程调用） */
  function loadProjectGitStatus(id: string) {
    return scheduler.loadStatus(id, { mode: "ensure" })
  }

  /** 统计视图最小数据集（与 loadProjectGitStatus 同语义，合并为调度器单实现） */
  function loadStatsData(id: string) {
    return scheduler.loadStatus(id, { mode: "ensure" })
  }

  async function switchBranch(id: string, branch: string) {
    const project = requireProject(projects, id)
    await manager.switchBranch(resolveValidPath(project), branch)
    // 分支已切换：写入新分支名，避免后续查询再发一次 rev-parse
    scheduler.setBranch(id, branch)
    await Promise.all([
      loadWorkingTree(id, { branch }),
      loadPushStatus(id, { branch }),
    ])
    // 提交日志与分支列表已下沉卡片，切换分支后经脏标记通知重载
    bumpCardRefresh(id, "log", "branches")
  }

  // ── 工作区操作 ──

  /** 变更后重载工作区：复用缓存分支名，避免每次写操作再发一次 rev-parse */
  function reloadWorkingTreeAfterWrite(id: string) {
    const branch = workingTrees.value[id]?.branch
    return loadWorkingTree(id, branch ? { branch } : undefined)
  }

  async function withProjectPath(id: string, fn: (path: string) => Promise<void>) {
    // 变更类操作统一抛错（而非静默跳过），由调用方的 handleGitOp 展示错误
    const project = requireProject(projects, id)
    await fn(resolveValidPath(project))
    await reloadWorkingTreeAfterWrite(id)
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
    const project = requireProject(projects, id)
    await manager.discardFile(resolveValidPath(project), file, staged, status)
  }

  async function doCommit(id: string, message: string): Promise<string> {
    const project = requireProject(projects, id)
    committing.value[id] = true
    try {
      const result = await manager.commit(resolveValidPath(project), message)
      // 立即失效推送状态缓存，防止 loadPushStatus 完成前的智能跳过用到陈旧的 ahead=0
      manager.invalidatePushStatusCache(id)
      // 强制重查推送状态：提交改变了 ahead 计数，ensure 语义会因已有缓存而跳过；
      // 工作区与分支名未变，复用缓存分支名避免再次 rev-parse
      const branch = workingTrees.value[id]?.branch
      await Promise.all([
        reloadWorkingTreeAfterWrite(id),
        loadPushStatus(id, branch ? { branch, force: true } : { force: true }),
      ])
      // 操作日志埋点
      void appendOpLog({
        projectId: id,
        projectName: project.name,
        action: "commit",
        ok: true,
        summary: result.split("\n")[0]?.trim() || "提交成功",
        message,
      })
      return result
    } catch (e: any) {
      // 操作日志埋点：提交失败
      void appendOpLog({
        projectId: id,
        projectName: project.name,
        action: "commit",
        ok: false,
        summary: String(e?.message || e).split("\n")[0]?.trim() || "提交失败",
        message,
      })
      throw e // 原样 rethrow，保持 handleCommit 的现有错误处理不变
    } finally {
      delete committing.value[id]
    }
  }

  async function generateCommitMsg(id: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    const project = findProject(projects, id)
    if (!project) { return { message: "chore: update files", source: "heuristic" } }
    return manager.generateCommitMessage(resolveValidPath(project))
  }

  /** 深度生成提交信息（读取暂存区完整 diff，输出标题行 + 改动要点） */
  async function deepGenerateCommitMsg(id: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    const project = findProject(projects, id)
    if (!project) { return { message: "chore: update files", source: "heuristic" } }
    return manager.generateCommitMessageDeep(resolveValidPath(project))
  }

  // ── Stash 操作 ──

  async function withProjectPathStash(id: string, fn: (path: string) => Promise<void>) {
    acquireFlag(stashLoading.value, id)
    try {
      // 变更类操作统一抛错（而非静默跳过），由调用方的 handleGitOp 展示错误
      const project = requireProject(projects, id)
      await fn(resolveValidPath(project))
      // Stash 列表已下沉卡片，操作后经脏标记通知重载
      bumpCardRefresh(id, "stash")
      await reloadWorkingTreeAfterWrite(id)
    } finally {
      releaseFlag(stashLoading.value, id)
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

  // ── 缓存清理 ──

  /** 删除项目时清理全部关联缓存（含进行中操作标记与远程进度/输出） */
  function clearProjectCache(id: string) {
    scheduler.clearProject(id)
    delete committing.value[id]
    delete stashLoading.value[id]
    remote.clearProject(id)
  }

  // ── 操作日志（实例化后在漏斗处埋点）──
  const { opLogs, ensureOpLogsLoaded, appendOpLog, clearOpLogs, flush: flushOpLogs } = useOpLog(manager)

  // ── 远程推送/拉取（委托 useRemoteProgress）──
  const remote = useRemoteProgress(manager, projects, {
    // 推送/拉取改变了 ahead/behind：强制重查，避免复用在飞旧查询
    loadPushStatus: (id: string) => loadPushStatus(id, { force: true }),
    safeTimeout,
    appendOpLog,
  })

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
    forcePushToAll: remote.forcePushToAll,
    pushSingle: remote.pushSingle,
    pullSingle: remote.pullSingle,
    cancelPush: remote.cancelPush,
    // 本地状态
    pushStatuses,
    workingTrees,
    committing,
    stashLoading,
    // 查询调度器（单飞/新鲜度/脏标记唯一权威，卡片经 provide 注入消费）
    scheduler,
    // 卡片自持数据脏标记（下沉数据的父层写入通道）
    bumpCardRefresh,
    // 加载
    loadPushStatus,
    loadWorkingTree,
    loadProjectGitStatus,
    loadStatsData,
    ensureProjectStatus,
    refreshProjectStatus,
    switchBranch,
    // 工作区
    stageItem,
    stageAllItems,
    unstageItem,
    unstageAllItems,
    discardFile,
    doCommit,
    generateCommitMsg,
    deepGenerateCommitMsg,
    // Stash
    doStashSave,
    doStashPop,
    doStashApply,
    doStashDrop,
    generateStashDesc,
    // 清理
    clearProjectCache,
    // 操作日志
    opLogs,
    ensureOpLogsLoaded,
    clearOpLogs,
    flushOpLogs,
  }
}

