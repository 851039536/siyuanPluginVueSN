import { describe, expect, it } from "vitest"
import type { OpPipelineLane } from "../types/pipeline"
import {
  applyDetail,
  applyStage,
  createLane,
  finalizeLane,
  isLaneTerminal,
  markRetry,
  markSkip,
  markStalled,
  PIPELINE_STAGE_LABEL_KEY,
  PULL_STAGE_PLAN,
  PUSH_STAGE_PLAN,
  SMART_PULL_STAGE_PLAN,
  COMMIT_STAGE_PLAN,
  STASH_STAGE_PLAN,
  STASH_DROP_STAGE_PLAN,
  SWITCH_STAGE_PLAN,
  DISCARD_STAGE_PLAN,
  QUICK_COMMIT_STAGE_PLAN,
  FETCH_STAGE_PLAN,
} from "./opPipeline"

function makeLane(): OpPipelineLane {
  return createLane({
    id: "lane-1",
    key: "github",
    batchId: "batch-1",
    op: "push",
    label: "GitHub",
    plan: PUSH_STAGE_PLAN,
    now: 1000,
  })
}

describe("opPipeline", () => {
  it("创建时所有阶段 pending", () => {
    const lane = makeLane()
    expect(lane.status).toBe("running")
    expect(lane.visible).toBe(false)
    expect(lane.stages.every((s) => s.status === "pending")).toBe(true)
  })

  it("跳到后续阶段时中间阶段标 skipped 而非 done", () => {
    const lane = applyStage(makeLane(), "compressing", 50, "Compressing objects: 50%", 2000)
    expect(lane.stages.map((s) => s.status)).toEqual([
      "skipped", "skipped", "skipped", "running", "pending", "pending", "pending",
    ])
    expect(lane.stages[3]).toMatchObject({ percent: 50, startedAt: 2000 })
  })

  it("后续阶段开始时前一 running 阶段收敛为 done", () => {
    let lane = applyStage(makeLane(), "counting", 100, "Counting objects: 100%", 2000)
    lane = applyStage(lane, "compressing", 10, "Compressing objects: 10%", 3000)
    expect(lane.stages.find((s) => s.key === "counting")).toMatchObject({
      status: "done",
      endedAt: 3000,
    })
  })

  it("阶段只前进：后续阶段开始后再上报早期阶段会被忽略", () => {
    let lane = applyStage(makeLane(), "writing", 50, "", 2000)
    lane = applyStage(lane, "remote", 0, "", 2500)
    lane = applyStage(lane, "enumerating", 100, "", 3000)
    expect(lane.stages.find((s) => s.key === "enumerating")?.status).toBe("skipped")
    expect(lane.stages.find((s) => s.key === "writing")?.status).toBe("done")
  })

  it("同阶段百分比重试不倒退", () => {
    let lane = applyStage(makeLane(), "writing", 80, "Writing objects: 80%", 2000)
    lane = applyStage(lane, "writing", 10, "Writing objects: 10%", 2100)
    expect(lane.stages.find((s) => s.key === "writing")?.percent).toBe(80)
  })

  it("detail 只更新当前运行阶段", () => {
    let lane = applyStage(makeLane(), "writing", 30, "Writing objects: 30%", 2000)
    lane = applyDetail(lane, "remote: error: hook declined")
    expect(lane.stages.find((s) => s.key === "writing")?.detail).toContain("hook declined")
  })

  it("智能跳过整条 lane 标 skipped", () => {
    const lane = markSkip(makeLane(), 2000)
    expect(lane.status).toBe("skipped")
    expect(lane.stages.every((s) => s.status === "skipped")).toBe(true)
  })

  it("成功收敛：running → done，pending → skipped", () => {
    let lane = applyStage(makeLane(), "writing", 100, "done", 2000)
    lane = finalizeLane(lane, "done", 3000)
    expect(lane.status).toBe("done")
    const writing = lane.stages.find((s) => s.key === "writing")
    expect(writing).toMatchObject({ status: "done", endedAt: 3000 })
    expect(lane.stages.find((s) => s.key === "remote")?.status).toBe("skipped")
  })

  it("失败 / 取消收敛为对应终态", () => {
    const failed = finalizeLane(applyStage(makeLane(), "writing", 20, "", 2000), "fail", 3000)
    expect(failed.stages.find((s) => s.key === "writing")?.status).toBe("fail")
    const canceled = finalizeLane(makeLane(), "canceled", 3000)
    expect(canceled.status).toBe("canceled")
  })

  it("停滞标记只影响运行阶段", () => {
    const lane = markStalled(applyStage(makeLane(), "writing", 20, "", 2000))
    expect(lane.stages.find((s) => s.key === "writing")?.stalled).toBe(true)
  })

  it("重试后阶段全部回到 pending（第二轮可从枚举重新推进）", () => {
    let lane = applyStage(makeLane(), "writing", 60, "", 2000)
    lane = markRetry(lane)
    expect(lane.stages.every((s) => s.status === "pending")).toBe(true)
    lane = applyStage(lane, "enumerating", 100, "", 3000)
    expect(lane.stages.find((s) => s.key === "enumerating")?.status).toBe("running")
  })

  it("终态判定", () => {
    expect(isLaneTerminal("done")).toBe(true)
    expect(isLaneTerminal("running")).toBe(false)
  })

  it("所有计划中的阶段都有文案键", () => {
    const plans = [
      PUSH_STAGE_PLAN, PULL_STAGE_PLAN, SMART_PULL_STAGE_PLAN, COMMIT_STAGE_PLAN,
      STASH_STAGE_PLAN, STASH_DROP_STAGE_PLAN, SWITCH_STAGE_PLAN, DISCARD_STAGE_PLAN,
      QUICK_COMMIT_STAGE_PLAN, FETCH_STAGE_PLAN,
    ]
    for (const plan of plans) {
      for (const key of plan) {
        expect(PIPELINE_STAGE_LABEL_KEY[key]).toBeTruthy()
      }
    }
  })
})
