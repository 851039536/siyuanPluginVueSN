// 操作流水线纯逻辑：阶段计划、阶段推进、终态收敛（无 Vue 依赖，便于单测）
import type {
  OpPipelineLane,
  PipelineOp,
  PipelineStageKey,
  PipelineStageState,
  PipelineStatus,
} from "../types/pipeline"

/** 流水线可见阈值：短于此时间的操作不弹动画，避免瞬时操作闪烁 */
export const PIPELINE_REVEAL_DELAY_MS = 200

/** 远程阶段无新输出超过该时长 → 标记「仍在处理」（仅视觉降级） */
export const PIPELINE_STALLED_MS = 6000

/** 阶段 → i18n 文案键（文案唯一真源仍是 zh_CN.json 的 gitPush 分组） */
export const PIPELINE_STAGE_LABEL_KEY: Record<PipelineStageKey, string> = {
  prepare: "opStagePrepare",
  enumerating: "opStageEnumerating",
  counting: "opStageCounting",
  compressing: "opStageCompressing",
  writing: "opStageWriting",
  receiving: "opStageReceiving",
  unpacking: "opStageUnpacking",
  resolving: "opStageResolving",
  remote: "opStageRemote",
  updating: "opStageUpdating",
  status: "opStageCheckStatus",
  fetch: "opStageFetch",
  inspect: "opStageInspect",
  compare: "opStageCompare",
  align: "opStageAlign",
  commitWrite: "opStageCommitWrite",
  switchExec: "opStageSwitchExec",
  refreshWorktree: "opStageRefreshWorktree",
  refreshSync: "opStageRefreshSync",
  refreshState: "opStageRefreshState",
  reloadViews: "opStageReloadViews",
  stashExec: "opStageStashExec",
  stashDrop: "opStageStashDrop",
  discardExec: "opStageDiscardExec",
  stageAll: "opStageStageAll",
  generateMsg: "opStageGenerateMsg",
  fetchExec: "opStageFetchExec",
  refreshStatus: "opStageRefreshStatus",
  statsQuery: "opStageStatsQuery",
  analysisScan: "opStageAnalysisScan",
  analysisAggregate: "opStageAnalysisAggregate",
  reportScan: "opStageReportScan",
  reportAggregate: "opStageReportAggregate",
  repoPackScan: "opStageRepoPackScan",
  repoObjectScan: "opStageRepoObjectScan",
  repoPathScan: "opStageRepoPathScan",
  repoAnchorScan: "opStageRepoAnchorScan",
  tagPushExec: "opStageTagPushExec",
}

/** 推送：git 会按 枚举 → 计数 → 压缩 → 写入 → 远端 → 更新引用 输出 */
export const PUSH_STAGE_PLAN: readonly PipelineStageKey[] = [
  "prepare", "enumerating", "counting", "compressing", "writing", "remote", "updating",
]

/** 拉取 / fetch：git 按 枚举 → 计数 → 压缩 → 接收 → 解包 → 解析增量 → 更新引用 输出 */
export const PULL_STAGE_PLAN: readonly PipelineStageKey[] = [
  "prepare", "enumerating", "counting", "compressing", "receiving", "unpacking", "resolving", "updating",
]

/** 判断拉取：应用层真实步骤 */
export const SMART_PULL_STAGE_PLAN: readonly PipelineStageKey[] = [
  "prepare", "status", "fetch", "inspect", "compare", "align",
]

/** 手动 FETCH：应用层真实步骤（调度器不逐阶段回调，这里只展示两段） */
export const FETCH_STAGE_PLAN: readonly PipelineStageKey[] = ["fetchExec", "refreshStatus"]

/** 提交：写提交 → 刷新工作区与同步状态 */
export const COMMIT_STAGE_PLAN: readonly PipelineStageKey[] = ["commitWrite", "refreshState"]

/** Stash 保存 / 弹出 / 应用：执行 → 刷新 Stash 列表与工作区 */
export const STASH_STAGE_PLAN: readonly PipelineStageKey[] = ["stashExec", "refreshState"]

/** Stash 删除：删除 → 刷新 Stash 列表与工作区 */
export const STASH_DROP_STAGE_PLAN: readonly PipelineStageKey[] = ["stashDrop", "refreshState"]

/** 切换分支：切换 → 刷新工作区与同步状态 → 重载日志/分支 */
export const SWITCH_STAGE_PLAN: readonly PipelineStageKey[] = [
  "switchExec", "refreshState", "reloadViews",
]

/** 丢弃更改：还原文件 → 刷新工作区 */
export const DISCARD_STAGE_PLAN: readonly PipelineStageKey[] = ["discardExec", "refreshWorktree"]

/** 一键暂存并提交：暂存 → 生成信息 → 提交 → 刷新 */
export const QUICK_COMMIT_STAGE_PLAN: readonly PipelineStageKey[] = [
  "stageAll", "generateMsg", "commitWrite", "refreshState",
]

/** 统计中心手动刷新：逐项目查询状态（链接审计仍走后台，不并入本 lane） */
export const STATS_STAGE_PLAN: readonly PipelineStageKey[] = ["prepare", "statsQuery"]

/** 提交分析 / 行数统计：抓取 → 聚合落盘 */
export const ANALYSIS_STAGE_PLAN: readonly PipelineStageKey[] = [
  "prepare", "analysisScan", "analysisAggregate",
]

/** 代码报告：读索引/补抓 → 聚合缓存 */
export const REPORT_STAGE_PLAN: readonly PipelineStageKey[] = [
  "prepare", "reportScan", "reportAggregate",
]

/** 仓库体检：三条 git 命令 + 锚定引用（无大文件时锚定阶段由 reducer 标 skipped） */
export const REPO_SCAN_STAGE_PLAN: readonly PipelineStageKey[] = [
  "prepare", "repoPackScan", "repoObjectScan", "repoPathScan", "repoAnchorScan",
]

/** Tag 推送：网络写操作（完成后由调用方刷新/提示） */
export const TAG_PUSH_STAGE_PLAN: readonly PipelineStageKey[] = ["prepare", "tagPushExec"]

/** 终态判定：终态 lane 不再接受新事件 */
export function isLaneTerminal(status: PipelineStatus): boolean {
  return status === "done" || status === "skipped" || status === "fail" || status === "canceled"
}

/** 创建一条流水线（所有阶段 pending） */
export function createLane(params: {
  id: string
  key: string
  batchId: string
  op: PipelineOp
  label: string
  plan: readonly PipelineStageKey[]
  now: number
}): OpPipelineLane {
  return {
    id: params.id,
    key: params.key,
    batchId: params.batchId,
    op: params.op,
    label: params.label,
    stages: params.plan.map((key) => ({ key, status: "pending" })),
    status: "running",
    startedAt: params.now,
    visible: false,
  }
}

/** 当前正在运行的阶段（没有则返回最后一个非 pending 阶段） */
export function runningStage(lane: OpPipelineLane): PipelineStageState | undefined {
  return lane.stages.find((s) => s.status === "running")
    ?? [...lane.stages].reverse().find((s) => s.status !== "pending")
}

/**
 * 推进到某个真实阶段。
 * - 跳过的中间阶段标 skipped（未观测 ≠ 已完成）；
 * - 同阶段百分比只增不减，避免重试 / 多 ref 块导致视觉倒退；
 * - 阶段不在计划内时只更新 detail，不改变结构。
 */
export function applyStage(
  lane: OpPipelineLane,
  stage: PipelineStageKey,
  percent: number | undefined,
  detail: string | undefined,
  now: number,
): OpPipelineLane {
  if (isLaneTerminal(lane.status)) return lane
  const idx = lane.stages.findIndex((s) => s.key === stage)
  if (idx < 0) return applyDetail(lane, detail)
  // 阶段只前进不后退：嵌套操作重复上报早期阶段、或 push --all 多 ref 块时不再回卷
  const furthest = lane.stages.reduce(
    (max, item, i) => (item.status !== "pending" ? i : max),
    -1,
  )
  if (idx < furthest) return lane

  const stages = lane.stages.map((s, i): PipelineStageState => {
    if (i < idx) {
      // 后续阶段开始 ⇒ 上一阶段已真实结束；未观测到的中间阶段仍标 skipped
      if (s.status === "pending") return { ...s, status: "skipped", endedAt: now }
      if (s.status === "running") {
        return { ...s, status: "done", endedAt: now, stalled: false }
      }
      return s
    }
    if (i === idx) {
      const nextPercent = percent === undefined
        ? s.percent
        : Math.max(s.percent ?? 0, percent)
      return {
        ...s,
        status: "running",
        percent: nextPercent,
        detail: detail ?? s.detail,
        startedAt: s.startedAt ?? now,
        stalled: false,
      }
    }
    // 未来阶段若被上次操作置为 running（不应发生），回收为 skipped
    return s.status === "running" ? { ...s, status: "skipped", endedAt: now } : s
  })
  return { ...lane, stages, visible: lane.visible }
}

/** 只更新当前阶段的 detail（错误行 / 远端消息） */
export function applyDetail(lane: OpPipelineLane, detail: string | undefined): OpPipelineLane {
  if (!detail || isLaneTerminal(lane.status)) return lane
  const stage = runningStage(lane)
  if (!stage) return lane
  const stages = lane.stages.map((s) => (s.key === stage.key ? { ...s, detail } : s))
  return { ...lane, stages }
}

/** 重试：整条命令会从头执行，阶段全部回到 pending，避免停在上一轮的「最远阶段」 */
export function markRetry(lane: OpPipelineLane): OpPipelineLane {
  if (isLaneTerminal(lane.status)) return lane
  const stages = lane.stages.map((s) => ({
    ...s,
    status: "pending" as const,
    percent: undefined,
    stalled: false,
    detail: undefined,
    startedAt: undefined,
    endedAt: undefined,
  }))
  return { ...lane, status: "running", stages }
}

/** 智能跳过：整条 lane 标 skipped（不进入运行视图） */
export function markSkip(lane: OpPipelineLane, now: number): OpPipelineLane {
  return {
    ...lane,
    status: "skipped",
    endedAt: now,
    stages: lane.stages.map((s) => ({ ...s, status: "skipped", endedAt: now })),
  }
}

/** 标记停滞：只降级视觉，不推进阶段 */
export function markStalled(lane: OpPipelineLane): OpPipelineLane {
  if (isLaneTerminal(lane.status)) return lane
  const stages = lane.stages.map((s) => (s.status === "running" ? { ...s, stalled: true } : s))
  return { ...lane, stages }
}

/**
 * 操作结束：running 阶段收敛为终态，pending 阶段标 skipped。
 * `done` 只代表应用层步骤走完；未观测到的可选 git 阶段仍保持 skipped。
 */
export function finalizeLane(
  lane: OpPipelineLane,
  status: "done" | "fail" | "canceled",
  now: number,
): OpPipelineLane {
  const stages = lane.stages.map((s): PipelineStageState => {
    if (s.status === "running") {
      return { ...s, status, endedAt: now, stalled: false }
    }
    if (s.status === "pending") {
      return { ...s, status: "skipped", endedAt: now }
    }
    return s
  })
  return { ...lane, status, endedAt: now, stages }
}
