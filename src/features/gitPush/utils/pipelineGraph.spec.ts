import { describe, expect, it } from "vitest"
import zhCN from "../../../i18n/zh_CN.json"
import type {
  OpFailureMap,
  OpPipelineLane,
  PipelineStageHistory,
  PipelineStageKey,
} from "../types/pipeline"
import {
  applyStage,
  createLane,
  finalizeLane,
  PIPELINE_STAGE_LABEL_KEY,
  PIPELINE_STAGE_PLANS,
} from "./opPipeline"
import {
  buildPipelineGraph,
  buildPipelineGraphLive,
  entryForLane,
  entryLastFailure,
  entryLastTotal,
  entryRecentRuns,
  failureKey,
  formatDuration,
  laneSignature,
  latestEntryFailure,
  nodeLastDuration,
  nodeLastFailure,
  PIPELINE_GRAPH_ENTRIES,
  PIPELINE_GRAPH_LAYOUT,
  planSignature,
  type GraphEntryDef,
} from "./pipelineGraph"

const I18N = zhCN.gitPush as Record<string, string>

function entryById(id: string): GraphEntryDef {
  const entry = PIPELINE_GRAPH_ENTRIES.find((item) => item.id === id)
  if (!entry) throw new Error(`missing entry ${id}`)
  return entry
}

function makeLane(
  entry: GraphEntryDef,
  options: { id?: string, key?: string, startedAt?: number } = {},
): OpPipelineLane {
  return createLane({
    id: options.id ?? `${entry.id}-lane`,
    key: options.key ?? "origin",
    batchId: "batch-1",
    op: entry.op,
    label: entry.labelKey,
    plan: entry.plan,
    now: options.startedAt ?? 1000,
  })
}

describe("pipelineGraph", () => {
  it("入口覆盖全部已登记计划，且文案键存在", () => {
    const signatures = new Set(PIPELINE_GRAPH_ENTRIES.map((entry) => entry.signature))
    for (const plan of PIPELINE_STAGE_PLANS) {
      expect(signatures.has(planSignature(plan))).toBe(true)
    }
    for (const entry of PIPELINE_GRAPH_ENTRIES) {
      expect(entry.labelKey.length).toBeGreaterThan(0)
      expect(I18N[entry.labelKey]).toBeTruthy()
    }
  })

  it("节点集合等于所有计划阶段并集，同层坐标不重叠", () => {
    const union = new Set(PIPELINE_STAGE_PLANS.flat())
    expect(PIPELINE_GRAPH_LAYOUT.nodes).toHaveLength(union.size)
    expect(new Set(PIPELINE_GRAPH_LAYOUT.nodes.map((node) => node.key))).toEqual(union)

    const coords = new Set(PIPELINE_GRAPH_LAYOUT.nodes.map((node) => `${node.x},${node.y}`))
    expect(coords.size).toBe(PIPELINE_GRAPH_LAYOUT.nodes.length)
    for (const node of PIPELINE_GRAPH_LAYOUT.nodes) {
      expect(I18N[PIPELINE_STAGE_LABEL_KEY[node.key]]).toBeTruthy()
    }
  })

  it("共享阶段合并为同一节点，并保留全部经过入口", () => {
    const prepare = PIPELINE_GRAPH_LAYOUT.nodeByKey.get("prepare")
    expect(prepare).toBeTruthy()
    // 8 个入口共用 prepare；分析/行数统计共用同一计划，签名去重后为 7 条计划
    expect(prepare!.entries).toHaveLength(8)
    expect(new Set(prepare!.entries.map((id) => entryById(id).signature)).size).toBe(7)

    expect(PIPELINE_GRAPH_LAYOUT.nodeByKey.get("refreshState")?.entries)
      .toEqual(["commit", "quickCommit", "stash", "stashDrop", "switch"])
    expect(PIPELINE_GRAPH_LAYOUT.nodeByKey.get("commitWrite")?.entries)
      .toEqual(["commit", "quickCommit"])
  })

  it("边与计划一致：每对相邻阶段都存在且无计划外边", () => {
    const expected = new Set<string>()
    for (const plan of PIPELINE_STAGE_PLANS) {
      for (let i = 1; i < plan.length; i++) expected.add(`${plan[i - 1]}>${plan[i]}`)
    }
    expect(PIPELINE_GRAPH_LAYOUT.edges.map((edge) => edge.id).sort()).toEqual([...expected].sort())
    expect(PIPELINE_GRAPH_LAYOUT.edgeById.get("commitWrite>refreshState")?.entries)
      .toEqual(["commit", "quickCommit"])
    expect(PIPELINE_GRAPH_LAYOUT.edgeById.get("enumerating>counting")?.entries)
      .toEqual(["push", "pull"])
    for (const edge of PIPELINE_GRAPH_LAYOUT.edges) {
      expect(PIPELINE_GRAPH_LAYOUT.nodeByKey.has(edge.from)).toBe(true)
      expect(PIPELINE_GRAPH_LAYOUT.nodeByKey.has(edge.to)).toBe(true)
    }
  })

  it("最长路径分层确定，重复构建结果一致", () => {
    const layer = (key: PipelineStageKey) => PIPELINE_GRAPH_LAYOUT.nodeByKey.get(key)?.layer
    expect(layer("prepare")).toBe(0)
    expect(layer("updating")).toBe(7)
    expect(layer("commitWrite")).toBe(2)
    expect(layer("refreshState")).toBe(3)
    expect(buildPipelineGraph()).toEqual(PIPELINE_GRAPH_LAYOUT)
  })

  it("每个入口都能被 lane 精确反查（commit 与 quickCommit 同 op 不同计划）", () => {
    for (const entry of PIPELINE_GRAPH_ENTRIES) {
      const lane = makeLane(entry)
      expect(laneSignature(lane)).toBe(entry.signature)
      expect(entryForLane(lane)?.id).toBe(entry.id)
    }
  })

  it("live 聚合：运行阶段、真实百分比、真实输出与激活路径前缀", () => {
    const lane = applyStage(makeLane(entryById("push")), "enumerating", 30, "Enumerating objects: 30%", 2000)
    const live = buildPipelineGraphLive([lane])

    expect(live.entries.get("push")).toMatchObject({
      status: "running",
      stageKey: "enumerating",
      percent: 30,
      laneCount: 1,
    })
    expect(live.stages.get("enumerating")).toMatchObject({
      status: "running",
      percent: 30,
      detail: "Enumerating objects: 30%",
      startedAt: 2000,
    })
    expect(live.activeNodeKeys.has("enumerating")).toBe(true)
    expect(live.activeEdgeIds.has("prepare>enumerating")).toBe(true)
    expect(live.activeEdgeIds.has("enumerating>counting")).toBe(false)
  })

  it("未上报百分比时不伪造进度", () => {
    const lane = applyStage(makeLane(entryById("push")), "prepare", undefined, "starting", 2000)
    const live = buildPipelineGraphLive([lane])
    expect(live.entries.get("push")?.percent).toBeUndefined()
    expect(live.stages.get("prepare")?.percent).toBeUndefined()
  })

  it("同计划多 lane 合并：取真实百分比最大值、最早阶段开始时间，并统计 lane 数", () => {
    const slow = applyStage(makeLane(entryById("push"), { id: "a", key: "github" }), "writing", 20, "Writing 20%", 2000)
    const fast = applyStage(makeLane(entryById("push"), { id: "b", key: "gitee" }), "writing", 55, "Writing 55%", 3000)
    const live = buildPipelineGraphLive([slow, fast])
    expect(live.entries.get("push")).toMatchObject({ status: "running", percent: 55, laneCount: 2 })
    expect(live.stages.get("writing")).toMatchObject({ percent: 55, startedAt: 2000 })
  })

  it("状态优先级：running 高于 done，fail 高于 done", () => {
    const doneLane = finalizeLane(makeLane(entryById("push"), { id: "done" }), "done", 3000)
    const runningLane = applyStage(
      makeLane(entryById("push"), { id: "run", startedAt: 2000 }),
      "enumerating",
      10,
      undefined,
      4000,
    )
    expect(buildPipelineGraphLive([doneLane, runningLane]).entries.get("push")?.status).toBe("running")

    const failedLane = finalizeLane(
      applyStage(makeLane(entryById("push"), { id: "fail" }), "writing", 10, undefined, 2000),
      "fail",
      3000,
    )
    expect(buildPipelineGraphLive([failedLane, doneLane]).entries.get("push")?.status).toBe("fail")
  })

  it("历史耗时：唯一归属节点直接显示，共享节点需聚焦且记录一致", () => {
    const push = entryById("push")
    const history: PipelineStageHistory = {
      [push.id]: [{
        at: 5000,
        totalMs: 2400,
        stages: { prepare: 300, writing: 800, updating: 1200 },
      }],
    }

    const writing = PIPELINE_GRAPH_LAYOUT.nodeByKey.get("writing")!
    expect(nodeLastDuration(writing, [], history)).toBe(800)

    // updating 由 push / pull 共用：无聚焦不猜，单入口聚焦才取值
    const updating = PIPELINE_GRAPH_LAYOUT.nodeByKey.get("updating")!
    expect(nodeLastDuration(updating, [], history)).toBeUndefined()
    expect(nodeLastDuration(updating, ["push"], history)).toBe(1200)
    expect(nodeLastDuration(updating, ["pull"], history)).toBeUndefined()

    // analysis / lineStats 共用同一份计划，但各自归档：记录不同则无法唯一归属
    const scan = PIPELINE_GRAPH_LAYOUT.nodeByKey.get("analysisScan")!
    const separated: PipelineStageHistory = {
      analysis: [{ at: 1, totalMs: 900, stages: { analysisScan: 600 } }],
      lineStats: [{ at: 2, totalMs: 1100, stages: { analysisScan: 700 } }],
    }
    expect(nodeLastDuration(scan, ["analysis", "lineStats"], separated)).toBeUndefined()
    expect(nodeLastDuration(scan, ["analysis"], separated)).toBe(600)
    expect(nodeLastDuration(scan, ["lineStats"], separated)).toBe(700)

    // 两条记录一致时才允许在共享节点上显示
    const aligned: PipelineStageHistory = {
      analysis: [{ at: 1, totalMs: 900, stages: { analysisScan: 600 } }],
      lineStats: [{ at: 2, totalMs: 900, stages: { analysisScan: 600 } }],
    }
    expect(nodeLastDuration(scan, ["analysis", "lineStats"], aligned)).toBe(600)

    expect(entryLastTotal("push", history)).toBe(2400)
    expect(entryLastTotal("pull", history)).toBeUndefined()

    // 多次运行时，徽标只取最新一次；时间线取完整列表
    const multi: PipelineStageHistory = {
      [push.id]: [
        { at: 9000, totalMs: 1800, stages: { writing: 500 } },
        { at: 5000, totalMs: 2400, stages: { writing: 800 } },
      ],
    }
    expect(nodeLastDuration(writing, [], multi)).toBe(500)
    expect(entryLastTotal("push", multi)).toBe(1800)
    expect(entryRecentRuns("push", multi).map((run) => run.totalMs)).toEqual([1800, 2400])
    expect(entryRecentRuns("pull", multi)).toEqual([])
  })

  it("失败记录只落在真正失败的阶段，共享节点聚焦后才可判定", () => {
    const push = entryById("push")
    const failures: OpFailureMap = {
      [failureKey(push.id, "p1")]: {
        at: 6000,
        stage: "remote",
        detail: "! [rejected] main -> main (non-fast-forward)",
        scope: "p1",
      },
    }

    const remote = PIPELINE_GRAPH_LAYOUT.nodeByKey.get("remote")!
    expect(remote.entries).toEqual(["push"])
    expect(nodeLastFailure(remote, [], failures)?.stage).toBe("remote")

    // 同一条路径上的其他节点不染红
    expect(nodeLastFailure(PIPELINE_GRAPH_LAYOUT.nodeByKey.get("writing")!, [], failures)).toBeUndefined()

    // 共享节点（updating）无聚焦不猜，聚焦 push 且阶段一致时才给值
    const updating = PIPELINE_GRAPH_LAYOUT.nodeByKey.get("updating")!
    expect(nodeLastFailure(updating, [], failures)).toBeUndefined()
    const atUpdating: OpFailureMap = {
      [failureKey(push.id, "p1")]: {
        at: 7000,
        stage: "updating",
        detail: "remote: error: hook declined",
        scope: "p1",
      },
    }
    expect(nodeLastFailure(updating, ["push"], atUpdating)?.at).toBe(7000)

    expect(entryLastFailure("push", failures)?.detail).toContain("non-fast-forward")
    expect(entryLastFailure("pull", failures)).toBeUndefined()
  })

  it("同入口不同项目的失败互不覆盖，入口取最新一条", () => {
    const push = entryById("push")
    const failures: OpFailureMap = {
      [failureKey(push.id, "p1")]: { at: 6000, stage: "writing", detail: "p1 failed", scope: "p1" },
      [failureKey(push.id, "p2")]: { at: 7000, stage: "remote", detail: "p2 failed", scope: "p2" },
    }

    expect(latestEntryFailure(push.id, failures)?.detail).toBe("p2 failed")
    expect(entryLastFailure("push", failures)?.scope).toBe("p2")
    expect(entryLastFailure("pull", failures)).toBeUndefined()
  })

  it("耗时文案：毫秒 / 秒 / 分钟", () => {
    expect(formatDuration(999)).toBe("999ms")
    expect(formatDuration(1234)).toBe("1.2s")
    expect(formatDuration(10_400)).toBe("10s")
    expect(formatDuration(65_000)).toBe("1m05s")
  })

  it("无 lane 时返回空高亮", () => {
    const live = buildPipelineGraphLive([])
    expect(live.entries.size).toBe(0)
    expect(live.stages.size).toBe(0)
    expect(live.activeNodeKeys.size).toBe(0)
    expect(live.activeEdgeIds.size).toBe(0)
  })
})
