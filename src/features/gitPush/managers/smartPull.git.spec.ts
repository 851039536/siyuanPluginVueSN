// src/features/gitPush/managers/smartPull.git.spec.ts — 判断拉取端到端回归（真实 git 仓库）
//
// 锁住三条不变量（任何一条被破坏都会导致「覆盖正在写代码的人」这类不可逆事故）：
//   1. 远端只改写提交信息：本机旧副本不算独有提交，应直接对齐远端（不建备份分支）；
//   2. 本地有真实独有提交：必须中止且 HEAD 保持不变；
//   3. 未跟踪文件只在会被远端新树覆盖时阻塞，其余（.env / 构建产物）必须保留。
//
// ⚠️ 用真实 git 而非 mock：patch-id、reset --hard 覆盖语义、tracked ref 更新
//   都是 git 自身行为，mock 只能验证我们对语义的假设。
import type { GitPushStorage, GitProject } from "../types/storage"
import type { ProjectStore } from "./ProjectStore"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { ProjectWriteLock } from "./ProjectWriteLock"
import { SmartPullOps } from "./SmartPullOps"

const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-smartpull-"))
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

// GitExecutor 不覆盖子进程环境（无账号解析器时直接继承 process.env），
// 故把隔离配置写进本 worker 进程（vitest 默认按文件隔离 worker）。
process.env.GIT_CONFIG_GLOBAL = ISOLATED_ENV.GIT_CONFIG_GLOBAL
process.env.GIT_CONFIG_SYSTEM = ISOLATED_ENV.GIT_CONFIG_SYSTEM
process.env.GIT_CONFIG_NOSYSTEM = "1"

/** 真实执行 git（测试编排用，不经过被测的 GitExecutor 并发池） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  }).trim()
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
  let executor: GitExecutor
  /** 本轮实际发出的 git 命令参数序列（用于锁住进程数：只记参数，不改变行为） */
  let calls: string[][]

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

    executor = new GitExecutor({} as GitPushStorage)
    // 记录命令序列：既不 mock git，也不改变被测行为，只为一件事 ——
    // 断言「分支与工作区一次取齐」没有退回到「先 getCurrentBranch 再 status」的两次进程。
    calls = []
    const rawExec = executor.execGit.bind(executor)
    executor.execGit = ((cwd, args, signal, timeoutMs, onOutput, options) => {
      calls.push(args)
      return rawExec(cwd, args, signal, timeoutMs, onOutput, options)
    }) as GitExecutor["execGit"]
    const store = { getProjectById: async () => project() } as unknown as ProjectStore
    ops = new SmartPullOps(executor, store, new ProjectWriteLock())
  }, 120000)

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

  it("分支与工作区一次取齐：只发一次 status（v2 --branch），不额外解析分支", async () => {
    write(peer, "b.txt", "2")
    commitAll(peer, "c2")
    git(peer, ["push", "-q", "origin", "main"])

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(true)
    // 只允许一次 status，且必须是 v2 + --branch -z（分支名由同一次调用的头部行给出，
    // NUL 定界保证未跟踪清单里的特殊文件名不会错位）
    expect(calls.filter((a) => a[0] === "status")).toEqual([
      ["status", "--porcelain=v2", "--branch", "-z"],
    ])
    // getCurrentBranch 的任何实现路径都不得再出现（rev-parse / branch --show-current / symbolic-ref）
    expect(calls.filter((a) => ["rev-parse", "branch", "symbolic-ref"].includes(a[0]))).toEqual([])
  })

  it("工作区有未提交改动时在 fetch 之前就中止（不发网络请求）", async () => {
    write(peer, "b.txt", "2")
    commitAll(peer, "c2")
    git(peer, ["push", "-q", "origin", "main"])
    write(local, "a.txt", "dirty")

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("未提交改动")
    expect(calls.some((a) => a[0] === "fetch")).toBe(false)
  })

  it("detached HEAD：`(detached)` 归一化为空串，直接中止且不改动仓库", async () => {
    git(local, ["checkout", "-q", "--detach"])
    const oldHead = git(local, ["rev-parse", "HEAD"])

    const r = await ops.smartPullSingle("p1", "gitee")

    expect(r.ok).toBe(false)
    expect(r.stderr).toContain("detached")
    expect(calls.some((a) => a[0] === "fetch" || a[0] === "reset" || a[0] === "merge")).toBe(false)
    expect(git(local, ["rev-parse", "HEAD"])).toBe(oldHead)
  })
})
