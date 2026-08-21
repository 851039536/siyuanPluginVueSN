// 远程推送/拉取进度追踪与结构化输出（从 useGitOps 提取，降低单文件复杂度）
import type { Ref } from "vue"
import type { GitOpAction, GitProject, GitPushManager, PlatformKey, PushOutputEntry } from "../types"
import { ref } from "vue"
import { PLATFORM_META } from "../types"
import { findProject, pruneRecordCache, resolveValidPath } from "../utils"
import type { AppendOpLogInput } from "./useOpLog"

/** 推送/拉取单平台结构化输出（类型定义迁移至 types/storage.ts，此处 re-export 保持向后兼容） */
export type { PushOutputEntry } from "../types"

export type ProgressStatus = "pending" | "pushing" | "ok" | "fail"
type ProgressRef = Ref<Record<string, Record<string, ProgressStatus>>>
type OutputsRef = Ref<Record<string, PushOutputEntry[]>>

/**
 * 远程推送/拉取进度管理 composable
 * 封装 pushToAll / pullToAll / pushSingle / pullSingle 的进度追踪、超时清理、结构化输出
 */
export function useRemoteProgress(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
  opts: {
    loadPushStatus: (id: string) => Promise<void>
    safeTimeout: (fn: () => void, delay: number) => ReturnType<typeof setTimeout>
    /** 操作日志追加回调（fire-and-forget，失败不影响主流程） */
    appendOpLog?: (input: AppendOpLogInput) => void
  },
) {
  const pushProgress = ref<Record<string, Record<string, ProgressStatus>>>({})
  const pushOutputs = ref<Record<string, PushOutputEntry[]>>({})
  const pullProgress = ref<Record<string, Record<string, ProgressStatus>>>({})
  const pullOutputs = ref<Record<string, PushOutputEntry[]>>({})

  // ── 工具函数 ──

  /** 将 AllPlatformResult 转换为结构化 PushOutputEntry[] */
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

  /** 获取项目有效路径 */
  function getUsedPath(id: string): string | undefined {
    const project = findProject(projects, id)
    if (!project) return undefined
    return resolveValidPath(project)
  }

  /** 从 PushOutputEntry[] 构建操作日志条目并追加（不包括 fullStdout/fullStderr） */
  function appendOpLogFromEntries(
    action: string, id: string, projectName: string | undefined, entries?: PushOutputEntry[],
  ) {
    if (!opts.appendOpLog || !entries) return
    const nonSkipped = entries.filter((e) => !e.skipped)
    opts.appendOpLog({
      projectId: id,
      projectName: projectName ?? id,
      action: action as GitOpAction,
      ok: nonSkipped.length > 0 ? nonSkipped.every((e) => e.ok) : true,
      summary: nonSkipped[0]?.summary ?? "操作完成",
      platforms: entries.map((e) => ({
        key: e.platform,
        label: e.label,
        ok: e.ok,
        skipped: e.skipped,
        summary: e.summary,
      })),
    })
  }

  // ── 通用推送/拉取实现 ──

  /** 每项目操作序号（3s 清理时校验，防止清理定时器误删后续操作的进度） */
  const opSeq: Record<string, number> = {}

  /** 递增并返回项目的操作序号 */
  function nextOpSeq(id: string): number {
    opSeq[id] = (opSeq[id] ?? 0) + 1
    return opSeq[id]
  }

  /** 3s 后清理进度显示（仅当期间无新操作时执行） */
  function scheduleProgressCleanup(progressRef: ProgressRef, id: string, seq: number) {
    opts.safeTimeout(() => {
      if (opSeq[id] !== seq) return
      const next = { ...progressRef.value }
      delete next[id]
      progressRef.value = next
    }, 3000)
  }

  /** 通用全平台 remote 操作（pushToAll / pullToAll 共用实现） */
  async function remoteOpAll(
    action: "push" | "pull", progressRef: ProgressRef, outputsRef: OutputsRef,
    managerFn: (id: string) => Promise<Record<string, any>>, id: string,
    oppositeProgressRef?: ProgressRef,
  ) {
    // 入口守卫：同一项目的同类操作进行中时拒绝重复触发（防双击竞态）；
    // 同时拒绝与另一操作（push ↔ pull）并发写同一仓库（UI disabled 之外的后端兜底）
    if (isOpInProgress(progressRef, id) || (oppositeProgressRef && isOpInProgress(oppositeProgressRef, id))) {
      return { success: false }
    }
    const seq = nextOpSeq(id)
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

      const sharedDurations: Record<string, number> = {}
      for (const key of Object.keys(initProg)) { sharedDurations[key] = totalDuration }
      outputsRef.value[id] = buildOutputEntries(result, sharedDurations, getUsedPath(id))
      pruneRecordCache(outputsRef.value)
      opts.loadPushStatus(id).catch((e: any) => console.warn(`[gitPush] 刷新${action === "push" ? "推送" : "拉取"}状态失败:`, e?.message || e))
      // 操作日志埋点（fire-and-forget）
      void appendOpLogFromEntries(action, id, project?.name, outputsRef.value[id])
      return result
    } catch (e) {
      console.error(`[gitPush] ${action === "push" ? "推送" : "拉取"}失败:`, e)
      const failProg: Record<string, ProgressStatus> = {}
      for (const key of Object.keys(initProg)) { failProg[key] = "fail" }
      progressRef.value = { ...progressRef.value, [id]: failProg }
      // 操作日志埋点：失败条目
      void opts.appendOpLog?.({
        projectId: id,
        projectName: project?.name ?? id,
        action: action as GitOpAction,
        ok: false,
        summary: String(e).split("\n")[0]?.trim() || "操作失败",
      })
      return { success: false }
    } finally {
      scheduleProgressCleanup(progressRef, id, seq)
    }
  }

  /** 通用单平台 remote 操作（pushSingle / pullSingle 共用实现） */
  async function remoteOpSingle(
    action: "push" | "pull", progressRef: ProgressRef, outputsRef: OutputsRef,
    managerFn: (id: string, target: PlatformKey) => Promise<{ ok: boolean, stdout: string, stderr: string }>,
    id: string, target: PlatformKey,
    oppositeProgressRef?: ProgressRef,
  ) {
    // 入口守卫：该项目该平台的同类操作进行中时拒绝重复触发（防双击竞态）；
    // 同时拒绝与另一操作（push ↔ pull）并发写同一仓库（UI disabled 之外的后端兜底）
    if (isOpInProgress(progressRef, id, target) || (oppositeProgressRef && isOpInProgress(oppositeProgressRef, id))) {
      return { ok: false, stdout: "", stderr: "操作进行中" }
    }
    const seq = nextOpSeq(id)
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
      opts.loadPushStatus(id).catch((e: any) => console.warn(`[gitPush] 刷新${action === "push" ? "推送" : "拉取"}状态失败:`, e?.message || e))
      // 操作日志埋点：单平台成功
      const project = findProject(projects, id)
      void opts.appendOpLog?.({
        projectId: id,
        projectName: project?.name ?? id,
        action: action as GitOpAction,
        ok: result.ok,
        summary: entries[0]?.summary ?? "操作完成",
        platforms: entries.map((e) => ({ key: e.platform, label: e.label, ok: e.ok, skipped: e.skipped, summary: e.summary })),
      })
      return result
    } catch (e: any) {
      const duration = Date.now() - startedAt
      progressRef.value = {
        ...progressRef.value,
        [id]: { ...progressRef.value[id], [target]: "fail" },
      }
      const pm = PLATFORM_META.find((m) => m.key === target)
      const errMsg = String(e?.message || e)
      outputsRef.value[id] = [{
        platform: target,
        label: pm?.label ?? target,
        ok: false,
        skipped: false,
        duration,
        summary: errMsg.split("\n")[0]?.trim() || "失败",
        fullStdout: "",
        fullStderr: errMsg,
      }]
      pruneRecordCache(outputsRef.value)
      // 操作日志埋点：单平台失败
      const project2 = findProject(projects, id)
      void opts.appendOpLog?.({
        projectId: id,
        projectName: project2?.name ?? id,
        action: action as GitOpAction,
        ok: false,
        summary: errMsg.split("\n")[0]?.trim() || "操作失败",
        platforms: [{ key: target, label: pm?.label ?? target, ok: false, skipped: false, summary: errMsg.split("\n")[0]?.trim() || "失败" }],
      })
      // 与 remoteOpAll 策略统一：不重抛（调用方为模板事件处理器，无 catch），返回结构化错误
      return { ok: false, stdout: "", stderr: errMsg }
    } finally {
      scheduleProgressCleanup(progressRef, id, seq)
    }
  }

  // ── 公开 API ──

  /** 通用操作进度检查 */
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

  function getPushStatus(projectId: string, target: PlatformKey): ProgressStatus {
    return pushProgress.value[projectId]?.[target] ?? "pending"
  }

  function isPulling(projectId: string, target?: string): boolean {
    return isOpInProgress(pullProgress, projectId, target)
  }

  function pushToAll(id: string) {
    return remoteOpAll("push", pushProgress, pushOutputs, manager.pushToAll.bind(manager), id, pullProgress)
  }

  function forcePushToAll(id: string) {
    return remoteOpAll("push", pushProgress, pushOutputs, manager.forcePushToAll.bind(manager), id, pullProgress)
  }

  function pushSingle(id: string, target: PlatformKey) {
    return remoteOpSingle("push", pushProgress, pushOutputs, manager.pushSingle.bind(manager), id, target, pullProgress)
  }

  function pullToAll(id: string) {
    return remoteOpAll("pull", pullProgress, pullOutputs, manager.pullToAll.bind(manager), id, pushProgress)
  }

  function pullSingle(id: string, target: PlatformKey) {
    return remoteOpSingle("pull", pullProgress, pullOutputs, manager.pullSingle.bind(manager), id, target, pushProgress)
  }

  function cancelPush(id: string) { manager.cancelOp(id, "push") }
  function cancelPull(id: string) { manager.cancelOp(id, "pull") }

  /** 清理指定项目的全部远程进度/输出缓存（删除项目时调用，避免孤儿状态残留） */
  function clearProject(id: string) {
    for (const r of [pushProgress, pullProgress, pushOutputs, pullOutputs] as Ref<Record<string, unknown>>[]) {
      if (id in r.value) {
        const next = { ...r.value }
        delete next[id]
        r.value = next
      }
    }
    delete opSeq[id]
  }

  async function fetchAllRemotes(id: string) {
    const result = await manager.fetchAllForProject(id)
    await opts.loadPushStatus(id)
    return result
  }

  return {
    pushProgress,
    getPushStatus,
    isPushing,
    pushOutputs,
    entriesToText,
    pullProgress,
    isPulling,
    pullOutputs,
    pushToAll,
    forcePushToAll,
    pushSingle,
    pullToAll,
    pullSingle,
    cancelPush,
    cancelPull,
    fetchAllRemotes,
    clearProject,
  }
}
