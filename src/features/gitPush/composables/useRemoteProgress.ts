// 远程推送/拉取进度追踪与结构化输出（从 useGitOps 提取，降低单文件复杂度）
import type { Ref } from "vue"
import type { GitOpAction, GitProject, GitPushManager, PlatformKey, PushOutputEntry } from "../types"
import { ref } from "vue"
import { PLATFORM_META } from "../types"
import { findProject, platformLabel, pruneRecordCache, resolveValidPath, opSummary } from "../utils"

/** 推送/拉取单平台结构化输出（类型定义迁移至 types/storage.ts，此处 re-export 保持向后兼容） */
export type { PushOutputEntry } from "../types"

export type ProgressStatus = "pending" | "pushing" | "ok" | "fail" | "canceled"
type ProgressRef = Ref<Record<string, Record<string, ProgressStatus>>>
type OutputsRef = Ref<Record<string, PushOutputEntry[]>>

/**
 * 远程推送/拉取进度管理 composable
 * 封装 pushToAll / forcePushToAll / pushSingle / pullSingle 的进度追踪、超时清理、结构化输出
 */
export function useRemoteProgress(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
  opts: {
    /** 推送/拉取完成后的状态重查（由调用方注入调度器的 force 版本，确保拿到写后状态而非在飞旧查询） */
    loadPushStatus: (id: string) => Promise<void>
    safeTimeout: (fn: () => void, delay: number) => ReturnType<typeof setTimeout>
    /** i18n 文案表（操作摘要兜底文案经 opSummary 取用，避免裸中英文字面量） */
    i18n: Record<string, any>
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
    action: "push" | "pull",
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
        canceled: r.canceled ?? false,
        // 优先用执行层回传的单远程耗时；缺失时才回落调用方给的兜底值（全平台共用的总时长）
        duration: r.durationMs ?? durations[pm.key] ?? 0,
        summary: opSummary({
          action,
          ok: r.ok ?? false,
          i18n: opts.i18n,
          raw: r.ok ? r.stdout : r.stderr,
        }),
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

  /** 获取项目有效路径 */
  function getUsedPath(id: string): string | undefined {
    const project = findProject(projects, id)
    if (!project) return undefined
    return resolveValidPath(project)
  }

  /**
   * 合并单平台结果到既有输出：单推不应覆盖「推送全部」留下的其它平台结果。
   * 按 PLATFORM_META 固定顺序排列，避免条目顺序随用户点击顺序漂移。
   */
  function mergeOutputEntry(outputsRef: OutputsRef, id: string, entry: PushOutputEntry): void {
    const order = new Map(PLATFORM_META.map((pm, i) => [pm.key, i]))
    const rank = (key: PlatformKey) => order.get(key) ?? Number.MAX_SAFE_INTEGER
    const merged = [...(outputsRef.value[id] ?? []).filter((e) => e.platform !== entry.platform), entry]
      .sort((a, b) => rank(a.platform) - rank(b.platform))
    // 整体替换而非改属性：ref<Record> 的原地 delete/赋值不被深层响应式稳定追踪（项目内既有约定）
    outputsRef.value = { ...outputsRef.value, [id]: merged }
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

  /** 被入口守卫拒绝时的占位输出条目（写入卡片输出区，替代静默拒绝——UI disabled 失效时用户仍可感知） */
  function blockedEntry(id: string, target?: PlatformKey): PushOutputEntry {
    let key = target
    if (!key) {
      const project = findProject(projects, id)
      key = (project && PLATFORM_META.find((pm) => project[pm.remoteProp])?.key) || "github"
    }
    const label = platformLabel(key)
    // i18n 缺失时兜底空串（而非 undefined 文本），避免把 "undefined" 渲染进控制台
    const blocked = opts.i18n.opBlockedInProgress ?? ""
    return {
      platform: key,
      label,
      ok: false,
      skipped: false,
      duration: 0,
      summary: blocked,
      fullStdout: "",
      fullStderr: blocked,
    }
  }

  /** 通用全平台 remote 操作（pushToAll / forcePushToAll 共用实现） */
  async function remoteOpAll(
    action: "push" | "pull", progressRef: ProgressRef, outputsRef: OutputsRef,
    managerFn: (id: string) => Promise<Record<string, any>>, id: string,
    oppositeProgressRef?: ProgressRef,
  ) {
    // 入口守卫：同一项目的同类操作进行中时拒绝重复触发（防双击竞态）；
    // 同时拒绝与另一操作（push ↔ pull）并发写同一仓库（UI disabled 之外的后端兜底）
    if (isOpInProgress(progressRef, id) || (oppositeProgressRef && isOpInProgress(oppositeProgressRef, id))) {
      outputsRef.value[id] = [blockedEntry(id)]
      pruneRecordCache(outputsRef.value)
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
      // 一次构造全量进度：逐 key 展开整表会触发 N 次响应式更新（3~4 个平台时纯属浪费）
      progressRef.value = {
        ...progressRef.value,
        [id]: Object.fromEntries(
          Object.keys(initProg).map((key) => [key, "pushing" as ProgressStatus]),
        ),
      }

      const result = await managerFn(id)

      const totalDuration = Date.now() - totalStart
      const nextProg = { ...progressRef.value[id] }
      for (const pm of PLATFORM_META) {
        const key = pm.key
        if (!initProg[key]) continue
        const r = result[key] as any
        // 取消是独立终态：记成 fail 会让「用户主动停止」和「推送真的失败」混为一谈
        nextProg[key] = r?.canceled ? "canceled" : r?.ok ? "ok" : "fail"
      }
      progressRef.value = { ...progressRef.value, [id]: nextProg }

      // 执行层已回传各远程真实耗时；这里的总时长仅作兜底（避免旧调用方缺字段时显示 0）
      const sharedDurations: Record<string, number> = {}
      for (const key of Object.keys(initProg)) { sharedDurations[key] = totalDuration }
      outputsRef.value[id] = buildOutputEntries(result, action, sharedDurations, getUsedPath(id))
      pruneRecordCache(outputsRef.value)
      opts.loadPushStatus(id).catch((e: any) => console.warn(`[gitPush] 刷新${action === "push" ? "推送" : "拉取"}状态失败:`, e?.message || e))
      return result
    } catch (e) {
      console.error(`[gitPush] ${action === "push" ? "推送" : "拉取"}失败:`, e)
      const failProg: Record<string, ProgressStatus> = {}
      for (const key of Object.keys(initProg)) { failProg[key] = "fail" }
      progressRef.value = { ...progressRef.value, [id]: failProg }
      return { success: false }
    } finally {
      scheduleProgressCleanup(progressRef, id, seq)
    }
  }

  /** 通用单平台 remote 操作（pushSingle / pullSingle 共用实现） */
  async function remoteOpSingle(
    action: "push" | "pull", progressRef: ProgressRef, outputsRef: OutputsRef,
    managerFn: (id: string, target: PlatformKey) => Promise<{ ok: boolean, stdout: string, stderr: string, canceled?: boolean, durationMs?: number }>,
    id: string, target: PlatformKey,
    oppositeProgressRef?: ProgressRef,
  ) {
    // 入口守卫：该项目该平台的同类操作进行中时拒绝重复触发（防双击竞态）；
    // 同时拒绝与另一操作（push ↔ pull）并发写同一仓库（UI disabled 之外的后端兜底）
    if (isOpInProgress(progressRef, id, target) || (oppositeProgressRef && isOpInProgress(oppositeProgressRef, id))) {
      outputsRef.value[id] = [blockedEntry(id, target)]
      pruneRecordCache(outputsRef.value)
      return { ok: false, stdout: "", stderr: opts.i18n.opBlockedInProgress ?? "" }
    }
    const seq = nextOpSeq(id)
    progressRef.value = {
      ...progressRef.value,
      [id]: { ...progressRef.value[id], [target]: "pushing" },
    }
    const startedAt = Date.now()
    try {
      const result = await managerFn(id, target)
      // 执行层的单远程耗时更准（含内部重试）；缺失时才用本层墙钟
      const duration = result.durationMs ?? Date.now() - startedAt
      progressRef.value = {
        ...progressRef.value,
        [id]: { ...progressRef.value[id], [target]: result.canceled ? "canceled" : result.ok ? "ok" : "fail" },
      }

      const entries: PushOutputEntry[] = [{
        platform: target,
        label: platformLabel(target),
        ok: result.ok,
        skipped: false,
        canceled: result.canceled ?? false,
        duration,
        summary: opSummary({
          action: action as GitOpAction,
          ok: result.ok,
          i18n: opts.i18n,
          raw: result.ok ? result.stdout : result.stderr,
        }),
        fullStdout: result.stdout,
        fullStderr: result.stderr,
      }]
      mergeOutputEntry(outputsRef, id, entries[0])
      pruneRecordCache(outputsRef.value)
      opts.loadPushStatus(id).catch((e: any) => console.warn(`[gitPush] 刷新${action === "push" ? "推送" : "拉取"}状态失败:`, e?.message || e))
      return result
    } catch (e: any) {
      const duration = Date.now() - startedAt
      progressRef.value = {
        ...progressRef.value,
        [id]: { ...progressRef.value[id], [target]: "fail" },
      }
      const errMsg = String(e?.message || e)
      mergeOutputEntry(outputsRef, id, {
        platform: target,
        label: platformLabel(target),
        ok: false,
        skipped: false,
        canceled: false,
        duration,
        summary: opSummary({ action: action as GitOpAction, ok: false, i18n: opts.i18n, raw: errMsg }),
        fullStdout: "",
        fullStderr: errMsg,
      })
      pruneRecordCache(outputsRef.value)
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

  function pullSingle(id: string, target: PlatformKey) {
    return remoteOpSingle("pull", pullProgress, pullOutputs, manager.pullSingle.bind(manager), id, target, pushProgress)
  }

  function cancelPush(id: string) { manager.cancelOp(id, "push") }
  function cancelPull(id: string) { manager.cancelOp(id, "pull") }

  /**
   * 清除指定项目某一操作的结果输出（推送/拉取面板的关闭按钮）。
   * 与 clearProject 一样用整体替换而非 delete —— ref<Record> 的 delete 不被深层响应式追踪，
   * 必须换新对象才会触发重渲染（项目内既有约定）。
   *
   * 运行中不清理：此时面板展示的是过程视图，清掉输出会让「运行中」失去落点。
   * ⚠️ 判据必须用 isOpInProgress（只看 pushing/pending），不能只看记录是否存在 ——
   * 操作结束后进度记录仍会保留约 3s（scheduleProgressCleanup），但那期间已是终态
   * （ok/fail），此时用户点关闭必须立即生效。
   */
  function clearOutput(id: string, action: "push" | "pull") {
    const progressRef = action === "push" ? pushProgress : pullProgress
    if (isOpInProgress(progressRef, id)) return
    const target = action === "push" ? pushOutputs : pullOutputs
    if (!(id in target.value)) return
    const next = { ...target.value }
    delete next[id]
    target.value = next
  }

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

  return {
    pushProgress,
    getPushStatus,
    isPushing,
    pushOutputs,
    pullProgress,
    isPulling,
    pullOutputs,
    pushToAll,
    forcePushToAll,
    pushSingle,
    pullSingle,
    cancelPush,
    cancelPull,
    clearOutput,
    clearProject,
  }
}
