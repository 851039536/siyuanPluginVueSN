// 操作流水线状态：远程真实阶段事件 + 本地真实步骤，统一按项目维护 lane
import type { Ref } from "vue"
import { computed, ref } from "vue"
import type {
  OpFailureMap,
  OpPipelineLane,
  PipelineOp,
  PipelineStageHistory,
  PipelineStageKey,
  RemoteProgressEvent,
} from "../types/pipeline"
import { GLOBAL_PIPELINE_SCOPE } from "../types/pipeline"
import type { TimerHandle } from "@/utils/timerRegistry"
import { TimerRegistry } from "@/utils/timerRegistry"
import {
  applyDetail,
  applyStage,
  capStageHistory,
  capTimedRecord,
  createLane,
  finalizeLane,
  isLaneTerminal,
  laneRunTimings,
  markRetry,
  markSkip,
  markStalled,
  PIPELINE_REVEAL_DELAY_MS,
  PIPELINE_STALLED_MS,
} from "../utils/opPipeline"
import { failureKey, historyKeyForLane } from "../utils/pipelineGraph"

/** 本地流水线步进器：只允许推进真实 await 步骤 */
export interface LocalPipelineStepper {
  step: (stage: PipelineStageKey, detail?: string) => void
  detail: (text: string) => void
  /**
   * 本次调用没有实际执行（被在途请求排队、项目/范围已被替换等）。
   * 不记历史、不标失败，直接收起 lane，避免把"没跑"画成"跑完"。
   */
  skip: () => void
}

/** 远程 lane 的目标平台 */
export interface RemoteLaneTarget {
  key: string
  label: string
}

/** 远程 lane 终态（由调用方按执行结果给出） */
export type RemoteLaneStatus = "done" | "fail" | "canceled" | "skipped"

/** 本地 lane 终态显示时长（随后自动收起） */
const LOCAL_LANE_LINGER_MS = 1500

/** 阶段耗时历史最多保留的计划签名数（长会话防泄漏；正常只有 15 条左右） */
const HISTORY_SIGNATURE_LIMIT = 32

/** 每个计划签名保留最近几次成功运行（用于时间线对比） */
const RUN_HISTORY_LIMIT = 6

/** 失败记录保留上限（入口 × 项目；长会话防泄漏） */
const FAILURE_RECORD_LIMIT = 64

/** 远程进度桥接：useRemoteProgress 只依赖这三个方法，避免耦合整份状态 */
export interface OpPipelineBridge {
  beginRemote: (
    projectId: string,
    op: PipelineOp,
    targets: RemoteLaneTarget[],
    plan: readonly PipelineStageKey[],
  ) => string
  applyRemoteEvent: (projectId: string, batchId: string, event: RemoteProgressEvent) => void
  finishRemote: (
    projectId: string,
    batchId: string,
    statuses: Record<string, RemoteLaneStatus>,
    /** 每个远程的真实错误文本（仅失败项需要），用于失败诊断 */
    messages?: Record<string, string>,
  ) => void
}

/**
 * 操作流水线状态管理。
 *
 * - 远程操作：一次操作 = 一个 batch，多远程 = 多条 lane；
 * - 本地操作：同项目同一时刻只保留一条本地 lane，嵌套调用追加阶段而非新建；
 * - 所有 lane 先创建、200ms 后才可见，瞬时操作不会闪烁；
 * - 远程阶段无输出 6s 后只标「仍在处理」，不伪造阶段完成。
 */
export function useOpPipeline() {
  const opPipelines: Ref<Record<string, OpPipelineLane[]>> = ref({})
  /** 计划签名 → 最近一次成功耗时；lane 清理后仍保留，供关系图显示「上次」徽标 */
  const stageHistory: Ref<PipelineStageHistory> = ref({})
  /** 计划签名 → 最近一次失败；用于关系图的持久失败标记与诊断（成功一次即清除） */
  const lastFailures: Ref<OpFailureMap> = ref({})
  /** 非项目级操作（统计/分析/报告/体检）的 lane；与卡片 lane 共用同一状态机与清理策略 */
  const globalPipelines = computed<OpPipelineLane[]>(() =>
    (opPipelines.value[GLOBAL_PIPELINE_SCOPE] ?? []).filter((lane) => lane.visible),
  )
  /** 全部可见 lane（项目 lane + 全局 lane），供根级 Dock 聚合展示 */
  const allPipelines = computed<OpPipelineLane[]>(() =>
    Object.values(opPipelines.value).flat().filter((lane) => lane.visible),
  )
  const timers = new TimerRegistry()
  const revealTimers = new Map<string, TimerHandle>()
  const stallTimers = new Map<string, TimerHandle>()
  const cleanupTimers = new Map<string, TimerHandle>()
  /** 本地 lane 嵌套深度：只有最外层结束才收敛 lane */
  const localDepth = new Map<string, number>()
  let seq = 0

  function updateLanes(projectId: string, fn: (list: OpPipelineLane[]) => OpPipelineLane[]) {
    const current = opPipelines.value[projectId]
    if (!current) return
    opPipelines.value = { ...opPipelines.value, [projectId]: fn(current) }
  }

  function mutateLane(projectId: string, laneId: string, fn: (lane: OpPipelineLane) => OpPipelineLane) {
    updateLanes(projectId, (list) => list.map((lane) => (lane.id === laneId ? fn(lane) : lane)))
  }

  function removeLane(projectId: string, laneId: string) {
    const current = opPipelines.value[projectId]
    if (!current) return
    const next = current.filter((lane) => lane.id !== laneId)
    const copy = { ...opPipelines.value }
    if (next.length > 0) copy[projectId] = next
    else delete copy[projectId]
    opPipelines.value = copy
  }

  /**
   * 只记录成功结束的 lane；按唯一入口归档（analysis / lineStats 共用计划也不串台），
   * 并清除同一项目同一入口的失败标记——别的项目失败不因本次成功消失。
   */
  function recordHistory(lane: OpPipelineLane, scope: string) {
    const timings = laneRunTimings(lane)
    if (!timings) return
    const key = historyKeyForLane(lane)
    const runs = stageHistory.value[key] ?? []
    stageHistory.value = capStageHistory(
      { ...stageHistory.value, [key]: [timings, ...runs].slice(0, RUN_HISTORY_LIMIT) },
      HISTORY_SIGNATURE_LIMIT,
    )
    const failedKey = failureKey(key, scope)
    if (failedKey in lastFailures.value) {
      const next = { ...lastFailures.value }
      delete next[failedKey]
      lastFailures.value = next
    }
  }

  /** 失败文本：本地异常消息优先，其次回落到最后一条真实输出 */
  function errorText(error: unknown): string {
    if (error instanceof Error) return error.message
    return typeof error === "string" ? error : ""
  }

  /** 记录失败 lane（取消不算失败）；同一入口同一项目只保留最近一次 */
  function recordFailure(lane: OpPipelineLane, scope: string, detail?: string) {
    if (lane.status !== "fail") return
    const failedStage = [...lane.stages].reverse().find((stage) => stage.status === "fail")
    const fallbackDetail = [...lane.stages].reverse().find((stage) => stage.detail)?.detail
    const text = (detail ?? "").trim() || fallbackDetail?.trim() || ""
    if (!text) return
    const key = failureKey(historyKeyForLane(lane), scope)
    lastFailures.value = capTimedRecord(
      {
        ...lastFailures.value,
        [key]: {
          at: lane.endedAt ?? Date.now(),
          stage: failedStage?.key,
          detail: text,
          scope,
        },
      },
      FAILURE_RECORD_LIMIT,
    )
  }

  function clearTimer(map: Map<string, TimerHandle>, laneId: string) {
    const handle = map.get(laneId)
    if (handle === undefined) return
    timers.clear(handle)
    map.delete(laneId)
  }

  function clearLaneTimers(laneId: string) {
    clearTimer(revealTimers, laneId)
    clearTimer(stallTimers, laneId)
    clearTimer(cleanupTimers, laneId)
  }

  /** 200ms 后显示；到期前已结束的 lane 会直接被移除 */
  function armReveal(projectId: string, laneId: string) {
    clearTimer(revealTimers, laneId)
    const handle = timers.setTimeout(() => {
      revealTimers.delete(laneId)
      mutateLane(projectId, laneId, (lane) => (lane.visible ? lane : { ...lane, visible: true }))
    }, PIPELINE_REVEAL_DELAY_MS)
    revealTimers.set(laneId, handle)
  }

  /** 停滞兜底：每次真实输出重置计时；只降级视觉，不推进阶段 */
  function armStall(projectId: string, laneId: string) {
    clearTimer(stallTimers, laneId)
    const handle = timers.setTimeout(() => {
      stallTimers.delete(laneId)
      mutateLane(projectId, laneId, markStalled)
    }, PIPELINE_STALLED_MS)
    stallTimers.set(laneId, handle)
  }

  function findLane(projectId: string, laneId: string): OpPipelineLane | undefined {
    return opPipelines.value[projectId]?.find((lane) => lane.id === laneId)
  }

  /** 当前活跃的同 op 本地 lane（终态 / 不同 op 都不复用） */
  function findActiveLocalLane(projectId: string, op: PipelineOp): OpPipelineLane | undefined {
    return opPipelines.value[projectId]?.find(
      (lane) => lane.key === "local" && lane.op === op && !isLaneTerminal(lane.status),
    )
  }

  /** 追加阶段（嵌套本地操作共用一条 lane 时，避免阶段重复） */
  function appendStages(projectId: string, laneId: string, plan: readonly PipelineStageKey[]) {
    mutateLane(projectId, laneId, (lane) => {
      const existing = new Set(lane.stages.map((stage) => stage.key))
      const added = plan
        .filter((key) => !existing.has(key))
        .map((key) => ({ key, status: "pending" as const }))
      return added.length > 0 ? { ...lane, stages: [...lane.stages, ...added] } : lane
    })
  }

  // ── 远程操作 ──

  /**
   * 开始一次远程操作，按平台创建 lane。
   * @returns batchId（后续事件与收敛都靠它归属）
   */
  function beginRemote(
    projectId: string,
    op: PipelineOp,
    targets: RemoteLaneTarget[],
    plan: readonly PipelineStageKey[],
  ): string {
    const batchId = `remote-${++seq}`
    const now = Date.now()
    const created = targets.map((target) => applyStage(
      createLane({
        id: `${batchId}:${target.key}`,
        key: target.key,
        batchId,
        op,
        label: target.label,
        plan,
        now,
      }),
      "prepare",
      undefined,
      undefined,
      now,
    ))
    if (created.length > 0) {
      opPipelines.value = {
        ...opPipelines.value,
        [projectId]: [...(opPipelines.value[projectId] ?? []), ...created],
      }
      for (const lane of created) armReveal(projectId, lane.id)
    }
    return batchId
  }

  /** 应用远程进度事件（来自 RemoteOps 的解析结果） */
  function applyRemoteEvent(projectId: string, batchId: string, event: RemoteProgressEvent) {
    const lane = opPipelines.value[projectId]?.find(
      (item) => item.batchId === batchId && item.key === event.target,
    )
    if (!lane || isLaneTerminal(lane.status)) return

    if (event.kind === "prepare") {
      mutateLane(projectId, lane.id, (item) =>
        applyStage(item, "prepare", undefined, event.detail, Date.now()),
      )
      return
    }
    if (event.kind === "skip") {
      clearLaneTimers(lane.id)
      mutateLane(projectId, lane.id, (item) => markSkip(item, Date.now()))
      removeLane(projectId, lane.id)
      return
    }
    if (event.kind === "retry") {
      clearTimer(stallTimers, lane.id)
      mutateLane(projectId, lane.id, markRetry)
      return
    }
    if (event.kind === "detail") {
      mutateLane(projectId, lane.id, (item) => applyDetail(item, event.detail))
      armStall(projectId, lane.id)
      return
    }
    if (event.kind === "stage" && event.stage) {
      mutateLane(projectId, lane.id, (item) =>
        applyStage(item, event.stage!, event.percent, event.detail, Date.now()),
      )
      armStall(projectId, lane.id)
    }
  }

  /**
   * 远程操作结束：逐 lane 收敛并立即从运行视图移除（结果面板随即接管）。
   * 智能跳过的 lane 不进入运行视图，直接清理。
   */
  function finishRemote(
    projectId: string,
    batchId: string,
    statuses: Record<string, RemoteLaneStatus>,
    messages?: Record<string, string>,
  ) {
    const batchLanes = (opPipelines.value[projectId] ?? []).filter((lane) => lane.batchId === batchId)
    // 先收集再统一记账：同一批次「一台成功、一台失败」时，成功不得盖掉失败标记
    const finalizedLanes: OpPipelineLane[] = []
    for (const lane of batchLanes) {
      clearLaneTimers(lane.id)
      const status = statuses[lane.key] ?? "skipped"
      const current = findLane(projectId, lane.id)
      if (current && status !== "skipped") {
        const finalized = finalizeLane(current, status, Date.now())
        mutateLane(projectId, lane.id, () => finalized)
        finalizedLanes.push(finalized)
      }
      removeLane(projectId, lane.id)
    }
    // 同一批次多远程共用入口键：只记最慢的一条作为「这一次运行」，避免时间线出现重复行
    const doneByEntry = new Map<string, OpPipelineLane>()
    for (const lane of finalizedLanes) {
      if (lane.status !== "done") continue
      const entryKey = historyKeyForLane(lane)
      const previous = doneByEntry.get(entryKey)
      const currentMs = (lane.endedAt ?? 0) - lane.startedAt
      const previousMs = previous ? (previous.endedAt ?? 0) - previous.startedAt : -1
      if (!previous || currentMs > previousMs) doneByEntry.set(entryKey, lane)
    }
    for (const lane of doneByEntry.values()) recordHistory(lane, projectId)
    for (const lane of finalizedLanes) {
      if (lane.status === "fail") recordFailure(lane, projectId, messages?.[lane.key])
    }
  }

  // ── 本地操作 ──

  /**
   * 包装一次本地写操作，按真实 await 步骤推进。
   * 嵌套调用复用同一条 lane，只有最外层结束时才收敛。
   */
  async function runLocalPipeline<T>(
    projectId: string,
    op: PipelineOp,
    label: string,
    plan: readonly PipelineStageKey[],
    fn: (stepper: LocalPipelineStepper) => Promise<T>,
  ): Promise<T> {
    // 先清掉同项目已收敛但仍在展示的旧本地 lane，避免新操作开始时出现两行
    for (const lane of opPipelines.value[projectId] ?? []) {
      if (lane.key === "local" && isLaneTerminal(lane.status)) {
        clearLaneTimers(lane.id)
        removeLane(projectId, lane.id)
      }
    }

    const active = findActiveLocalLane(projectId, op)
    let laneId: string
    if (active) {
      laneId = active.id
      appendStages(projectId, laneId, plan)
    } else {
      laneId = `local-${++seq}`
      const lane = createLane({
        id: laneId,
        key: "local",
        batchId: laneId,
        op,
        label,
        plan,
        now: Date.now(),
      })
      opPipelines.value = {
        ...opPipelines.value,
        [projectId]: [...(opPipelines.value[projectId] ?? []), lane],
      }
      armReveal(projectId, laneId)
    }

    localDepth.set(laneId, (localDepth.get(laneId) ?? 0) + 1)

    let skipped = false
    const stepper: LocalPipelineStepper = {
      step(stage, detail) {
        if (skipped) return
        mutateLane(projectId, laneId, (lane) =>
          applyStage(lane, stage, undefined, detail, Date.now()),
        )
        armStall(projectId, laneId)
      },
      detail(text) {
        if (skipped) return
        mutateLane(projectId, laneId, (lane) => applyDetail(lane, text))
      },
      skip() {
        skipped = true
      },
    }

    try {
      const result = await fn(stepper)
      if (skipped) discardLocal(projectId, laneId)
      else settleLocal(projectId, laneId, "done")
      return result
    } catch (e) {
      settleLocal(projectId, laneId, "fail", errorText(e))
      throw e
    }
  }

  /** 未实际执行：不记历史/失败，直接收起 lane（嵌套时只减深度，交给最外层） */
  function discardLocal(projectId: string, laneId: string) {
    const depth = (localDepth.get(laneId) ?? 1) - 1
    if (depth > 0) {
      localDepth.set(laneId, depth)
      return
    }
    localDepth.delete(laneId)
    clearLaneTimers(laneId)
    removeLane(projectId, laneId)
  }

  /** 本地 lane 收敛：嵌套未结束时不处理；可见 lane 停留 1.5s，未可见直接移除 */
  function settleLocal(
    projectId: string,
    laneId: string,
    status: "done" | "fail",
    failureDetail?: string,
  ) {
    const depth = (localDepth.get(laneId) ?? 1) - 1
    if (depth > 0) {
      localDepth.set(laneId, depth)
      return
    }
    localDepth.delete(laneId)
    clearLaneTimers(laneId)
    const lane = findLane(projectId, laneId)
    if (!lane) return
    const finalized = finalizeLane(lane, status, Date.now())
    recordHistory(finalized, projectId)
    if (status === "fail") recordFailure(finalized, projectId, failureDetail)
    mutateLane(projectId, laneId, () => finalized)
    if (!finalized.visible) {
      removeLane(projectId, laneId)
      return
    }
    const handle = timers.setTimeout(() => {
      cleanupTimers.delete(laneId)
      removeLane(projectId, laneId)
    }, LOCAL_LANE_LINGER_MS)
    cleanupTimers.set(laneId, handle)
  }

  /**
   * 包装一次非项目级操作（统计刷新 / 提交分析 / 报告生成 / 仓库体检）。
   * 使用保留 project key 写入同一份 opPipelines，渲染在根级 Dock / 各视图工具条下方。
   */
  function runGlobalPipeline<T>(
    op: PipelineOp,
    label: string,
    plan: readonly PipelineStageKey[],
    fn: (stepper: LocalPipelineStepper) => Promise<T>,
  ): Promise<T> {
    return runLocalPipeline(GLOBAL_PIPELINE_SCOPE, op, label, plan, fn)
  }

  /** 删除项目时清理全部关联流水线 */
  function clearProject(projectId: string) {
    for (const lane of opPipelines.value[projectId] ?? []) {
      clearLaneTimers(lane.id)
      localDepth.delete(lane.id)
    }
    if (!(projectId in opPipelines.value)) return
    const next = { ...opPipelines.value }
    delete next[projectId]
    opPipelines.value = next
  }

  /** 组件卸载：清空所有定时器与状态 */
  function dispose() {
    timers.clearAll()
    revealTimers.clear()
    stallTimers.clear()
    cleanupTimers.clear()
    localDepth.clear()
    opPipelines.value = {}
    stageHistory.value = {}
    lastFailures.value = {}
  }

  return {
    opPipelines,
    globalPipelines,
    allPipelines,
    stageHistory,
    lastFailures,
    beginRemote,
    applyRemoteEvent,
    finishRemote,
    runLocalPipeline,
    runGlobalPipeline,
    clearProject,
    dispose,
  }
}
