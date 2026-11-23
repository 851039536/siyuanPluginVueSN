// 提交日志读模型（真实 git）：%P 父 hash 与 %D 引用装饰
//
// 锁住 F0.2 的输出口径：merge 提交双父、根提交空父数组、Tag/分支装饰可见，
// 以及 parents 必须是完整 40 位 hash（供后续提交图直接连边）。
import type { GitPushStorage } from "../types/storage"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { WorktreeOps } from "./WorktreeOps"

const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-commitlog-"))
  const globalCfg = join(dir, "gitconfig")
  const systemCfg = join(dir, "gitsystemconfig")
  writeFileSync(globalCfg, "")
  writeFileSync(systemCfg, "")
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalCfg,
    GIT_CONFIG_SYSTEM: systemCfg,
    GIT_CONFIG_NOSYSTEM: "1",
    TZ: "UTC",
    LC_ALL: "C",
    LANG: "C",
  }
})()

process.env.GIT_CONFIG_GLOBAL = ISOLATED_ENV.GIT_CONFIG_GLOBAL
process.env.GIT_CONFIG_SYSTEM = ISOLATED_ENV.GIT_CONFIG_SYSTEM
process.env.GIT_CONFIG_NOSYSTEM = "1"

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  }).trim()
}

describe("getCommitLog：parents 与 refs", () => {
  let root = ""
  let repo = ""
  let worktree: WorktreeOps

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "gp-commit-log-"))
    repo = join(root, "repo")
    execFileSync("git", ["init", "-q", "-b", "main", repo], {
      encoding: "utf8",
      windowsHide: true,
      env: ISOLATED_ENV,
    })
    git(repo, ["config", "user.email", "t@example.com"])
    git(repo, ["config", "user.name", "tester"])
    git(repo, ["config", "core.autocrlf", "false"])

    // 根提交 + 轻量 Tag，验证根提交 parents 为空、Tag 出现在 %D
    writeFileSync(join(repo, "a.txt"), "one\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "chore: init"])
    git(repo, ["tag", "v1"])

    // 侧分支提交，验证分支装饰；再回 main 提交并 --no-ff 合并，验证双父
    git(repo, ["checkout", "-q", "-b", "feature"])
    writeFileSync(join(repo, "feature.txt"), "feature\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "feat: feature"])
    git(repo, ["checkout", "-q", "main"])
    writeFileSync(join(repo, "main.txt"), "main\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "chore: main"])
    git(repo, ["merge", "--no-ff", "feature", "-m", "merge feature"])

    worktree = new WorktreeOps(new GitExecutor({} as GitPushStorage))
  }, 60_000)

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true })
    } catch {
      /* 清理失败不掩盖断言 */
    }
  })

  it("merge 提交有两个完整父 hash，且 isMerge=true", async () => {
    const log = await worktree.getCommitLog(repo, "all")
    const merge = log.find((entry) => entry.message === "merge feature")
    expect(merge?.isMerge).toBe(true)
    expect(merge?.parents).toHaveLength(2)
    expect(merge?.parents?.every((hash) => /^[0-9a-f]{40}$/.test(hash))).toBe(true)
  })

  it("根提交 parents 为空数组，Tag 装饰可见", async () => {
    const log = await worktree.getCommitLog(repo, "all")
    const init = log.find((entry) => entry.message === "chore: init")
    expect(init?.parents).toEqual([])
    expect(init?.refs).toContain("tag: v1")
  })

  it("侧分支提交带分支装饰，HEAD 指向当前分支", async () => {
    const log = await worktree.getCommitLog(repo, "all")
    const feature = log.find((entry) => entry.message === "feat: feature")
    expect(feature?.refs).toContain("feature")
    const merge = log.find((entry) => entry.message === "merge feature")
    expect(merge?.refs?.some((ref) => ref.startsWith("HEAD -> main"))).toBe(true)
  })
})
