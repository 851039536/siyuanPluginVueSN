// src/features/gitPush/managers/GitExecutor.optionalLocks.git.spec.ts — 只读命令禁 optional locks（P1-2）
//
// 背景：`git status` 会「顺手」刷新 index 并把结果**回写** `.git/index`。
// 这件事在本模块里代价特别大：
//   ① 回写改掉 `.git/index` 的 mtime → 触发 GitDirWatcher → 标脏 → 又一轮 status（自激循环）；
//   ② 与 commit / stash / discard / push 争抢 `index.lock`（网络盘 / 杀软环境下更容易放大）。
// Git 官方文档对后台脚本的建议正是 `git --no-optional-locks status`
// （等价环境变量 `GIT_OPTIONAL_LOCKS=0`），GitExecutor.buildEnv 已默认注入。
//
// 本测试用**真实 git** 锁住两个方向（缺一不可）：
//   ① 注入生效：连续 status 后 `.git/index` 的 mtime 不变；
//   ② 开关可分辨：关掉注入后，同一场景下 index **会**被回写 —— 否则①根本证明不了什么。
//
// ⚠️ 触发条件必须是「内容不变、只改 mtime」（模拟编辑器保存相同内容 / 外部工具重写文件）。
//    若直接改内容，git 只把该文件标为 modified、不需要更新 index 条目，两边都不会回写。
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"

/** 真实执行 git（测试编排用，不经过被测的 GitExecutor 并发池） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

/** index 的纳秒级 mtime（毫秒精度在 Windows 上够用但不够稳，直接取 bigint） */
function indexMtimeNs(path: string): bigint {
  return statSync(path, { bigint: true }).mtimeNs
}

/**
 * 内容完全不变、只让 mtime 变新 —— 这是 `git status` 唯一会顺手回写 index 的典型场景
 * （「stat 不同但内容相同」⇒ 它要更新 index 里缓存的 stat 信息）。
 */
function touchSameContent(file: string): void {
  const data = readFileSync(file)
  writeFileSync(file, data)
}

describe("只读命令禁用 optional locks（真实 git）", () => {
  let repo = ""
  let indexFile = ""
  let file = ""
  let executor: GitExecutor

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gp-optlocks-"))
    git(repo, ["init", "-q", "-b", "main", "."])
    git(repo, ["config", "user.email", "opt@test"])
    git(repo, ["config", "user.name", "opt"])
    file = join(repo, "a.txt")
    writeFileSync(file, "content\n")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "c1"])
    indexFile = join(repo, ".git", "index")

    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      localTimeout: { loadOrDefault: async () => 60 },
      gitConcurrency: { loadOrDefault: async () => 4 },
    } as never
    executor = new GitExecutor(fakeStorage)
  }, 120000)

  afterAll(() => {
    try { rmSync(repo, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("默认注入：连续 5 次 status 后 index mtime 不变，且状态判定正确", async () => {
    expect(executor.isOptionalLocksDisabled()).toBe(true)
    touchSameContent(file)
    const before = indexMtimeNs(indexFile)

    for (let i = 0; i < 5; i++) {
      const out = await executor.execGit(repo, ["status", "--porcelain"])
      // 内容没变 ⇒ 工作区仍应判定为干净（禁用 optional locks 只跳过「回写索引」，
      // 不影响它读文件并比较内容）
      expect(out).toBe("")
    }

    expect(indexMtimeNs(indexFile)).toBe(before)

    // 顺带锁住只读诊断：按子命令计数的探针必须真的记到 status（审查里所有「减了多少进程」
    // 都靠它做前后对照，计数漏了就会让人以为优化没生效）
    const stats = executor.getGitStats()
    expect(stats.byCommand.status?.calls).toBeGreaterThanOrEqual(5)
    expect(stats.total).toBeGreaterThanOrEqual(5)
  }, 120000)

  it("关掉注入后同一场景 index 会被回写（证明开关真的生效）", async () => {
    executor.setOptionalLocksDisabled(false)
    touchSameContent(file)
    const before = indexMtimeNs(indexFile)

    const out = await executor.execGit(repo, ["status", "--porcelain"])
    expect(out).toBe("")
    // 若某天这条断言开始失败：说明该版 git 不再因 stat 变化回写 index，
    // 上一条用例就失去了区分力，需要重新设计验收方式（而不是简单删掉本用例）
    expect(indexMtimeNs(indexFile)).not.toBe(before)

    // 复原，避免影响后续用例（本文件内后续用例按「默认注入」预期）
    executor.setOptionalLocksDisabled(true)
  }, 120000)

  it("调用方显式给 GIT_OPTIONAL_LOCKS 时以调用方为准", async () => {
    // 走 options.env 覆盖：显式 "1" 应使 git 恢复默认行为（会回写 index）
    touchSameContent(file)
    const before = indexMtimeNs(indexFile)
    await executor.execGit(repo, ["status", "--porcelain"], undefined, undefined, undefined, {
      env: { GIT_OPTIONAL_LOCKS: "1" },
    })
    expect(indexMtimeNs(indexFile)).not.toBe(before)
  }, 120000)
})
