import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOpPipeline } from "./useOpPipeline"
import { GLOBAL_PIPELINE_SCOPE } from "../types/pipeline"
import { COMMIT_STAGE_PLAN, FETCH_STAGE_PLAN, PUSH_STAGE_PLAN, STATS_STAGE_PLAN } from "../utils/opPipeline"

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

  it("全局操作用保留槽，与卡片 lane 隔离且可见后才进入派生集合", async () => {
    const pipeline = useOpPipeline()
    const run = pipeline.runGlobalPipeline("stats", "刷新项目状态", STATS_STAGE_PLAN, async (stepper) => {
      stepper.step("prepare")
      stepper.step("statsQuery")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })

    expect(pipeline.globalPipelines.value).toHaveLength(0)
    expect(pipeline.opPipelines.value[GLOBAL_PIPELINE_SCOPE]?.[0]?.visible).toBe(false)

    await vi.advanceTimersByTimeAsync(300)
    await run

    expect(pipeline.opPipelines.value.p1).toBeUndefined()
    expect(pipeline.globalPipelines.value).toHaveLength(1)
    expect(pipeline.globalPipelines.value[0]).toMatchObject({ op: "stats", status: "done" })
    expect(pipeline.allPipelines.value).toHaveLength(1)

    // 删除项目不能误清全局槽
    pipeline.clearProject("p1")
    expect(pipeline.globalPipelines.value).toHaveLength(1)

    // 本地 lane 终态停留 1.5s 后清理
    vi.advanceTimersByTime(1500)
    expect(pipeline.globalPipelines.value).toHaveLength(0)
  })

  it("远程成功 lane 结束时写入耗时历史，失败不覆盖已有记录", () => {
    const pipeline = useOpPipeline()
    const signature = PUSH_STAGE_PLAN.join(">")

    const doneBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(500)
    pipeline.finishRemote("p1", doneBatch, { github: "done" })
    const runs = pipeline.stageHistory.value[signature]
    expect(runs?.[0]?.totalMs).toBe(500)
    expect(runs?.[0]?.stages.prepare).toBe(500)

    const failBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(800)
    pipeline.finishRemote("p1", failBatch, { github: "fail" })
    expect(pipeline.stageHistory.value[signature]).toBe(runs)
  })

  it("同一操作保留最近多次运行，最新在前", () => {
    const pipeline = useOpPipeline()
    const signature = PUSH_STAGE_PLAN.join(">")

    const firstBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(300)
    pipeline.finishRemote("p1", firstBatch, { github: "done" })

    const secondBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(700)
    pipeline.finishRemote("p1", secondBatch, { github: "done" })

    const runs = pipeline.stageHistory.value[signature] ?? []
    expect(runs).toHaveLength(2)
    expect(runs[0]?.totalMs).toBe(700)
    expect(runs[1]?.totalMs).toBe(300)
  })

  it("本地成功操作写入耗时历史，dispose 清空", async () => {
    const pipeline = useOpPipeline()
    const run = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      step.step("refreshState")
    })
    await vi.advanceTimersByTimeAsync(300)
    await run

    const record = pipeline.stageHistory.value[COMMIT_STAGE_PLAN.join(">")]?.[0]
    expect(record?.totalMs).toBe(300)
    expect(record?.stages.commitWrite).toBe(300)
    expect(record?.stages.refreshState).toBe(0)

    pipeline.dispose()
    expect(pipeline.stageHistory.value).toEqual({})
  })

  it("本地失败记录诊断文本，下一次成功清除", async () => {
    const pipeline = useOpPipeline()
    const signature = COMMIT_STAGE_PLAN.join(">")

    // 先接住拒绝，避免推进假定时器时触发 unhandled rejection
    const failed = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      throw new Error("fatal: not a git repository")
    }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(300)
    expect((await failed) as Error).toHaveProperty("message", "fatal: not a git repository")
    expect(pipeline.lastFailures.value[signature]).toMatchObject({
      stage: "commitWrite",
      detail: "fatal: not a git repository",
    })

    const ok = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    await vi.advanceTimersByTimeAsync(300)
    await ok
    expect(pipeline.lastFailures.value[signature]).toBeUndefined()
  })

  it("远程失败按 stderr 记录；同批成功不覆盖失败", () => {
    const pipeline = useOpPipeline()
    const signature = PUSH_STAGE_PLAN.join(">")
    const batch = pipeline.beginRemote(
      "p1",
      "push",
      [{ key: "github", label: "GitHub" }, { key: "gitee", label: "Gitee" }],
      PUSH_STAGE_PLAN,
    )
    vi.advanceTimersByTime(400)
    pipeline.finishRemote(
      "p1",
      batch,
      { github: "fail", gitee: "done" },
      { github: "! [rejected] main -> main (non-fast-forward)" },
    )

    expect(pipeline.lastFailures.value[signature]?.detail).toContain("non-fast-forward")
    // 同批多远程只记最慢的一条，时间线不会出现重复行
    expect(pipeline.stageHistory.value[signature]).toHaveLength(1)
    expect(pipeline.stageHistory.value[signature]?.[0]?.totalMs).toBe(400)
  })

  it("取消不进入失败记录", () => {
    const pipeline = useOpPipeline()
    const signature = PUSH_STAGE_PLAN.join(">")
    const batch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(300)
    pipeline.finishRemote("p1", batch, { github: "canceled" }, { github: "操作已取消" })
    expect(pipeline.lastFailures.value[signature]).toBeUndefined()
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
