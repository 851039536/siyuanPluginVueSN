// Git 底层操作封装（加载/提交/暂存/分支切换；远程推送/拉取已提取到 useRemoteProgress，查询调度已下沉 useProjectQueryScheduler）
import type { Ref } from "vue"
import type {
  DiscardTarget,
  GitProject,
  GitPushManager,
  LoadStatusOptions,
  ProjectQueryKind,
  UndoOutcome,
} from "../types"
import type { CommitMsgResult } from "../managers/CommitMsgGenerator"
import type { PipelineStageKey } from "../types/pipeline"
import type { NumstatEntry } from "../utils"
import { onUnmounted, ref } from "vue"
import {
  findProject,
  requireProject,
  resolveValidPath,
  acquireFlag,
  releaseFlag,
} from "../utils"
import { useRemoteProgress } from "./useRemoteProgress"
import { useOpPipeline } from "./useOpPipeline"
import { useProjectQueryScheduler } from "./useProjectQueryScheduler"
import { COMMIT_STAGE_PLAN, STASH_DROP_STAGE_PLAN, STASH_STAGE_PLAN, SWITCH_STAGE_PLAN } from "../utils/opPipeline"
export type { PushOutputEntry, ProgressStatus } from "./useRemoteProgress"

export function useGitOps(manager: GitPushManager, projects: Ref<GitProject[]>, i18n: Record<string, any>) {
  /** 正在提交的项目 id → true */
  const committing = ref<Record<string, boolean>>({})
  /** Stash 操作加载中（引用计数防并发同类操作先完成者提前清除标志） */
  const stashLoading = ref<Record<string, number>>({})

  // ── 查询调度（单飞/新鲜度/脏标记唯一权威；pushStatuses / workingTrees 由调度器持有）──
  const scheduler = useProjectQueryScheduler(manager, projects)
  const { pushStatuses, workingTrees } = scheduler
  /** 操作流水线（远程真实进度 + 本地真实步骤） */
  const pipeline = useOpPipeline()

  /** 按域标记卡片自持数据为脏，触发卡片重载对应数据（原 cardRefreshSignals 的 push 型信号入口） */
  function bumpCardRefresh(id: string, ...domains: ProjectQueryKind[]) {
    scheduler.invalidate(id, ...domains)
  }

  /** 项目状态补齐（ensure 语义：已有缓存即跳过） */
  function ensureProjectStatus(id: string) {
    return scheduler.loadStatus(id, { mode: "ensure" })
  }

  /**
   * 项目状态显式刷新（refresh 语义 + 最小间隔节流，合并面板内操作与自动刷新的重复触发）。
   * `minIntervalMs` 缺省 2s；卡片挂载时的「进入刷新」传更大值（详细模式下所有卡片都会挂载）。
   */
  function refreshProjectStatus(id: string, opts?: { minIntervalMs?: number }) {
    return scheduler.loadStatus(id, { mode: "refresh", minIntervalMs: opts?.minIntervalMs ?? 2000 })
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
    await pipeline.runLocalPipeline(
      id, "switch", i18n.switchBranch ?? "切换分支", SWITCH_STAGE_PLAN,
      async (stepper) => {
        const project = requireProject(projects, id)
        stepper.step("switchExec", branch)
        await manager.switchBranch(resolveValidPath(project), branch)
        // 分支已切换：写入新分支名，避免后续查询再发一次 rev-parse
        scheduler.setBranch(id, branch)
        stepper.step("refreshState")
        await Promise.all([
          loadWorkingTree(id, { branch }),
          loadPushStatus(id, { branch }),
        ])
        // 提交日志与分支列表已下沉卡片，切换分支后经脏标记通知重载
        stepper.step("reloadViews")
        bumpCardRefresh(id, "log", "branches")
      },
    )
  }

  /** 删除本地分支（force=true 时强制删除未合并分支）；仅需重载卡片分支列表 */
  async function deleteBranch(id: string, branch: string, force = false) {
    const project = requireProject(projects, id)
    await manager.deleteBranch(resolveValidPath(project), branch, force)
    bumpCardRefresh(id, "branches")
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

  /** 暂存区变更规模（numstat）：一键提交据此选择简单/深度生成 */
  async function getStagedOverview(id: string): Promise<Record<string, NumstatEntry> | null> {
    const project = findProject(projects, id)
    if (!project) return null
    return manager.getChangesetOverview(resolveValidPath(project), true)
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

  /** 批量丢弃（全部 / 选中）：一次写锁 + 分组命令，与文件数无关 */
  async function discardFiles(id: string, files: DiscardTarget[]) {
    if (files.length === 0) return
    const project = requireProject(projects, id)
    await manager.discardFiles(resolveValidPath(project), files)
  }

  async function doCommit(id: string, message: string): Promise<string> {
    const project = requireProject(projects, id)
    return pipeline.runLocalPipeline(id, "commit", i18n.commit ?? "提交", COMMIT_STAGE_PLAN, async (stepper) => {
      committing.value[id] = true
      try {
        stepper.step("commitWrite")
        const result = await manager.commit(resolveValidPath(project), message)
        // 立即失效推送状态缓存，防止 loadPushStatus 完成前的智能跳过用到陈旧的 ahead=0
        manager.invalidatePushStatusCache(id)
        // 强制重查推送状态：提交改变了 ahead 计数，ensure 语义会因已有缓存而跳过；
        // 工作区与分支名未变，复用缓存分支名避免再次 rev-parse
        const branch = workingTrees.value[id]?.branch
        stepper.step("refreshState")
        await Promise.all([
          reloadWorkingTreeAfterWrite(id),
          loadPushStatus(id, branch ? { branch, force: true } : { force: true }),
        ])
        return result
      } finally {
        delete committing.value[id]
      }
    })
  }

  /**
   * 撤销上一次写操作（日志驱动）：commit 用 soft 退出提交，merge/reset 用 hard 回到操作前。
   * 成功后与提交同口径刷新工作区/推送状态，并让卡片重载历史与分支。
   */
  async function undoLastOp(id: string): Promise<UndoOutcome> {
    const project = requireProject(projects, id)
    const outcome = await manager.undoLastOp(resolveValidPath(project))
    const branch = workingTrees.value[id]?.branch
    await Promise.all([
      reloadWorkingTreeAfterWrite(id),
      loadPushStatus(id, branch ? { branch, force: true } : { force: true }),
    ])
    bumpCardRefresh(id, "log", "branches", "stash", "reflog", "graph", "branchCompare")
    return outcome
  }

  async function generateCommitMsg(id: string): Promise<CommitMsgResult> {
    const project = findProject(projects, id)
    if (!project) { return { message: "chore: update files", source: "heuristic", fallback: "no-diff" } }
    return manager.generateCommitMessage(resolveValidPath(project))
  }

  /** 深度生成提交信息（读取暂存区完整 diff，输出标题行 + 改动要点） */
  async function deepGenerateCommitMsg(id: string): Promise<CommitMsgResult> {
    const project = findProject(projects, id)
    if (!project) { return { message: "chore: update files", source: "heuristic", fallback: "no-diff" } }
    return manager.generateCommitMessageDeep(resolveValidPath(project))
  }

  // ── Stash 操作 ──

  async function withProjectPathStash(
    id: string,
    fn: (path: string) => Promise<void>,
    opts?: { plan?: readonly PipelineStageKey[], label?: string },
  ) {
    const plan = opts?.plan ?? STASH_STAGE_PLAN
    await pipeline.runLocalPipeline(
      id, "stash", opts?.label ?? i18n.stashSave ?? "暂存变更", plan,
      async (stepper) => {
        acquireFlag(stashLoading.value, id)
        try {
          // 变更类操作统一抛错（而非静默跳过），由调用方的 handleGitOp 展示错误
          const project = requireProject(projects, id)
          stepper.step(plan[0])
          await fn(resolveValidPath(project))
          // Stash 列表已下沉卡片，操作后经脏标记通知重载
          stepper.step(plan[plan.length - 1])
          bumpCardRefresh(id, "stash")
          await reloadWorkingTreeAfterWrite(id)
        } finally {
          releaseFlag(stashLoading.value, id)
        }
      },
    )
  }

  async function doStashSave(id: string, message?: string) {
    await withProjectPathStash(id, (path) => manager.stashSave(path, message), {
      label: i18n.stashSave ?? "暂存变更",
    })
  }

  async function doStashPop(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashPop(path, index), {
      label: i18n.stashRestore ?? "恢复 Stash",
    })
  }

  async function doStashApply(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashApply(path, index), {
      label: i18n.stashApply ?? "应用 Stash",
    })
  }

  async function doStashDrop(id: string, index: number) {
    await withProjectPathStash(id, (path) => manager.stashDrop(path, index), {
      plan: STASH_DROP_STAGE_PLAN,
      label: i18n.stashDropTitle ?? "删除 Stash",
    })
  }

  async function generateStashDesc(id: string): Promise<string> {
    const project = findProject(projects, id)
    if (!project) return ""
    return manager.generateStashDescription(resolveValidPath(project))
  }

  // ── 缓存清理 ──

  /** 删除项目时清理全部关联缓存（含进行中操作标记与远程进度/输出；推送缓存由 manager.removeProject 失效） */
  function clearProjectCache(id: string) {
    scheduler.clearProject(id)
    delete committing.value[id]
    delete stashLoading.value[id]
    remote.clearProject(id)
    pipeline.clearProject(id)
  }

  // ── 远程推送/拉取（委托 useRemoteProgress）──
  const remote = useRemoteProgress(manager, projects, {
    // 推送/拉取改变了 ahead/behind：强制重查，避免复用在飞旧查询
    loadPushStatus: (id: string) => loadPushStatus(id, { force: true }),
    safeTimeout,
    i18n,
    pipeline,
  })

  onUnmounted(() => {
    pendingTimers.forEach(clearTimeout)
    pendingTimers.clear()
    pipeline.dispose()
  })

  return {
    // 远程进度（来自 useRemoteProgress）
    pushProgress: remote.pushProgress,
    getPushStatus: remote.getPushStatus,
    isPushing: remote.isPushing,
    pushOutputs: remote.pushOutputs,
    pullProgress: remote.pullProgress,
    isPulling: remote.isPulling,
    pullOutputs: remote.pullOutputs,
    pushToAll: remote.pushToAll,
    preflightPush: remote.preflightPush,
    forcePushToAll: remote.forcePushToAll,
    pushSingle: remote.pushSingle,
    pullSingle: remote.pullSingle,
    smartPullSingle: remote.smartPullSingle,
    cancelPush: remote.cancelPush,
    clearRemoteOutput: remote.clearOutput,
    // 操作流水线（卡片内阶段动画）
    opPipelines: pipeline.opPipelines,
    globalPipelines: pipeline.globalPipelines,
    allPipelines: pipeline.allPipelines,
    runLocalPipeline: pipeline.runLocalPipeline,
    runGlobalPipeline: pipeline.runGlobalPipeline,
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
    deleteBranch,
    // 工作区
    stageItem,
    stageAllItems,
    getStagedOverview,
    unstageItem,
    unstageAllItems,
    discardFile,
    discardFiles,
    doCommit,
    undoLastOp,
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
  }
}

