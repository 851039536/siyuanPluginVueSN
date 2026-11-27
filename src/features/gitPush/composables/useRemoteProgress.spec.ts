import { describe, expect, it, vi } from "vitest"
import { ref } from "vue"

vi.mock("../utils", () => ({
  findProject: (projects: { value: { id: string }[] }, id: string) =>
    projects.value.find((project) => project.id === id),
  platformLabel: (key: string) => key,
  pruneRecordCache: () => undefined,
  resolveValidPath: (project: { path: string }) => project.path,
  opSummary: () => "summary",
}))

// 插件侧 types 桶会值转出 GitPushManager（加载 siyuan），Node 测试环境只需平台常量
vi.mock("../types", () => ({
  PLATFORM_META: [
    { key: "github", remoteProp: "githubRemote", label: "GitHub" },
    { key: "gitee", remoteProp: "giteeRemote", label: "Gitee" },
  ],
}))

import { useRemoteProgress } from "./useRemoteProgress"

function setup() {
  let resolvePush!: (value: Record<string, unknown>) => void
  const pending = new Promise<Record<string, unknown>>((resolve) => { resolvePush = resolve })
  const cancelOp = vi.fn()
  const manager = { pushToAll: vi.fn(() => pending), cancelOp } as never
  const projects = ref([{
    id: "p1",
    name: "P",
    path: "C:/repo",
    githubRemote: "origin",
    giteeRemote: "upstream",
  }]) as never
  const pipeline = {
    beginRemote: vi.fn(() => "b1"),
    applyRemoteEvent: vi.fn(),
    finishRemote: vi.fn(),
  }
  const ops = useRemoteProgress(manager, projects, {
    loadPushStatus: async () => undefined,
    safeTimeout: () => 0 as never,
    i18n: {},
    pipeline: pipeline as never,
  })
  return { ops, pipeline, cancelOp, resolvePush }
}

describe("useRemoteProgress 取消", () => {
  it("排队期取消立即收敛 lane 与进度，不等执行层返回", async () => {
    const { ops, pipeline, cancelOp, resolvePush } = setup()

    const run = ops.pushToAll("p1")
    ops.cancelPush("p1")

    expect(cancelOp).toHaveBeenCalledWith("p1", "push")
    expect(pipeline.finishRemote).toHaveBeenCalledTimes(1)
    expect(pipeline.finishRemote).toHaveBeenCalledWith("p1", "b1", {
      github: "canceled",
      gitee: "canceled",
    })
    expect(ops.pushProgress.value.p1).toMatchObject({ github: "canceled", gitee: "canceled" })

    resolvePush({
      github: { ok: false, canceled: true, stdout: "", stderr: "" },
      gitee: { ok: false, canceled: true, stdout: "", stderr: "" },
      success: false,
    })
    await run
  })

  it("操作已结束后再取消，不覆盖真实结果", async () => {
    const { ops, pipeline, resolvePush } = setup()
    const run = ops.pushToAll("p1")
    resolvePush({
      github: { ok: true, stdout: "done", stderr: "", durationMs: 1 },
      gitee: { ok: true, stdout: "done", stderr: "", durationMs: 1 },
      success: true,
    })
    await run
    const calls = pipeline.finishRemote.mock.calls.length

    ops.cancelPush("p1")

    expect(pipeline.finishRemote).toHaveBeenCalledTimes(calls)
    expect(ops.pushProgress.value.p1).toMatchObject({ github: "ok", gitee: "ok" })
  })
})
