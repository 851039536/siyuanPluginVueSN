// src/features/gitPush/managers/pushPreflight.git.spec.ts — 推送前预检行为回归
//
// 背景：`checkPushStatus` 只比对**本地**跟踪 ref，反映的是上次 fetch 的快照。
// 远程在此期间被其他客户端推进时本地无从得知，直接推送只能吃 non-fast-forward。
// 预检用一次 `ls-remote`（不写 refs、不拉对象）补上这个窗口。
//
// 本测试用真实 git 锁住四条不变量：
//   ① 远程被推进 → moved=true，必须交给用户决策；
//   ② fetch 更新跟踪 ref 后 → moved=false，可直接推送（避免误报）；
//   ③ 远程无该分支（首次推送）→ moved=false（不存在被拒风险）；
//   ④ 探测失败 → unknown=true 且不阻塞（预检不能变成「网络差就推不出去」）。
import type { GitProject } from "../types/storage"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { ProjectWriteLock } from "./ProjectWriteLock"
import { RemoteOps } from "./RemoteOps"

/** 真实执行 git（测试编排用，不经过被测的 GitExecutor 并发池） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

describe("推送前预检（真实 git + 真实 ls-remote）", () => {
  let root = ""
  let remote = ""
  let local = ""
  let peer = ""
  let ops: RemoteOps
  let executor: GitExecutor
  const projectsById: Record<string, GitProject> = {}

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "gp-preflight-"))
    remote = join(root, "remote.git")
    local = join(root, "local")
    peer = join(root, "peer")

    git(root, ["init", "-q", "--bare", "-b", "main", remote])
    git(root, ["clone", "-q", remote, local])
    for (const dir of [local]) {
      git(dir, ["config", "user.email", "local@test"])
      git(dir, ["config", "user.name", "local"])
    }
    git(local, ["checkout", "-q", "-b", "main"])
    writeFileSync(join(local, "f.txt"), "1")
    git(local, ["add", "-A"])
    git(local, ["commit", "-qm", "c1"])
    git(local, ["push", "-q", "-u", "origin", "main"])

    // 另一份 clone 推一个新提交 → 远程 head 前进，而 local 的跟踪 ref 仍停留在 c1
    git(root, ["clone", "-q", remote, peer])
    git(peer, ["config", "user.email", "peer@test"])
    git(peer, ["config", "user.name", "peer"])
    writeFileSync(join(peer, "f.txt"), "2")
    git(peer, ["commit", "-qam", "c2"])
    git(peer, ["push", "-q", "origin", "main"])

    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      localTimeout: { loadOrDefault: async () => 60 },
      gitConcurrency: { loadOrDefault: async () => 10 },
      pushBranchMode: { loadOrDefault: async () => "head" as const, save: async () => true },
    } as never
    const fakeStore = {
      getProjectById: async (id: string) => projectsById[id] ?? null,
    } as never

    // 预检的进程数断言需要观察真实发出的命令，故单独持有 executor 引用
    executor = new GitExecutor(fakeStorage)
    ops = new RemoteOps(executor, fakeStore, fakeStorage, new ProjectWriteLock())

    projectsById.main = {
      id: "main",
      name: "preflight-main",
      get path() { return local },
      githubRemote: "origin",
    } as unknown as GitProject
    projectsById.bad = {
      id: "bad",
      name: "preflight-bad",
      get path() { return local },
      githubRemote: "does-not-exist",
    } as unknown as GitProject
    // 3 个已配置远程：用于验证「本地跟踪 ref 的读取次数不随远程数增长」
    projectsById.multi = {
      id: "multi",
      name: "preflight-multi",
      get path() { return local },
      githubRemote: "origin",
      giteeRemote: "upstream-missing",
      cnbRemote: "mirror-missing",
    } as unknown as GitProject
  }, 120000)

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("远程被推进：moved=true 且要求用户决策", async () => {
    const pre = await ops.preflightPush("main", { timeoutMs: 30000 })
    const origin = pre.remotes.find((r) => r.remoteName === "origin")
    expect(origin?.moved).toBe(true)
    expect(origin?.unknown).toBe(false)
    expect(pre.needsDecision).toBe(true)
  }, 60000)

  it("fetch 更新跟踪 ref 后：moved=false，不再误报", async () => {
    git(local, ["fetch", "-q", "origin"])
    const pre = await ops.preflightPush("main", { timeoutMs: 30000 })
    expect(pre.remotes.find((r) => r.remoteName === "origin")?.moved).toBe(false)
    expect(pre.needsDecision).toBe(false)
  }, 60000)

  it("远程无该分支（首次推送）：moved=false，不算未知", async () => {
    git(local, ["checkout", "-q", "-b", "feature/preflight"])
    writeFileSync(join(local, "g.txt"), "1")
    git(local, ["add", "-A"])
    git(local, ["commit", "-qm", "c3"])
    const pre = await ops.preflightPush("main", { timeoutMs: 30000 })
    const origin = pre.remotes.find((r) => r.remoteName === "origin")
    expect(origin?.moved).toBe(false)
    expect(origin?.unknown).toBe(false)
    expect(pre.needsDecision).toBe(false)
    git(local, ["checkout", "-q", "main"])
  }, 60000)

  it("探测失败：unknown=true 且不阻塞推送", async () => {
    const pre = await ops.preflightPush("bad", { timeoutMs: 30000 })
    expect(pre.remotes).toHaveLength(1)
    expect(pre.remotes[0].unknown).toBe(true)
    expect(pre.remotes[0].moved).toBe(false)
    expect(pre.needsDecision).toBe(false)
  }, 60000)

  it("项目不存在：空结果，不抛错", async () => {
    const pre = await ops.preflightPush("missing", { timeoutMs: 30000 })
    expect(pre.remotes).toHaveLength(0)
    expect(pre.needsDecision).toBe(false)
  }, 30000)

  /**
   * P1-6 回归：本地跟踪 ref 必须**一次批量**读取，不能按远程逐个 `rev-parse --verify`。
   * 3 个远程时进程数应为 `1（分支解析）+ 1（批量 refs）+ 3（ls-remote 网络）`，
   * 原实现是 `1 + 3 + 3 = 7` 次本地进程里的 3 次纯属浪费。
   */
  it("本地跟踪 ref 一次批量读取：进程数不随远程数增长", async () => {
    const spy = vi.spyOn(executor, "execGit")
    try {
      await ops.preflightPush("multi", { timeoutMs: 30000 })
      const commands = spy.mock.calls.map((call) => (call[1] as string[]).join(" "))
      expect(commands.filter((c) => c.startsWith("rev-parse --verify"))).toHaveLength(0)
      expect(commands.filter((c) => c.startsWith("for-each-ref") && c.includes("refs/remotes"))).toHaveLength(1)
      expect(commands.filter((c) => c.startsWith("ls-remote"))).toHaveLength(3)
    } finally {
      spy.mockRestore()
    }
  }, 60000)
})
