import { describe, expect, it } from "vitest"
import type { PipelineRunTimings } from "../types/pipeline"
import { buildStageDeltas, buildTimelineRuns, playbackDelays, segmentShare } from "./pipelineTimeline"

function run(at: number, totalMs: number, stages: PipelineRunTimings["stages"]): PipelineRunTimings {
  return { at, totalMs, stages }
}

describe("pipelineTimeline", () => {
  it("按运行展开甘特段并累积起点，顺序沿用记录顺序", () => {
    const runs = buildTimelineRuns([
      run(300, 1200, { prepare: 100, enumerating: 300, writing: 600 }),
      run(100, 2000, { prepare: 1000 }),
    ])

    expect(runs).toHaveLength(2)
    expect(runs[0]!.segments).toEqual([
      { key: "prepare", startMs: 0, durationMs: 100 },
      { key: "enumerating", startMs: 100, durationMs: 300 },
      { key: "writing", startMs: 400, durationMs: 600 },
    ])
    expect(runs[0]!.deltaPercent).toBe(-40)
    expect(runs[1]!.deltaPercent).toBeNull()
  })

  it("limit 只取最新几次，不改变先后顺序", () => {
    const source = [
      run(500, 100, {}),
      run(400, 100, {}),
      run(300, 100, {}),
    ]
    expect(buildTimelineRuns(source, 2).map((item) => item.at)).toEqual([500, 400])
  })

  it("负耗时与缺失阶段不会产出负宽度", () => {
    const runs = buildTimelineRuns([run(1, -5, { prepare: -20, writing: 30 })])
    expect(runs[0]!.totalMs).toBe(0)
    expect(runs[0]!.segments).toEqual([
      { key: "prepare", startMs: 0, durationMs: 0 },
      { key: "writing", startMs: 0, durationMs: 30 },
    ])
  })

  it("阶段占比：按本次总耗时计算，总耗时为 0 时均分", () => {
    const [normal] = buildTimelineRuns([run(1, 1000, { prepare: 250 })])
    expect(segmentShare(normal!.segments[0]!, normal!)).toBe(25)

    const [instant] = buildTimelineRuns([run(2, 0, { prepare: 0, writing: 0 })])
    expect(segmentShare(instant!.segments[0]!, instant!)).toBe(50)
  })

  it("回放节奏按占比压缩，并受最小 / 最大停留约束", () => {
    const [timeline] = buildTimelineRuns([
      run(1, 10_000, { prepare: 100, writing: 9_900 }),
    ])
    const delays = playbackDelays(timeline!, 4000, 260, 1400)
    expect(delays).toHaveLength(2)
    expect(delays[0]).toBe(260)
    expect(delays[1]).toBe(1400)
  })

  it("阶段变化：变慢优先、计算差值与百分比、缺失阶段排在末尾", () => {
    const rows = buildStageDeltas(
      run(200, 1500, { prepare: 100, writing: 1100, stageAll: 300 }),
      run(100, 1200, { prepare: 300, writing: 900 }),
    )

    expect(rows.map((row) => row.key)).toEqual(["writing", "prepare", "stageAll"])
    expect(rows[0]).toMatchObject({ currentMs: 1100, previousMs: 900, deltaMs: 200, deltaPercent: 22 })
    expect(rows[1]).toMatchObject({ currentMs: 100, previousMs: 300, deltaMs: -200, deltaPercent: -67 })
    expect(rows[2]).toMatchObject({ currentMs: 300, previousMs: undefined, deltaMs: undefined })
  })

  it("阶段变化：上一次耗时为 0 时只给差值，不给百分比；缺任一次都不出结果", () => {
    const [row] = buildStageDeltas(
      run(200, 100, { prepare: 100 }),
      run(100, 0, { prepare: 0 }),
    )
    expect(row).toMatchObject({ deltaMs: 100, deltaPercent: undefined })

    expect(buildStageDeltas(run(1, 10, {}), undefined)).toEqual([])
  })

  it("瞬时运行的各阶段等分回放预算", () => {
    const [instant] = buildTimelineRuns([run(1, 0, { prepare: 0, writing: 0 })])
    expect(playbackDelays(instant!, 1000, 100, 800)).toEqual([500, 500])
  })
})
