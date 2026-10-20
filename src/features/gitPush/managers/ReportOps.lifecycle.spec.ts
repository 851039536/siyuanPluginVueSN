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

  /** 读取仓库当前分支名（默认分支名随 git 版本/全局配置而变，故不写死 "master"） */
  function currentBranch(path: string): string {
    return execFileSync("git", ["-C", path, "branch", "--show-current"], { encoding: "utf8" }).trim()
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

  it("回归：rootDate 不得等于 lastDate（旧实现用 `git log --reverse -1`，恒返回 HEAD 时间）", async () => {
    const repo = join(dir, "regression")
    initRepo(repo, true)
    // 把根提交时间显式拉到很早，与 HEAD 拉开距离
    execFileSync("git", ["-C", repo, "commit", "--amend", "--no-edit", "--date=2019-03-03T08:00:00+08:00"], {
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2019-03-03T08:00:00+08:00",
        GIT_COMMITTER_DATE: "2019-03-03T08:00:00+08:00",
      },
    })
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
    // 核心断言：两个日期必须不同（旧实现恒等 ⇒ 用户看到「新建日期 == 最后修改」）
    expect(lc.rootDate).not.toBe(lc.lastDate)
    expect(lc.rootDate).toContain("2019-03-03")
    expect(lc.lastDate).toContain("2030-06-01")
  })

  it("多根提交仓库：rootDate 取**最早**的那个根（rev-list 不按时间排序）", async () => {
    const repo = join(dir, "multiroot")
    initRepo(repo, true)
    const mainBranch = currentBranch(repo)
    // 造第二个「无父提交」的根：`--orphan` 分支与主分支历史完全无关
    execFileSync("git", ["-C", repo, "checkout", "-q", "--orphan", "side"])
    execFileSync("git", ["-C", repo, "rm", "-q", "-rf", "."])
    writeFileSync(join(repo, "s.ts"), "s\n", "utf8")
    execFileSync("git", ["-C", repo, "add", "-A"])
    execFileSync("git", ["-C", repo, "commit", "-qm", "sideRoot"], {
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2018-01-01T08:00:00+08:00",
        GIT_COMMITTER_DATE: "2018-01-01T08:00:00+08:00",
      },
    })
    execFileSync("git", ["-C", repo, "checkout", "-q", mainBranch])
    execFileSync("git", ["-C", repo, "merge", "-q", "--allow-unrelated-histories", "side", "-m", "merge side"], {
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2030-06-01T12:00:00+08:00",
        GIT_COMMITTER_DATE: "2030-06-01T12:00:00+08:00",
      },
    })

    const lc = await ops.getRepoLifecycle(repo)
    // 两个根提交中取时间最早的（2018-01-01），而非「rev-list 输出里的第一条」
    // （rev-list 按拓扑序输出，可能把较晚的根排在前面）
    expect(lc.rootDate).toContain("2018-01-01")
    expect(lc.rootDate).not.toBe(lc.lastDate)
  })
})
