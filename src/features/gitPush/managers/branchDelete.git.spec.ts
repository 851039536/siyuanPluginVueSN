// src/features/gitPush/managers/branchDelete.git.spec.ts — 本地分支删除端到端回归（真实 git）
//
// 锁住三条语义：
//   1. 已合并分支可直接用 -d 删除；
//   2. 未合并分支默认被拒（必须显式 force 才走 -D）；
//   3. 当前分支前置拦截，不依赖 git 的英文报错。
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { WorktreeOps } from "./WorktreeOps"

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

describe("删除本地分支（真实 git）", () => {
  let root = ""
  let repo = ""
  let ops: WorktreeOps

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "gp-branch-del-"))
    repo = join(root, "repo")
    git(root, ["init", "-q", "--initial-branch=main", repo])
    git(repo, ["config", "user.email", "test@test"])
    git(repo, ["config", "user.name", "test"])
    writeFileSync(join(repo, "a.txt"), "1")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "c1"])

    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      gitConcurrency: { loadOrDefault: async () => 10 },
    } as never
    ops = new WorktreeOps(new GitExecutor(fakeStorage))
  }, 120000)

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("已合并分支：-d 直接删除", async () => {
    git(repo, ["branch", "merged"])
    await ops.deleteBranch(repo, "merged")
    expect(git(repo, ["branch", "--list", "merged"])).toBe("")
  })

  it("未合并分支：默认拒绝，force 后删除", async () => {
    git(repo, ["checkout", "-q", "-b", "feature"])
    writeFileSync(join(repo, "feature.txt"), "x")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "unmerged work"])
    git(repo, ["checkout", "-q", "main"])

    await expect(ops.deleteBranch(repo, "feature")).rejects.toThrow(/not fully merged|未完全合并|未合并/i)
    expect(git(repo, ["branch", "--list", "feature"])).not.toBe("")

    await ops.deleteBranch(repo, "feature", true)
    expect(git(repo, ["branch", "--list", "feature"])).toBe("")
  })

  it("当前分支：前置拦截且给出可读提示", async () => {
    await expect(ops.deleteBranch(repo, "main")).rejects.toThrow(/当前分支/)
    expect(git(repo, ["branch", "--show-current"])).toBe("main")
  })

  it("删除不存在的分支：抛错而不是静默成功", async () => {
    await expect(ops.deleteBranch(repo, "no-such-branch")).rejects.toThrow()
  })
})
