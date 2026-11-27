// 操作流水线类型：远程 git 真实进度事件 + 卡片内流水线展示模型
import type { PlatformKey } from "./meta"

/** git 进度输出解析出的真实阶段 */
export type GitProgressStage =
  | "enumerating"
  | "counting"
  | "compressing"
  | "writing"
  | "receiving"
  | "unpacking"
  | "resolving"
  | "remote"
  | "updating"

/** 流水线阶段键：git 真实阶段 + 应用层真实执行步骤 */
export type PipelineStageKey =
  | GitProgressStage
  | "prepare"
  | "status"
  | "fetch"
  | "inspect"
  | "compare"
  | "align"
  | "commitWrite"
  | "switchExec"
  | "refreshWorktree"
  | "refreshSync"
  | "refreshState"
  | "reloadViews"
  | "stashExec"
  | "stashDrop"
  | "discardExec"
  | "stageAll"
  | "generateMsg"
  | "fetchExec"
  | "refreshStatus"
  | "statsQuery"
  | "analysisScan"
  | "analysisAggregate"
  | "reportScan"
  | "reportAggregate"
  | "repoPackScan"
  | "repoObjectScan"
  | "repoPathScan"
  | "repoAnchorScan"
  | "tagPushExec"

/** 流水线所属操作 */
export type PipelineOp =
  | "push"
  | "pull"
  | "smartPull"
  | "fetch"
  | "commit"
  | "stash"
  | "switch"
  | "discard"
  | "stats"
  | "analysis"
  | "lineStats"
  | "report"
  | "repoScan"
  | "tagPush"

/**
 * 非项目级操作（统计 / 分析 / 报告 / 体检）的保留 project key。
 * 与真实项目 id 不会冲突；卡片按 id 取 lane，因此不会渲染到这里。
 */
export const GLOBAL_PIPELINE_SCOPE = "__global__"

/** 单个阶段 / 整条流水线的状态（pending 表示未开始） */
export type PipelineStatus = "pending" | "running" | "done" | "skipped" | "fail" | "canceled"

/** 流水线阶段状态 */
export interface PipelineStageState {
  key: PipelineStageKey
  status: PipelineStatus
  /** 真实百分比（仅 git 进度阶段会提供） */
  percent?: number
  /** 当前阶段最后一条真实输出（远程消息 / 错误行） */
  detail?: string
  startedAt?: number
  endedAt?: number
  /** 长时间无新输出：仅做视觉降级，不推进阶段 */
  stalled?: boolean
}

/** 一条流水线（多远程 = 多条 lane） */
export interface OpPipelineLane {
  /** 项目内唯一 id（同项目同操作可能先后复用 key） */
  id: string
  /** 远程平台 key 或本地固定 "local" */
  key: string
  /** 同一批次 id（多远程一次操作共享；本地 lane 用于识别嵌套） */
  batchId: string
  op: PipelineOp
  /** 展示名（平台名 / 操作名，已本地化） */
  label: string
  stages: PipelineStageState[]
  status: PipelineStatus
  startedAt: number
  endedAt?: number
  /** 200ms 可见阈值：避免瞬时操作闪烁 */
  visible: boolean
}

/**
 * 一次成功流水线的耗时快照（关系图历史徽标用）。
 * 只保存在内存：会话结束即失效，不落盘，避免把近似值当成长期统计。
 */
export interface PipelineRunTimings {
  /** 记录时间（裁剪旧计划签名用） */
  at: number
  /** 整条流水线耗时（毫秒） */
  totalMs: number
  /** 阶段 → 耗时（毫秒）；只含有明确起止时间的阶段 */
  stages: Partial<Record<PipelineStageKey, number>>
}

/** 入口键（如 "push" / "analysis"）→ 最近若干次成功耗时（最新在前；会话内内存，不落盘） */
export type PipelineStageHistory = Record<string, PipelineRunTimings[]>

/**
 * 最近一次失败（诊断用）：lane 清理后仍保留，同一计划签名成功一次即清除。
 * 只记 fail，取消是用户主动行为，不算失败。
 */
export interface OpFailureInfo {
  /** 失败时间（用于裁剪与「失败晚于成功」判定） */
  at: number
  /** 失败时正处于 running 的阶段 */
  stage?: PipelineStageKey
  /** 真实错误文本（远端 stderr / 本地异常消息） */
  detail: string
  /** 失败所属项目（全局槽为保留值）；同项目成功只清除自己的失败记录 */
  scope?: string
}

/** 「入口键::项目」→ 最近一次失败 */
export type OpFailureMap = Record<string, OpFailureInfo>

/** 远程执行层上报的进度事件 */
export interface RemoteProgressEvent {
  target: PlatformKey
  kind: "stage" | "skip" | "prepare" | "retry" | "detail"
  /** 远程 git 阶段或应用层真实步骤（智能拉取等） */
  stage?: PipelineStageKey
  percent?: number
  detail?: string
}

/** 远程方法可选的进度观察参数（尾参，向后兼容） */
export interface RemoteOpOptions {
  onProgress?: (event: RemoteProgressEvent) => void
}
