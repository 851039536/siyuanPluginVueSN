// `ReportOps.getRepoLifecycle` 单测 —— 锁定「空仓库 vs 真实故障」的错误语义。
//
// 为什么必须测：早期实现用 `.catch(() => "")` 把两者都压成空快照，
// 下游据此返回「0 行 0 文件」并计为**成功**，于是：
//   - 一次瞬时 git 故障被静默展示成「这个项目没有代码」
//   - 用户既看不到失败提示，也无从排查
// 修复后的契约：
//   - 空仓库（无任何提交）→ 返回空 head 的**正常**结果
//   - 其他任何故障（非仓库、超时、lock、git 不可用）→ **抛出**，由调用方计入失败
// 用真实 git 仓库测试（不 mock）：关键正是 git 的真实 stderr 文案能否被正确分类。
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"
import { ReportOps } from "./ReportOps"

/** git 是否可用（无 git 环境时整体跳过，避免污染 CI） */
function hasGit(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/** 最小存储桩：GitExecutor 只需要 loadGitConcurrency/networkTimeout 等读取能力 */
function createExecutor(): GitExecutor {
  const storage = {
    gitConcurrency: { loadOrDefault: async () => 4 },
    networkTimeout: { loadOrDefault: async () => 240 },
  }
  return new GitExecutor(storage as never)
}

describe.skipIf(!hasGit())("ReportOps.getRepoLifecycle", () => {
  let dir: string
  let ops: ReportOps

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gpush-lifecycle-"))
    ops = new ReportOps(createExecutor())
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  /** 初始化一个 git 仓库（可选提交） */
  function initRepo(path: string, commit: boolean): void {
    execFileSync("git", ["init", "-q", path])
    execFileSync("git", ["-C", path, "config", "user.email", "t@t.t"])
    execFileSync("git", ["-C", path, "config", "user.name", "t"])
    if (!commit) return
    writeFileSync(join(path, "a.ts"), "1\n2\n3\n", "utf8")
    execFileSync("git", ["-C", path, "add", "-A"])
    execFileSync("git", ["-C", path, "commit", "-qm", "init"])
  }

  it("正常仓库：返回 HEAD oid、末次提交时间与根提交时间", async () => {
    const repo = join(dir, "normal")
    initRepo(repo, true)

    const lc = await ops.getRepoLifecycle(repo)
    const expectedHead = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()

    expect(lc.head).toBe(expectedHead)
    expect(lc.lastDate).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(lc.rootDate).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // 单提交仓库：根提交即 HEAD
    expect(lc.rootDate).toBe(lc.lastDate)
  })

  it("空仓库（无提交）：返回空 head 的正常结果，**不抛错**", async () => {
    const repo = join(dir, "empty")
    initRepo(repo, false)

    const lc = await ops.getRepoLifecycle(repo)
    // 空数据是合法结果，下游据此展示 0 行项目
    expect(lc.head).toBe("")
    expect(lc.lastDate).toBe("")
    expect(lc.rootDate).toBe("")
  })

  it("非仓库目录：**必须抛错**，不能伪装成空仓库", async () => {
    const notRepo = join(dir, "plain")
    mkdirSync(notRepo, { recursive: true })

    await expect(ops.getRepoLifecycle(notRepo)).rejects.toThrow()
  })

  it("路径不存在：**必须抛错**", async () => {
    await expect(ops.getRepoLifecycle(join(dir, "no-such-dir"))).rejects.toThrow()
  })

  it("多提交仓库：rootDate 为最早提交，lastDate 为最新提交", async () => {
    const repo = join(dir, "multi")
    initRepo(repo, true)
    // 显式把两次提交的时间拉开：同一秒内连续提交会让 rootDate === lastDate，
    // 那样就验不出「root 取最早、last 取最新」这一核心语义
    writeFileSync(join(repo, "b.ts"), "x\n", "utf8")
    execFileSync("git", ["-C", repo, "add", "-A"])
    execFileSync("git", ["-C", repo, "commit", "-qm", "second"], {
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2030-06-01T12:00:00+08:00",
        GIT_COMMITTER_DATE: "2030-06-01T12:00:00+08:00",
      },
    })

    const lc = await ops.getRepoLifecycle(repo)
    expect(lc.rootDate).not.toBe(lc.lastDate)
    expect(Date.parse(lc.rootDate)).toBeLessThan(Date.parse(lc.lastDate))
    // lastDate 应取较晚那次提交
    expect(lc.lastDate).toContain("2030-06-01")
  })
})
