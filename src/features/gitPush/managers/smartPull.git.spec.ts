// src/features/gitPush/managers/smartPull.git.spec.ts — 判断拉取端到端回归（真实 git 仓库）
//
// 锁住三条不变量（任何一条被破坏都会导致「覆盖正在写代码的人」这类不可逆事故）：
//   1. 远端只改写提交信息：本机旧副本不算独有提交，应备份分支后对齐远端；
//   2. 本地有真实独有提交：必须中止且 HEAD 保持不变；
//   3. 未跟踪文件只在会被远端新树覆盖时阻塞，其余（.env / 构建产物）必须保留。
//
// ⚠️ 用真实 git 而非 mock：patch-id、reset --hard 覆盖语义、tracked ref 更新
//   都是 git 自身行为，mock 只能验证我们对语义的假设。
import type { GitProject } from "../types/storage"
import type { ProjectStore } from "./ProjectStore"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { ProjectWriteLock } from "./ProjectWriteLock"
import { SmartPullOps } from "./SmartPullOps"

/** 真实执行 git（测试编排用，不经过被测的 GitExecutor 并发池） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

function configure(cwd: string): void {
  git(cwd, ["config", "user.email", "test@test"])
  git(cwd, ["config", "user.name", "test"])
}

function write(cwd: string, name: string, content: string): void {
  writeFileSync(join(cwd, name), content)
}

function commitAll(cwd: string, message: string): void {
  git(cwd, ["add", "-A"])
  git(cwd, ["commit", "-qm", message])
}

describe("判断拉取（真实 git）", () => {
  let root = ""
  let origin = ""
  let local = ""
  let peer = ""
  let ops: SmartPullOps

  const project = (): GitProject => ({
    id: "p1",
    name: "local",
    path: local,
    localPaths: [],
    githubRemote: "",
    giteeRemote: "origin",
    giteaRemote: "",
    cnbRemote: "",
  } as unknown as GitProject)

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "gp-smart-pull-"))
    origin = join(root, "origin.git")
    local = join(root, "local")
    peer = join(root, "peer")

    git(root, ["init", "-q", "--bare", "-b", "main", origin])
    git(root, ["clone", "-q", origin, local])
    configure(local)
    git(local, ["checkout", "-q", "-b", "main"])
    write(local, "a.txt", "1")
    commitAll(local, "c1")
    git(local, ["push", "-q", "-u", "origin", "main"])

    git(root, ["clone", "-q", origin, peer])
    configure(peer)
    git(peer, ["checkout", "-q", "main"])

    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      gitConcurrency: { loadOrDefault: async () => 10 },
    } as never
    const executor = new GitExecutor(fakeStorage)
    const store = { getProjectById: async () => project() } as unknown as ProjectStore
    ops = new SmartPullOps(executor, store, new ProjectWriteLock())
  })

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("远端只改写提交信息：直接对齐远端（旧副本不算独有提交，不建备份分支）", async () => {
    git(peer, ["commit", "-q", "--amend", "-m", "c1 rewritten"])
    git(peer, ["push", "-q", "--force", "origin", "main"])
    const oldHead = git(local, ["rev-parse", "HEAD"])
    const remoteTip = git(origin, ["rev-parse", "main"])

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(true)
    expect(git(local, ["rev-parse", "HEAD"])).toBe(remoteTip)
    expect(git(local, ["rev-parse", "HEAD"])).not.toBe(oldHead)
    expect(r.stdout).toContain("未创建备份分支")
    expect(git(local, ["branch", "--list", "backup/*"])).toBe("")
  })

  it("本地有真实独有提交：中止且 HEAD 与工作区保持不变", async () => {
    write(peer, "remote.txt", "r")
    commitAll(peer, "remote work")
    git(peer, ["push", "-q", "origin", "main"])
    write(local, "local.txt", "l")
    commitAll(local, "local work")
    const oldHead = git(local, ["rev-parse", "HEAD"])

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("独有提交")
    expect(git(local, ["rev-parse", "HEAD"])).toBe(oldHead)
    expect(existsSync(join(local, "local.txt"))).toBe(true)
    expect(git(local, ["branch", "--list", "backup/*"])).toBe("")
  })

  it("本地无独有提交且未跟踪文件不冲突：快进对齐并保留未跟踪文件", async () => {
    git(peer, ["commit", "-q", "--amend", "-m", "c1 rewritten"])
    git(peer, ["push", "-q", "--force", "origin", "main"])
    write(local, ".env", "SECRET=1")
    mkdirSync(join(local, "dist"), { recursive: true })
    write(local, "dist/app.js", "built")

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(true)
    expect(readFileSync(join(local, ".env"), "utf8")).toBe("SECRET=1")
    expect(readFileSync(join(local, "dist/app.js"), "utf8")).toBe("built")
  })

  it("未跟踪文件会被远端新树覆盖：中止且文件原样保留", async () => {
    git(peer, ["commit", "-q", "--amend", "-m", "c1 rewritten"])
    write(peer, "conflict.txt", "remote")
    commitAll(peer, "add conflict")
    git(peer, ["push", "-q", "--force", "origin", "main"])
    write(local, "conflict.txt", "local untracked")
    const oldHead = git(local, ["rev-parse", "HEAD"])

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("未跟踪文件")
    expect(git(local, ["rev-parse", "HEAD"])).toBe(oldHead)
    expect(readFileSync(join(local, "conflict.txt"), "utf8")).toBe("local untracked")
  })

  it("工作区有未提交的已跟踪改动：中止且改动保留", async () => {
    git(peer, ["commit", "-q", "--amend", "-m", "c1 rewritten"])
    git(peer, ["push", "-q", "--force", "origin", "main"])
    write(local, "a.txt", "dirty")

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("未提交改动")
    expect(readFileSync(join(local, "a.txt"), "utf8")).toBe("dirty")
  })

  it("本地严格落后且无独有提交：直接快进（无需备份）", async () => {
    write(peer, "b.txt", "2")
    commitAll(peer, "c2")
    git(peer, ["push", "-q", "origin", "main"])

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(true)
    expect(git(local, ["rev-parse", "HEAD"])).toBe(git(origin, ["rev-parse", "main"]))
  })
})
