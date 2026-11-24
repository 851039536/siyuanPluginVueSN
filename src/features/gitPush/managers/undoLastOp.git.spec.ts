// 撤销上一操作（真实 git）：commit 用 --soft，merge/reset 用 --hard 回 headBefore 且先备份；
// 日志与当前仓库状态不符时拒绝自动撤销
import type { GitPushStorage } from "../types/storage"
import type { WriteJournalEntry } from "./WriteJournal"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { BackupOps } from "./BackupOps"
import { GitExecutor } from "./GitExecutor"
import { UndoOps } from "./UndoOps"

const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-undo-"))
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

const roots: string[] = []

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  }).trim()
}

function setupRepo() {
  const root = mkdtempSync(join(tmpdir(), "gp-undo-"))
  roots.push(root)
  const repo = join(root, "repo")
  execFileSync("git", ["init", "-q", "-b", "main", repo], {
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  })
  git(repo, ["config", "user.email", "t@example.com"])
  git(repo, ["config", "user.name", "tester"])
  git(repo, ["config", "core.autocrlf", "false"])

  writeFileSync(join(repo, "a.txt"), "one\n")
  git(repo, ["add", "a.txt"])
  git(repo, ["commit", "-qm", "c1"])
  const c1 = git(repo, ["rev-parse", "HEAD"])

  writeFileSync(join(repo, "a.txt"), "two\n")
  git(repo, ["commit", "-qam", "c2"])
  const c2 = git(repo, ["rev-parse", "HEAD"])

  writeFileSync(join(repo, "a.txt"), "three\n")
  git(repo, ["commit", "-qam", "c3"])
  const c3 = git(repo, ["rev-parse", "HEAD"])

  const executor = new GitExecutor({} as GitPushStorage)
  const backupRoot = join(root, "backups")
  const backupOps = new BackupOps(executor, () => backupRoot)
  return { root, repo, c1, c2, c3, backupRoot, undoOps: new UndoOps(executor, backupOps) }
}

function entry(overrides: Partial<WriteJournalEntry>): WriteJournalEntry {
  return {
    op: "commit",
    at: "2026-11-24T09:00:00.000Z",
    headBefore: "",
    branchBefore: "main",
    reflogBefore: "",
    label: "",
    ...overrides,
  }
}

function backupCount(dir: string): number {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".bundle")).length : 0
}

describe("UndoOps.undo", () => {
  it("撤销提交：--soft 回到父提交，改动留在暂存区，不产生备份", async () => {
    const { repo, c2, c3, backupRoot, undoOps } = setupRepo()
    await undoOps.undo(repo, entry({ op: "commit", headBefore: c2 }))
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c2)
    expect(git(repo, ["diff", "--cached", "--name-only"]).split("\n")).toContain("a.txt")
    expect(backupCount(join(backupRoot, "reset-backups", "repo"))).toBe(0)
    // 被撤销的提交仍可从 reflog 找回
    expect(git(repo, ["reflog", "show", "-1", "--format=%H"])).not.toBe(c3)
  })

  it("撤销提交：HEAD 已前进时拒绝自动撤销", async () => {
    const { repo, c1, undoOps } = setupRepo()
    await expect(undoOps.undo(repo, entry({ op: "commit", headBefore: c1 })))
      .rejects.toThrow(/HEAD 已变化/)
  })

  it("撤销提交：分支已切换时拒绝自动撤销", async () => {
    const { repo, c2, undoOps } = setupRepo()
    git(repo, ["checkout", "-qb", "feature"])
    await expect(undoOps.undo(repo, entry({ op: "commit", headBefore: c2, branchBefore: "main" })))
      .rejects.toThrow(/当前分支已从 main 切换/)
  })

  // 合并条目目前没有生产写入方（记账归路线图 F4 的合并能力），此用例用合成日志
  // 固定「F4 接入后撤销合并」的行为口径
  it("撤销合并：--hard 回到合并前 head，且先生成 bundle 备份", async () => {
    const { repo, c1, c3, backupRoot, undoOps } = setupRepo()
    git(repo, ["checkout", "-qb", "feature", c1])
    writeFileSync(join(repo, "b.txt"), "feature\n")
    git(repo, ["add", "b.txt"])
    git(repo, ["commit", "-qm", "f1"])
    git(repo, ["checkout", "-q", "main"])
    git(repo, ["merge", "--no-ff", "-m", "merge feature", "feature"])

    await undoOps.undo(repo, entry({ op: "merge", headBefore: c3 }))
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c3)
    expect(existsSync(join(repo, "b.txt"))).toBe(false)
    expect(backupCount(join(backupRoot, "reset-backups", "repo"))).toBe(1)
  })

  it("撤销重置：--hard 回到重置前 head，且先生成 bundle 备份", async () => {
    const { repo, c2, c3, backupRoot, undoOps } = setupRepo()
    git(repo, ["reset", "--hard", c2])

    await undoOps.undo(repo, entry({ op: "reset", headBefore: c3 }))
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c3)
    expect(backupCount(join(backupRoot, "reset-backups", "repo"))).toBe(1)
  })

  it("撤销重置：工作区有未提交改动时拒绝（硬回退会永久丢弃）", async () => {
    const { repo, c2, c3, backupRoot, undoOps } = setupRepo()
    // mixed 重置把 c3 的改动留在工作区；此时硬回退会把这些从未提交的内容清掉
    git(repo, ["reset", "--mixed", c2])

    await expect(undoOps.undo(repo, entry({ op: "reset", headBefore: c3 })))
      .rejects.toThrow(/未提交改动/)
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c2)
    expect(git(repo, ["status", "--porcelain"]).trim()).not.toBe("")
    expect(backupCount(join(backupRoot, "reset-backups", "repo"))).toBe(0)
  })

  it("撤销重置：重置之后又提交过则拒绝（避免连带丢弃新提交）", async () => {
    const { repo, c2, c3, undoOps } = setupRepo()
    git(repo, ["reset", "--hard", c2])
    writeFileSync(join(repo, "c.txt"), "new\n")
    git(repo, ["add", "c.txt"])
    git(repo, ["commit", "-qm", "after reset"])

    await expect(undoOps.undo(repo, entry({ op: "reset", headBefore: c3 })))
      .rejects.toThrow(/又发生了变化/)
    expect(git(repo, ["rev-parse", "HEAD"])).not.toBe(c3)
  })

  it("没有日志记录时拒绝撤销", async () => {
    const { repo, undoOps } = setupRepo()
    await expect(undoOps.undo(repo, null)).rejects.toThrow(/没有可撤销的操作记录/)
  })
})
