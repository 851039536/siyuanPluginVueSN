// 只读方法「失败必须抛出」的端到端语义（真实 git 仓库，P2-2）
//
// 锁住的是**错误语义**而不是解析结果：这几个方法曾经统一 `catch { return [] }`，
// 于是仓库被删/改名/无权限时，卡片把「读不到」显示成「暂无提交记录 / 暂无 stash / 暂无 Tag」，
// 还把详情标记为已加载、此后再不重试（用户只能靠别的现象猜）。
//
// 现在约定：**成功但为空** → 返回空集合；**命令失败** → 抛出，由调用方呈现错误态。
import type { GitPushStorage } from "../types/storage"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { RepoOps } from "./RepoOps"
import { WorktreeOps } from "./WorktreeOps"

const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-readfail-"))
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

describe("只读方法：空仓库返回空集合，读不到则抛出", () => {
  let root = ""
  let repo = ""
  let worktree: WorktreeOps
  let repoOps: RepoOps

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "gp-read-failure-"))
    repo = join(root, "repo")
    mkdirSync(repo, { recursive: true })
    git(repo, ["init", "-q", "-b", "main"])
    git(repo, ["config", "user.email", "t@example.com"])
    git(repo, ["config", "user.name", "tester"])
    git(repo, ["config", "core.autocrlf", "false"])
    writeFileSync(join(repo, "a.txt"), "one\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "chore: init"])

    const executor = new GitExecutor({} as GitPushStorage)
    worktree = new WorktreeOps(executor)
    repoOps = new RepoOps(executor)
    // 放宽建仓超时：全量并发跑时这里也要 spawn 多次 git
  }, 60_000)

  afterAll(() => {
    try {
      rmSync(root, {
        recursive: true,
        force: true,
      })
    } catch {
      /* 清理失败不掩盖断言 */
    }
  })

  it("成功但为空：无 stash / 无 Tag / 无冲突都返回空集合（不是错误）", async () => {
    await expect(worktree.stashList(repo)).resolves.toEqual([])
    await expect(repoOps.getTags(repo)).resolves.toEqual([])
    await expect(repoOps.getConflictFiles(repo)).resolves.toEqual([])
  })

  it("有数据时照常返回（分支 / 提交日志）", async () => {
    const branches = await worktree.getBranches(repo)
    expect(branches.map((b) => b.name)).toContain("main")

    const log = await worktree.getCommitLog(repo, 5)
    expect(log).toHaveLength(1)
    expect(log[0].message).toBe("chore: init")
  })

  it("仓库目录被删除：五个只读方法全部抛出（不得伪装成空集合）", async () => {
    const gone = join(root, "gone")
    mkdirSync(gone, { recursive: true })
    git(gone, ["init", "-q", "-b", "main"])
    rmSync(gone, {
      recursive: true,
      force: true,
    })

    const calls: [string, () => Promise<unknown>][] = [
      ["getCommitLog", () => worktree.getCommitLog(gone, 5)],
      ["getBranches", () => worktree.getBranches(gone)],
      ["stashList", () => worktree.stashList(gone)],
      ["getTags", () => repoOps.getTags(gone)],
      ["getConflictFiles", () => repoOps.getConflictFiles(gone)],
    ]
    for (const [name, run] of calls) {
      // 逐个断言：任何一个「吞错返回空」都会让这里红
      await expect(run(), `${name} 必须抛出而不是返回空集合`).rejects.toThrow()
    }
  })
})
