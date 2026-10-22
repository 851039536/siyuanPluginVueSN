// 脚本会话托管单测 —— 关窗不杀进程是本功能的承诺，会话生命周期必须逐分支钉死：
//   - start 幂等（同脚本在跑不重复起进程）/ 结束后重跑开新会话
//   - 停止后输出与退出事件不得再回灌/覆盖状态
//   - 日志块缓冲裁头保尾、超量不无界增长
//   - 并发上限与已结束会话淘汰
//   - destroyAll 杀全部运行中进程（插件卸载不留孤儿）
import type { ProjectScript } from "../types/scripts"
import { describe, expect, it } from "vitest"
import {
  createScriptSessionStore,
  MAX_RUNNING_SCRIPTS,
  type ScriptRunnerFn,
} from "./ScriptSessionStore"

function makeScript(label: string): ProjectScript {
  return {
    id: `package:package.json:${label}`,
    kind: "package",
    label,
    command: "npm",
    args: ["run", label],
    cwd: "/proj",
    source: "package.json",
    detail: "",
    preview: `npm run ${label}`,
  }
}

function makeFakeRunner() {
  const calls: {
    script: ProjectScript
    opts: { onOutput: (chunk: string) => void, onExit: (code: number | null) => void }
    handle: { pid: number | undefined, kill: () => void, killed: boolean }
  }[] = []
  const runner: ScriptRunnerFn = (script, opts) => {
    const handle = {
      pid: 1000 + calls.length,
      killed: false,
      kill: () => { handle.killed = true },
    }
    calls.push({ script, opts, handle })
    return handle
  }
  return { runner, calls }
}

describe("createScriptSessionStore", () => {
  it("start 建立 running 会话并转交执行器", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    const s = store.start("p1", makeScript("dev"))
    expect(s?.status).toBe("running")
    expect(s?.pid).toBe(1000)
    expect(calls).toHaveLength(1)
    expect(store.hasRunningByProject("p1")).toBe(true)
  })

  it("输出追加到日志并可物化回看", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("dev"))
    calls[0].opts.onOutput("hello\n")
    calls[0].opts.onOutput("世界\n")
    expect(store.get("p1", "package:package.json:dev")?.log).toBe("hello\n世界\n")
  })

  it("日志超量裁头保尾，不无界增长", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("build"))
    calls[0].opts.onOutput("A".repeat(120_000))
    calls[0].opts.onOutput("B".repeat(120_000))
    calls[0].opts.onOutput("TAIL")
    const log = store.get("p1", "package:package.json:build")?.log ?? ""
    expect(log.length).toBeLessThanOrEqual(200_000)
    expect(log.endsWith("TAIL")).toBe(true)
  })

  it("自然退出：状态 exited 且保留退出码与日志", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("test"))
    calls[0].opts.onOutput("done\n")
    calls[0].opts.onExit(0)
    const s = store.get("p1", "package:package.json:test")
    expect(s?.status).toBe("exited")
    expect(s?.exitCode).toBe(0)
    expect(s?.log).toBe("done\n")
    expect(store.hasRunningByProject("p1")).toBe(false)
  })

  it("stop 杀进程树，且之后的输出/退出事件不再回灌", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("dev"))
    calls[0].opts.onOutput("before\n")
    store.stop("p1", "package:package.json:dev")
    expect(calls[0].handle.killed).toBe(true)
    calls[0].opts.onOutput("after\n")
    calls[0].opts.onExit(1)
    const s = store.get("p1", "package:package.json:dev")
    expect(s?.status).toBe("stopped")
    expect(s?.log).toBe("before\n")
  })

  it("同脚本运行中重复 start 幂等，不起第二个进程", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    const a = store.start("p1", makeScript("dev"))
    const b = store.start("p1", makeScript("dev"))
    expect(b?.id).toBe(a?.id)
    expect(calls).toHaveLength(1)
  })

  it("结束后重跑开新会话（退出码不再残留）", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("dev"))
    calls[0].opts.onExit(1)
    const again = store.start("p1", makeScript("dev"))
    expect(again?.status).toBe("running")
    expect(again?.exitCode).toBeNull()
    expect(calls).toHaveLength(2)
  })

  it(`并发超过 ${MAX_RUNNING_SCRIPTS} 时 start 返回 null`, () => {
    const { runner } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    for (let i = 0; i < MAX_RUNNING_SCRIPTS; i++) {
      expect(store.start("p1", makeScript(`s${i}`))).not.toBeNull()
    }
    expect(store.start("p1", makeScript("overflow"))).toBeNull()
  })

  it("已结束会话只保留最近 3 个，最旧被淘汰", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    for (let i = 0; i < 4; i++) {
      store.start("p1", makeScript(`s${i}`))
      calls[i].opts.onExit(0)
    }
    const ids = store.listByProject("p1").map((s) => s.script.label)
    expect(ids).toEqual(["s1", "s2", "s3"])
  })

  it("destroyAll 杀全部运行中会话并清空", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("a"))
    store.start("p1", makeScript("b"))
    store.destroyAll()
    expect(calls[0].handle.killed).toBe(true)
    expect(calls[1].handle.killed).toBe(true)
    expect(store.listByProject("p1")).toHaveLength(0)
  })

  it("onChange 收到变更通知，退订后不再收到", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    let n = 0
    const off = store.onChange(() => { n++ })
    store.start("p1", makeScript("dev"))
    calls[0].opts.onOutput("x")
    expect(n).toBe(2)
    off()
    calls[0].opts.onOutput("y")
    expect(n).toBe(2)
  })

  it("listRunningPids 只含运行中会话，退出/停止后移除", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    store.start("p1", makeScript("a"))
    store.start("p1", makeScript("b"))
    expect(store.listRunningPids().sort()).toEqual([1000, 1001])
    calls[0].opts.onExit(0)
    store.stop("p1", "package:package.json:b")
    expect(store.listRunningPids()).toEqual([])
  })

  it("onPidsChange 仅在 pid 集合变化时触发，日志追加不触发", () => {
    const { runner, calls } = makeFakeRunner()
    const store = createScriptSessionStore(runner)
    let n = 0
    store.onPidsChange(() => { n++ })
    store.start("p1", makeScript("dev"))
    expect(n).toBe(1)
    calls[0].opts.onOutput("log-line")
    expect(n).toBe(1)
    calls[0].opts.onExit(0)
    expect(n).toBe(2)
  })
})
