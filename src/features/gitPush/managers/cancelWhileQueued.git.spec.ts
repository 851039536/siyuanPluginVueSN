// src/features/gitPush/managers/cancelWhileQueued.git.spec.ts — 「排队期取消」行为回归
//
// 背景：写锁（ProjectWriteLock）是纯 Promise 链、不支持中断。原实现把 withAbortController
// 注册在锁**内**，导致 push 排队等锁（同项目正在 commit/stash）时 cancelOp 找不到控制器：
// 用户点「取消」毫无反应，锁一释放推送照常执行。
//
// 本测试用真实 git + 真实 GitExecutor 锁住修复后的不变量：
//   ① 排队期间取消 → 返回 canceled（不是 fail），且**不得**真正推到远程；
//   ② 取消结果不计入 success，也不该被当成「全部已同步」（allSkipped=false）。
import type { GitProject } from "../types/storage"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { ProjectWriteLock } from "./ProjectWriteLock"
import { RemoteOps } from "./RemoteOps"

/** 真实执行 git（测试编排用，不经过被测的 GitExecutor 并发池） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

describe("排队期取消（真实 git + 真实写锁）", () => {
  let root = ""
  let remote = ""
  let local = ""
  let executor: GitExecutor
  let ops: RemoteOps
  let lock: ProjectWriteLock

  const projectId = "p1"
  // path 用 getter：beforeAll 里才确定临时目录，普通属性会在模块加载时定格为空串
  const project = {
    id: projectId,
    name: "queued-cancel",
    get path() { return local },
    githubRemote: "origin",
  } as unknown as GitProject

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "gp-cancel-"))
    remote = join(root, "remote.git")
    local = join(root, "local")

    // 空裸远程 + 本地提交一个尚未推送的 commit（origin 已配置但远程分支不存在）
    git(root, ["init", "-q", "--bare", "-b", "main", remote])
    git(root, ["clone", "-q", remote, local])
    git(local, ["config", "user.email", "local@test"])
    git(local, ["config", "user.name", "local"])
    git(local, ["checkout", "-q", "-b", "main"])
    writeFileSync(join(local, "f.txt"), "1")
    git(local, ["add", "-A"])
    git(local, ["commit", "-qm", "c1"])

    // 最小替身：executor 只读超时/并发设置；store 只按 id 取项目；storage 仅 loadPushBranchMode 会碰
    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      localTimeout: { loadOrDefault: async () => 60 },
      gitConcurrency: { loadOrDefault: async () => 10 },
      pushBranchMode: { loadOrDefault: async () => "head" as const, save: async () => true },
    } as never
    const fakeStore = {
      getProjectById: async (id: string) => (id === projectId ? project : null),
    } as never

    executor = new GitExecutor(fakeStorage)
    lock = new ProjectWriteLock()
    ops = new RemoteOps(executor, fakeStore, fakeStorage, lock)
  }, 120000)

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("排队等锁期间取消：返回 canceled 且不执行真实推送", async () => {
    // 1) 占住写锁，模拟「同项目正在 commit/stash」
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const occupying = lock.runExclusive(local, async () => { await gate })

    // 2) 发起 push（会先注册 AbortController，再排队等锁）
    const pushing = ops.pushToAll(projectId)
    // 等一拍宏任务：pushToAll 内部先 await store.getProjectById 才注册控制器
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 3) 排队期间取消
    executor.cancelOp(projectId, "push")

    // 4) 释放锁：push 拿到锁后应立即发现已取消并返回，而不是照常执行
    release()
    await occupying

    const result = await pushing
    expect(result.github.canceled).toBe(true)
    expect(result.github.ok).toBe(false)
    expect(result.success).toBe(false)
    // 取消 ≠ 全部已同步：调用方据此不应显示「没有待推送内容」
    expect(result.allSkipped).toBe(false)

    // 5) 关键断言：远程分支必须仍不存在（推送真的没发生）
    expect(git(remote, ["branch", "--list", "main"])).toBe("")
  }, 60000)

  it("未被取消时同一路径能正常推送（防止修复把正常推送一起拦掉）", async () => {
    const result = await ops.pushToAll(projectId)
    expect(result.github.ok).toBe(true)
    expect(result.success).toBe(true)
    expect(git(remote, ["branch", "--list", "main"])).toContain("main")
  }, 60000)
})
