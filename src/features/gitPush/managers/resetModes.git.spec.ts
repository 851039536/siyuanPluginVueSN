// reset 三模式（真实 git）：soft 留暂存、mixed 留工作区、hard 清工作区且先生成备份；
// 合并进行中一律拒绝
import type { GitPushStorage } from "../types/storage"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { BackupOps } from "./BackupOps"
import { GitExecutor } from "./GitExecutor"
import { UndoOps } from "./UndoOps"

const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-reset-"))
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
  const root = mkdtempSync(join(tmpdir(), "gp-reset-"))
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

function backupCount(dir: string): number {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".bundle")).length : 0
}

describe("UndoOps.reset 三模式", () => {
  it("soft：HEAD 回到目标，c3 的改动进入暂存区", async () => {
    const { repo, c2, c3, backupRoot, undoOps } = setupRepo()
    await undoOps.reset(repo, "soft", c2)
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c2)
    expect(git(repo, ["rev-parse", "HEAD@{1}"])).toBe(c3)
    expect(git(repo, ["diff", "--cached", "--name-only"]).split("\n")).toContain("a.txt")
    expect(backupCount(join(backupRoot, "reset-backups", "repo"))).toBe(0)
  })

  it("mixed：HEAD 回到目标，暂存区清空、工作区保留 c3 内容", async () => {
    const { repo, c2, undoOps } = setupRepo()
    await undoOps.reset(repo, "mixed", c2)
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c2)
    expect(git(repo, ["diff", "--cached", "--name-only"])).toBe("")
    expect(git(repo, ["diff", "--name-only"])).toBe("a.txt")
  })

  it("hard：HEAD 与工作区都回到目标，且先落了 bundle 备份", async () => {
    const { repo, c2, backupRoot, undoOps } = setupRepo()
    writeFileSync(join(repo, "a.txt"), "uncommitted\n")
    await undoOps.reset(repo, "hard", c2)
    expect(git(repo, ["rev-parse", "HEAD"])).toBe(c2)
    expect(git(repo, ["status", "--porcelain"])).toBe("")
    expect(git(repo, ["show", "HEAD:a.txt"])).toBe("two")
    expect(backupCount(join(backupRoot, "reset-backups", "repo"))).toBe(1)
  })

  it("合并进行中拒绝 reset（任何模式）", async () => {
    const { repo, c1, undoOps } = setupRepo()
    // 制造冲突合并：feature 从 c1 分叉，main 已在 c3 改过同一文件
    git(repo, ["checkout", "-qb", "feature", c1])
    writeFileSync(join(repo, "a.txt"), "feature\n")
    git(repo, ["commit", "-qam", "f1"])
    git(repo, ["checkout", "-q", "main"])
    expect(() => git(repo, ["merge", "feature"])).toThrow()

    await expect(undoOps.reset(repo, "hard", c1)).rejects.toThrow(/合并进行中/)
    await expect(undoOps.reset(repo, "soft", c1)).rejects.toThrow(/合并进行中/)
  })

  it("目标不是提交时给出明确错误", async () => {
    const { repo, undoOps } = setupRepo()
    await expect(undoOps.reset(repo, "soft", "deadbeef")).rejects.toThrow(/目标提交不存在/)
  })

  it("listReflog 最新在前，带绝对时间选择器", async () => {
    const { repo, undoOps } = setupRepo()
    const entries = await undoOps.listReflog(repo, 10)
    expect(entries.length).toBeGreaterThanOrEqual(3)
    expect(entries[0].subject).toContain("c3")
    expect(entries[0].selector).toMatch(/^HEAD@\{/)
    expect(entries[0].selector).toContain("+0000")
    expect(entries[0].hash).toMatch(/^[0-9a-f]{40}$/)
  })
})
