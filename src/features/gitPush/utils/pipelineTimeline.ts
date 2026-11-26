// 流水线时间线纯逻辑：把最近几次运行展开为甘特段、对比差值与回放节奏（无 Vue / DOM）
import type { PipelineRunTimings, PipelineStageKey } from "../types/pipeline"

/** 甘特图中的一段：相对本次运行起点的偏移 + 真实耗时 */
export interface TimelineSegment {
  key: PipelineStageKey
  startMs: number
  durationMs: number
}

/** 一次运行的时间线视图模型 */
export interface TimelineRun {
  at: number
  totalMs: number
  segments: TimelineSegment[]
  /** 与更早一次相比的总耗时百分比变化；没有更早记录时为 null */
  deltaPercent: number | null
}

/**
 * 把「最新在前」的运行记录展开为甘特行。
 * 阶段顺序沿用记录时的计划顺序（被跳过的阶段没有 startedAt，本就不在记录里）。
 */
export function buildTimelineRuns(
  runs: readonly PipelineRunTimings[],
  limit = 6,
): TimelineRun[] {
  const picked = runs.slice(0, Math.max(1, limit))
  return picked.map((run, index) => {
    let cursor = 0
    const segments: TimelineSegment[] = []
    for (const [key, value] of Object.entries(run.stages)) {
      if (typeof value !== "number") continue
      const durationMs = Math.max(0, value)
      segments.push({ key: key as PipelineStageKey, startMs: cursor, durationMs })
      cursor += durationMs
    }
    const previous = picked[index + 1]
    const deltaPercent = previous && previous.totalMs > 0
      ? Math.round(((run.totalMs - previous.totalMs) / previous.totalMs) * 100)
      : null
    return {
      at: run.at,
      totalMs: Math.max(0, run.totalMs),
      segments,
      deltaPercent,
    }
  })
}

/** 单阶段在「最新一次 vs 上一次」中的变化；缺失值表示该次未观测/未执行 */
export interface StageDelta {
  key: PipelineStageKey
  currentMs?: number
  previousMs?: number
  /** 正数 = 变慢，负数 = 变快；任一侧缺失时为 undefined */
  deltaMs?: number
  /** 相对上一次的百分比；上一次为 0 或缺失时不计算 */
  deltaPercent?: number
}

/**
 * 对比最新两次运行的阶段耗时。
 * 变慢最多的排在最前，便于直接定位回归；未配对（新增 / 本次未执行）的排在末尾。
 */
export function buildStageDeltas(
  latest: PipelineRunTimings | undefined,
  previous: PipelineRunTimings | undefined,
): StageDelta[] {
  if (!latest || !previous) return []
  const keys = new Set<string>([
    ...Object.keys(latest.stages),
    ...Object.keys(previous.stages),
  ])
  const rows: StageDelta[] = []
  for (const key of keys) {
    const stageKey = key as PipelineStageKey
    const currentMs = latest.stages[stageKey]
    const previousMs = previous.stages[stageKey]
    const deltaMs = currentMs !== undefined && previousMs !== undefined
      ? currentMs - previousMs
      : undefined
    rows.push({
      key: stageKey,
      currentMs,
      previousMs,
      deltaMs,
      deltaPercent: deltaMs !== undefined && previousMs !== undefined && previousMs > 0
        ? Math.round((deltaMs / previousMs) * 100)
        : undefined,
    })
  }
  rows.sort((a, b) => {
    if (a.deltaMs === undefined && b.deltaMs === undefined) return 0
    if (a.deltaMs === undefined) return 1
    if (b.deltaMs === undefined) return -1
    return b.deltaMs - a.deltaMs
  })
  return rows
}

/** 阶段占整次运行的百分比（用于显示宽度与「是否塞得下标签」） */
export function segmentShare(segment: TimelineSegment, run: TimelineRun): number {
  if (run.totalMs <= 0) return 100 / Math.max(1, run.segments.length)
  return Math.min(100, (segment.durationMs / run.totalMs) * 100)
}

/**
 * 回放节奏：按各阶段真实耗时占比压缩到固定预算内。
 * 太短的阶段统一给最小停留，超长阶段封顶，避免回放被一个慢阶段拖住。
 */
export function playbackDelays(
  run: TimelineRun,
  budgetMs = 4000,
  minMs = 260,
  maxMs = 1400,
): number[] {
  const count = Math.max(1, run.segments.length)
  return run.segments.map((segment) => {
    if (run.totalMs <= 0) {
      return Math.max(minMs, Math.min(maxMs, Math.round(budgetMs / count)))
    }
    const share = segment.durationMs / run.totalMs
    return Math.max(minMs, Math.min(maxMs, Math.round(share * budgetMs)))
  })
}
