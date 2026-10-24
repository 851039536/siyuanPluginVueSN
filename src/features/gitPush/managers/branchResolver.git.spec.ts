// GitExecutor.getCurrentBranch 真实 git 回归：分支 / detached / 空仓库（unborn）三态
//
// 背景：RemoteOps 与 WorktreeOps 曾有各自的分支解析实现，前者做 detached 归一化与
// symbolic-ref 兜底，后者只跑 rev-parse（detached 会返回字符串 "HEAD"）。
// 统一到 GitExecutor 后，这里锁住三态语义，防止后续退回两套实现。
import type { GitExecutor } from "./GitExecutor"
import { execFileSync } from "node:child_process"
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

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

describe("GitExecutor.getCurrentBranch（真实 git）", () => {
  let root = ""
  let executor: GitExecutor

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "gp-branch-"))
    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      gitConcurrency: { loadOrDefault: async () => 10 },
    } as never
    const { GitExecutor: ExecutorClass } = await import("./GitExecutor")
    executor = new ExecutorClass(fakeStorage)
  }, 60000)

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("普通分支返回分支名", async () => {
    const repo = join(root, "normal")
    git(root, ["init", "-q", "-b", "main", repo])
    git(repo, ["config", "user.email", "t@test"])
    git(repo, ["config", "user.name", "t"])
    writeFileSync(join(repo, "f.txt"), "1")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "c1"])

    expect(await executor.getCurrentBranch(repo)).toBe("main")
  })

  it("detached HEAD 归一化为空串（不得返回字符串 HEAD）", async () => {
    const repo = join(root, "detached")
    git(root, ["init", "-q", "-b", "main", repo])
    git(repo, ["config", "user.email", "t@test"])
    git(repo, ["config", "user.name", "t"])
    writeFileSync(join(repo, "f.txt"), "1")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "c1"])
    git(repo, ["checkout", "-q", "--detach", "HEAD"])

    expect(await executor.getCurrentBranch(repo)).toBe("")
  })

  it("空仓库（unborn branch）回退 symbolic-ref 返回待建立分支名", async () => {
    const repo = join(root, "unborn")
    git(root, ["init", "-q", "-b", "main", repo])

    expect(await executor.getCurrentBranch(repo)).toBe("main")
  })
})
