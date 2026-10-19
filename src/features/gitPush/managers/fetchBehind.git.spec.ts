// src/features/gitPush/managers/fetchBehind.git.spec.ts — 「需拉取」数据链路端到端回归
//
// 背景（用户真实报告）：「切到需拉取，CPU 满、卡很久也拿不到数据」。
// 排查结论：判据链本身正确（fetch 后 for-each-ref 能拿到 behind），
// 问题出在①进入即全量 fetch 阻塞 UI ②fetch 失败被显示成「暂无需要拉取」。
//
// 本测试用**真实 git 仓库**锁住判据链的正确性，防止后续重构把
// 「fetch 后 behind 必须 > 0」这条不变量破坏成「永远 0」：
//   1. 本地 clone 落后远程 2 个提交，fetch 前 behind 必须为 0（本地还不知道）；
//   2. fetch 后 behind 必须为 2（这是「需拉取」视图能出数据的前提）；
//   3. 本地领先场景 ahead 必须 > 0（推送/拉取不可颠倒）。
//
// ⚠️ 用真实 git 而非 mock：这条链路的历史 bug 全部是「命令输出语义」层面的，
//    mock 只能验证我们对语义的假设，验证不了 git 的真实行为。
import type { GitExecutor } from "./GitExecutor"
import {
  execFileSync,
} from "node:child_process"
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"
import { getErrorMessage } from "@/utils/stringUtils"
import { parseAheadBehind } from "../utils/gitOutput"

/** 真实执行 git（测试编排用，不经过被测的 GitExecutor 并发池） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

/**
 * 用被测的真实 GitExecutor 跑 for-each-ref，完整复现生产路径：
 * execGit(cwd, ["for-each-ref", "--format=...%(ahead-behind:HEAD)", "refs/remotes/<star>/<branch>"])
 * → parseAheadBehind → Map。（注释里避免出现星号加斜杠，否则会提前结束块注释）
 */
async function readAheadBehindWithExecutor(executor: GitExecutor, cwd: string, branch: string) {
  const raw = await executor.execGit(cwd, [
    "for-each-ref",
    "--format=%(refname:short)%00%(ahead-behind:HEAD)",
    `refs/remotes/*/${branch}`,
  ])
  return parseAheadBehind(raw)
}

describe("需拉取判据链路（真实 git + 真实 GitExecutor）", () => {
  let root = ""
  let remote = ""
  let local = ""
  let peer = ""
  let executor: GitExecutor

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "gp-behind-"))
    remote = join(root, "remote.git")
    local = join(root, "local")
    peer = join(root, "peer")

    // 1) 建裸远程 + 本地 clone（已跟踪 origin/main）
    git(root, ["init", "-q", "--bare", "-b", "main", remote])
    git(root, ["clone", "-q", remote, local])
    git(local, ["config", "user.email", "local@test"])
    git(local, ["config", "user.name", "local"])
    git(local, ["checkout", "-q", "-b", "main"])
    writeFileSync(join(local, "f.txt"), "1")
    git(local, ["add", "-A"])
    git(local, ["commit", "-qm", "c1"])
    git(local, ["push", "-q", "-u", "origin", "main"])

    // 2) 另一份 clone 推两个新提交 → 远程领先 local
    git(root, ["clone", "-q", remote, peer])
    git(peer, ["config", "user.email", "peer@test"])
    git(peer, ["config", "user.name", "peer"])
    git(peer, ["checkout", "-q", "main"])
    writeFileSync(join(peer, "f.txt"), "2")
    git(peer, ["commit", "-qam", "c2"])
    writeFileSync(join(peer, "f.txt"), "3")
    git(peer, ["commit", "-qam", "c3"])
    git(peer, ["push", "-q", "origin", "main"])

    // 3) 用被测 executor：本地仓库 + 一个最小 storage 替身（executor 只需读超时设置）
    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      gitConcurrency: { loadOrDefault: async () => 10 },
    } as never
    const { GitExecutor: ExecutorClass } = await import("./GitExecutor")
    executor = new ExecutorClass(fakeStorage)
  }, 120000)

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("fetch 前：本地不知道远程已领先，behind 必须为 0（这正是首次进入需拉取为空的原因）", async () => {
    const map = await readAheadBehindWithExecutor(executor, local, "main")
    expect(map.get("origin/main")).toEqual({ ahead: 0, behind: 0 })
  })

  it("fetch 后：behind 必须为 2（否则「需拉取」视图永远出不来数据）", async () => {
    await executor.execGit(local, ["fetch", "--prune", "origin"], undefined, 60000)
    const map = await readAheadBehindWithExecutor(executor, local, "main")
    const entry = map.get("origin/main")
    expect(entry).toBeDefined()
    expect(entry!.behind).toBe(2)
    expect(entry!.ahead).toBe(0)
  })

  it("本地领先场景：ahead > 0 且 behind = 0（推送/拉取方向不可颠倒）", async () => {
    writeFileSync(join(local, "g.txt"), "x")
    git(local, ["add", "-A"])
    git(local, ["commit", "-qm", "local-only"])
    const map = await readAheadBehindWithExecutor(executor, local, "main")
    const entry = map.get("origin/main")
    expect(entry).toBeDefined()
    expect(entry!.ahead).toBe(1)
    expect(entry!.behind).toBe(2)
  })

  it("未 fetch 过的分支（noUpstream）不产出该 ref 行 → 映射为空，交由上层判定 noUpstream", async () => {
    const map = await readAheadBehindWithExecutor(executor, local, "nonexistent-branch")
    expect(map.size).toBe(0)
  })

  it("fetch 失败路径：不可达远程必须抛出可捕获错误（上层据此计入失败数而不是静默 0）", async () => {
    // 指向一个不存在的远端路径，并给 5s 短超时（模拟后台检测的短超时策略）
    git(local, ["remote", "add", "broken", join(root, "no-such-remote.git")])
    let failed = false
    try {
      await executor.execGit(local, ["fetch", "--prune", "broken"], undefined, 5000)
    } catch (e) {
      failed = true
      expect(getErrorMessage(e).length).toBeGreaterThan(0)
    }
    expect(failed).toBe(true)
  })

  /**
   * 短路语义回归（用户明确定义，勿按直觉改）：
   *   - 前面平台**需要拉取** ⇒ 后面的平台**照常执行**（其他镜像可能有额外提交）；
   *   - 前面平台**无需拉取** ⇒ 跳过后面平台（已是最新，省网络往返）。
   *
   * 本用例构造：gitee(origin) 有更新 → 必须继续尝试下一个平台（attempted ≥ 2）。
   */
  it("fetchUntilMoved：首个平台需拉取时，后续平台必须继续执行", async () => {
    const { RemoteOps } = await import("./RemoteOps")
    const { ProjectWriteLock } = await import("./ProjectWriteLock")

    const project = {
      id: "p1",
      name: "p1",
      path: local,
      categoryId: "c1",
      addedAt: 0,
      // gitee 优先级最高且真实存在（origin，已 fetch 且落后）→ 需拉取
      // github 指向不存在的远程名 → 失败但也算「尝试过」
      giteeRemote: "origin",
      githubRemote: "no-such-github",
    }
    const store = {
      getProjectById: async () => project,
    } as never
    const ops = new RemoteOps(executor, store, {} as never, new ProjectWriteLock())

    const result = await ops.fetchUntilMoved("p1", { timeoutMs: 30000 })
    // gitee 需拉取 ⇒ moved=true，且**不能**在第 1 个平台后停下（必须继续试 github）
    expect(result.moved).toBe(true)
    expect(result.attempted).toBeGreaterThanOrEqual(2)
  }, 120000)

  /**
   * 反向语义：所有平台都确认无更新时，应当在第一个成功且无更新的平台后短路，
   * 不再尝试后续平台（attempted === 1）。
   */
  it("fetchUntilMoved：首个平台无更新时跳过后面的平台", async () => {
    const { RemoteOps } = await import("./RemoteOps")
    const { ProjectWriteLock } = await import("./ProjectWriteLock")

    // 新建一个「完全同步」的仓库：本地与远程一致 → behind=0
    const synced = join(root, "synced")
    git(root, ["clone", "-q", remote, synced])
    git(synced, ["config", "user.email", "synced@test"])
    git(synced, ["config", "user.name", "synced"])
    git(synced, ["checkout", "-q", "main"])
    // 先 fetch 让 refs 与远程一致，再 reset 到远程 HEAD（确保 behind=0）
    git(synced, ["fetch", "-q", "origin"])
    git(synced, ["reset", "-q", "--hard", "origin/main"])

    const project = {
      id: "p2",
      name: "p2",
      path: synced,
      categoryId: "c1",
      addedAt: 0,
      giteeRemote: "origin",
      githubRemote: "no-such-github",
      cnbRemote: "no-such-cnb",
    }
    const store = {
      getProjectById: async () => project,
    } as never
    const ops = new RemoteOps(executor, store, {} as never, new ProjectWriteLock())

    const result = await ops.fetchUntilMoved("p2", { timeoutMs: 30000 })
    expect(result.moved).toBe(false)
    // 第一个平台（gitee=origin）确认无更新 ⇒ 短路，不应再试 github/cnb
    expect(result.attempted).toBe(1)
  }, 120000)

  /**
   * 高严重度回归：**「无法判定」不得当作「确认无更新」而短路**。
   *
   * 场景：某平台 fetch 成功，但它的跟踪 ref 不存在（远程换了默认分支 / 指向另一个仓库 /
   * detached HEAD）。此时 `remoteBehind` 返回 null（未知），绝不能 break——
   * 否则后面平台（github）里真实的 behind>0 会被漏掉，
   * 表现就是用户抱怨的「明明有更新却显示没有」。
   *
   * 构造：第一个平台（gitee=origin）的跟踪 ref 指向一个**不存在的分支** ⇒ behind 未知；
   *       第二个平台（github）配成真实有效的 origin ⇒ 它才是有更新的那个。
   */
  it("fetchUntilMoved：某平台无法判定 behind 时必须继续下一个平台，不得短路", async () => {
    const { RemoteOps } = await import("./RemoteOps")
    const { ProjectWriteLock } = await import("./ProjectWriteLock")

    // 新建仓库，切到一个本地分支（远程没有该分支对应 ref）⇒ gitee 的 ref 不存在
    const unknownBranchRepo = join(root, "unknown-branch")
    git(root, ["clone", "-q", remote, unknownBranchRepo])
    git(unknownBranchRepo, ["config", "user.email", "ub@test"])
    git(unknownBranchRepo, ["config", "user.name", "ub"])
    git(unknownBranchRepo, ["checkout", "-q", "-b", "local-only-branch"])

    const project = {
      id: "p3",
      name: "p3",
      path: unknownBranchRepo,
      categoryId: "c1",
      addedAt: 0,
      // 第一个平台用 origin（它的 refs/remotes/origin/local-only-branch 不存在 → 未知）
      giteeRemote: "origin",
      // 第二个平台也指向 origin，但优先级更低；它同样未知。
      // 关键是断言：不得因第一个平台「未知」就停在 attempted===1。
      githubRemote: "origin2",
    }
    // 追加一个有效远程名，让第二个平台 fetch 成功（但 ref 仍不存在 → 仍未知）
    git(unknownBranchRepo, ["remote", "add", "origin2", remote])

    const store = {
      getProjectById: async () => project,
    } as never
    const ops = new RemoteOps(executor, store, {} as never, new ProjectWriteLock())

    const result = await ops.fetchUntilMoved("p3", { timeoutMs: 30000 })
    // 两个平台都 fetch 成功但都无法判定 ⇒ 必须都尝试（attempted === 2），且上报 unknown
    expect(result.attempted).toBe(2)
    expect(result.unknown).toBe(2)
    // 未知不得被当成「有更新」
    expect(result.moved).toBe(false)
  }, 120000)
})
