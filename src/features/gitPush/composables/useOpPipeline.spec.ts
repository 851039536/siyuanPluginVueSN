import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOpPipeline } from "./useOpPipeline"
import { GLOBAL_PIPELINE_SCOPE } from "../types/pipeline"
import { ANALYSIS_STAGE_PLAN, COMMIT_STAGE_PLAN, FETCH_STAGE_PLAN, PUSH_STAGE_PLAN, QUICK_COMMIT_STAGE_PLAN, REPORT_STAGE_PLAN, STASH_DROP_STAGE_PLAN, STASH_STAGE_PLAN, STATS_STAGE_PLAN } from "../utils/opPipeline"
import { failureKey } from "../utils/pipelineGraph"

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
    const key = "push"

    const doneBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(500)
    pipeline.finishRemote("p1", doneBatch, { github: "done" })
    const runs = pipeline.stageHistory.value[key]
    expect(runs?.[0]?.totalMs).toBe(500)
    expect(runs?.[0]?.stages.prepare).toBe(500)

    const failBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(800)
    pipeline.finishRemote("p1", failBatch, { github: "fail" })
    expect(pipeline.stageHistory.value[key]).toBe(runs)
  })

  it("同一操作保留最近多次运行，最新在前", () => {
    const pipeline = useOpPipeline()
    const key = "push"

    const firstBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(300)
    pipeline.finishRemote("p1", firstBatch, { github: "done" })

    const secondBatch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(700)
    pipeline.finishRemote("p1", secondBatch, { github: "done" })

    const runs = pipeline.stageHistory.value[key] ?? []
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

    const record = pipeline.stageHistory.value.commit?.[0]
    expect(record?.totalMs).toBe(300)
    expect(record?.stages.commitWrite).toBe(300)
    expect(record?.stages.refreshState).toBe(0)

    pipeline.dispose()
    expect(pipeline.stageHistory.value).toEqual({})
  })

  it("本地失败记录诊断文本，下一次成功清除", async () => {
    const pipeline = useOpPipeline()
    const key = failureKey("commit", "p1")

    // 先接住拒绝，避免推进假定时器时触发 unhandled rejection
    const failed = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      throw new Error("fatal: not a git repository")
    }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(300)
    expect((await failed) as Error).toHaveProperty("message", "fatal: not a git repository")
    expect(pipeline.lastFailures.value[key]).toMatchObject({
      stage: "commitWrite",
      detail: "fatal: not a git repository",
      scope: "p1",
    })

    const ok = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    await vi.advanceTimersByTimeAsync(300)
    await ok
    expect(pipeline.lastFailures.value[key]).toBeUndefined()
  })

  it("远程失败按 stderr 记录；同批成功不覆盖失败", () => {
    const pipeline = useOpPipeline()
    const key = failureKey("push", "p1")
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

    expect(pipeline.lastFailures.value[key]?.detail).toContain("non-fast-forward")
    // 同批多远程只记最慢的一条，时间线不会出现重复行
    expect(pipeline.stageHistory.value.push).toHaveLength(1)
    expect(pipeline.stageHistory.value.push?.[0]?.totalMs).toBe(400)
  })

  it("取消不进入失败记录", () => {
    const pipeline = useOpPipeline()
    const key = failureKey("push", "p1")
    const batch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(300)
    pipeline.finishRemote("p1", batch, { github: "canceled" }, { github: "操作已取消" })
    expect(pipeline.lastFailures.value[key]).toBeUndefined()
  })

  it("同入口不同项目的失败互不清除，只有同项目成功才清除自己的记录", async () => {
    const pipeline = useOpPipeline()
    const failP1 = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      throw new Error("p1 failed")
    }).catch(() => undefined)
    await vi.advanceTimersByTimeAsync(300)
    await failP1

    const okP2 = pipeline.runLocalPipeline("p2", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    await vi.advanceTimersByTimeAsync(300)
    await okP2

    // p2 成功不影响 p1 的失败
    expect(pipeline.lastFailures.value[failureKey("commit", "p1")]?.detail).toBe("p1 failed")
    expect(pipeline.lastFailures.value[failureKey("commit", "p2")]).toBeUndefined()
    // 历史按入口归档，p2 的成功仍计入 commit
    expect(pipeline.stageHistory.value.commit?.[0]?.totalMs).toBe(300)

    const okP1 = pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (step) => {
      step.step("commitWrite")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    await vi.advanceTimersByTimeAsync(300)
    await okP1
    expect(pipeline.lastFailures.value[failureKey("commit", "p1")]).toBeUndefined()
  })

  it("共用计划的入口各自归档：analysis 与 lineStats 历史不串台", () => {
    const pipeline = useOpPipeline()
    const analysisBatch = pipeline.beginRemote(
      GLOBAL_PIPELINE_SCOPE, "analysis", [{ key: "local", label: "分析" }], ANALYSIS_STAGE_PLAN,
    )
    vi.advanceTimersByTime(300)
    pipeline.finishRemote(GLOBAL_PIPELINE_SCOPE, analysisBatch, { local: "done" })

    expect(pipeline.stageHistory.value.analysis?.[0]?.totalMs).toBe(300)
    expect(pipeline.stageHistory.value.lineStats).toBeUndefined()

    const lineBatch = pipeline.beginRemote(
      GLOBAL_PIPELINE_SCOPE, "lineStats", [{ key: "local", label: "行数" }], ANALYSIS_STAGE_PLAN,
    )
    vi.advanceTimersByTime(700)
    pipeline.finishRemote(GLOBAL_PIPELINE_SCOPE, lineBatch, { local: "done" })

    expect(pipeline.stageHistory.value.analysis).toHaveLength(1)
    expect(pipeline.stageHistory.value.lineStats?.[0]?.totalMs).toBe(700)
  })

  it("stepper.skip 收起 lane 且不写历史/失败", async () => {
    const pipeline = useOpPipeline()
    const run = pipeline.runGlobalPipeline("report", "报告", REPORT_STAGE_PLAN, async (stepper) => {
      stepper.step("prepare")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
      // 被在途请求挡下：本次没有实际产出
      stepper.skip()
    })
    await vi.advanceTimersByTimeAsync(300)
    await run

    expect(pipeline.opPipelines.value[GLOBAL_PIPELINE_SCOPE]).toBeUndefined()
    expect(pipeline.stageHistory.value.report).toBeUndefined()
    expect(pipeline.lastFailures.value).toEqual({})
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

  it("同 op 不同计划各建一条 lane，不把两条流程拼在一起", async () => {
    const pipeline = useOpPipeline()
    const save = pipeline.runLocalPipeline("p1", "stash", "保存", STASH_STAGE_PLAN, async (step) => {
      step.step("stashExec")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })
    const drop = pipeline.runLocalPipeline("p1", "stash", "删除", STASH_DROP_STAGE_PLAN, async (step) => {
      step.step("stashDrop")
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    })

    const lanes = pipeline.opPipelines.value.p1 ?? []
    expect(lanes).toHaveLength(2)
    expect(lanes.map((lane) => lane.stages[0]?.key).sort()).toEqual(["stashDrop", "stashExec"])

    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([save, drop])
  })

  it("嵌套的短计划复用同一条 lane（quickCommit → commit）", async () => {
    const pipeline = useOpPipeline()
    const run = pipeline.runLocalPipeline("p1", "commit", "一键提交", QUICK_COMMIT_STAGE_PLAN, async (step) => {
      step.step("stageAll")
      step.step("generateMsg")
      step.step("commitWrite")
      await pipeline.runLocalPipeline("p1", "commit", "提交", COMMIT_STAGE_PLAN, async (inner) => {
        inner.step("commitWrite")
      })
      const lanes = pipeline.opPipelines.value.p1 ?? []
      expect(lanes).toHaveLength(1)
      expect(lanes[0]?.stages.map((stage) => stage.key)).toEqual([
        "stageAll", "generateMsg", "commitWrite", "refreshState",
      ])
      step.step("refreshState")
    })
    await run
  })

  it("删除项目清理该作用域的失败记录，不影响其他项目", () => {
    const pipeline = useOpPipeline()
    const p1Batch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(100)
    pipeline.finishRemote("p1", p1Batch, { github: "fail" }, { github: "p1 boom" })
    const p2Batch = pipeline.beginRemote("p2", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    vi.advanceTimersByTime(100)
    pipeline.finishRemote("p2", p2Batch, { github: "fail" }, { github: "p2 boom" })

    expect(pipeline.lastFailures.value[failureKey("push", "p1")]?.detail).toBe("p1 boom")
    pipeline.clearProject("p1")
    expect(pipeline.lastFailures.value[failureKey("push", "p1")]).toBeUndefined()
    expect(pipeline.lastFailures.value[failureKey("push", "p2")]?.detail).toBe("p2 boom")
  })

  it("失败文本中的 URL 凭据在入库前脱敏", () => {
    const pipeline = useOpPipeline()
    const batch = pipeline.beginRemote("p1", "push", [{ key: "github", label: "GitHub" }], PUSH_STAGE_PLAN)
    pipeline.finishRemote(
      "p1",
      batch,
      { github: "fail" },
      { github: "fatal: unable to access 'https://user:token@github.com/a.git/'" },
    )
    expect(pipeline.lastFailures.value[failureKey("push", "p1")]?.detail)
      .toBe("fatal: unable to access 'https://***@github.com/a.git/'")
  })
})
