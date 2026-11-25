import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOpPipeline } from "./useOpPipeline"
import { COMMIT_STAGE_PLAN, FETCH_STAGE_PLAN, PUSH_STAGE_PLAN } from "../utils/opPipeline"

describe("useOpPipeline", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("200ms 后可见；提前结束的远程 lane 直接移除", () => {
    const pipeline = useOpPipeline()
    const batchId = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    expect(pipeline.opPipelines.value.p1?.[0]?.visible).toBe(false)
    // prepare 必须是 running，否则第一阶段会被渲染成「跳过」
    expect(pipeline.opPipelines.value.p1?.[0]?.stages[0]).toMatchObject({
      key: "prepare",
      status: "running",
    })

    vi.advanceTimersByTime(200)
    expect(pipeline.opPipelines.value.p1?.[0]?.visible).toBe(true)

    pipeline.finishRemote("p1", batchId, { github: "done" })
    expect(pipeline.opPipelines.value.p1).toBeUndefined()
  })

  it("skip 事件立即移除对应 lane", () => {
    const pipeline = useOpPipeline()
    const batchId = pipeline.beginRemote(
      "p1",
      "push",
      [{ key: "github", label: "GitHub" }, { key: "gitee", label: "Gitee" }],
      PUSH_STAGE_PLAN,
    )
    pipeline.applyRemoteEvent("p1", batchId, { target: "github", kind: "skip" })
    expect(pipeline.opPipelines.value.p1?.map((lane) => lane.key)).toEqual(["gitee"])
  })

  it("远程阶段事件推进到真实阶段", () => {
    const pipeline = useOpPipeline()
    const batchId = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    pipeline.applyRemoteEvent("p1", batchId, {
      target: "github", kind: "stage", stage: "writing", percent: 42, detail: "Writing objects: 42%",
    })
    const lane = pipeline.opPipelines.value.p1?.[0]
    expect(lane?.stages.find((s) => s.key === "writing")).toMatchObject({
      status: "running",
      percent: 42,
    })
  })

  it("本地嵌套操作只在最外层结束时收敛", async () => {
    const pipeline = useOpPipeline()
    const outer = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (stepper) => {
      stepper.step("commitWrite")
      // 撑过 200ms 可见阈值，验证终态停留 1.5s 的清理路径
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      // 内层复用同一条 lane：此时不应把外层 lane 收敛成终态
      await pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (inner) => {
        inner.step("commitWrite")
      })
      const lane = pipeline.opPipelines.value.p1?.[0]
      expect(lane?.status).toBe("running")
      stepper.step("refreshState")
    })
    await vi.advanceTimersByTimeAsync(300)
    await outer

    const lane = pipeline.opPipelines.value.p1?.[0]
    expect(lane?.status).toBe("done")

    vi.advanceTimersByTime(1500)
    expect(pipeline.opPipelines.value.p1).toBeUndefined()
  })

  it("不同本地操作不合并到同一条 lane", async () => {
    const pipeline = useOpPipeline()
    const fetchRun = pipeline.runLocalPipeline("p1", "fetch", "Fetch", FETCH_STAGE_PLAN, async (step) => {
      step.step("fetchExec")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    const commitRun = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([fetchRun, commitRun])

    expect((pipeline.opPipelines.value.p1 ?? []).map((lane) => lane.op).sort()).toEqual([
      "commit",
      "fetch",
    ])
  })
})
