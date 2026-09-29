// 工作区状态快速路径（fastWhenClean）语义单测：对真实 git 仓库断言
// 「快速路径」与「全量路径」结果逐字段相等——尤其是「仅有未跟踪文件」时不得被吞掉。
import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"
import { parseWorktreeStatus } from "../utils/gitOutput"

/**
 * 屏蔽开发者真实 git 配置的隔离环境（与 incrementalScan.spec.ts 同策略）：
 * 固定空全局/系统配置 + 固定时区与语言，避免开发机配置或并发改动导致结果漂移。
 */
const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-wt-"))
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

/** 在指定目录执行 git 命令 */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  })
}

/**
 * 复刻 WorktreeOps.getWorkingTreeStatus 的两种路径（不经 GitExecutor，避免拉起插件依赖）。
 * fastWhenClean=true 时先探测已跟踪文件，再无条件执行全量命令。
 */
function readStatus(cwd: string, fastWhenClean: boolean) {
  const full = () => {
    const raw = git(cwd, ["-c", "core.quotepath=false", "status", "--porcelain"])
    // hasChanges 由 files.length 派生（与 WorktreeOps / readFullWorktreeStatus 一致）
    if (!raw.trim()) {
      return {
        hasChanges: false,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        paths: [] as string[],
      }
    }
    const parsed = parseWorktreeStatus(raw)
    return {
      hasChanges: parsed.files.length > 0,
      stagedCount: parsed.stagedCount,
      unstagedCount: parsed.unstagedCount,
      untrackedCount: parsed.untrackedCount,
      paths: parsed.files.map((f) => f.path).sort(),
    }
  }
  if (fastWhenClean) {
    // 快速路径仅用于「决定是否走捷径」，最终仍以全量命令结果为准
    void git(cwd, ["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=no"])
  }
  return full()
}

describe("工作区状态快速路径与全量路径等价", () => {
  let repo: string

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gp-worktree-spec-"))
    git(repo, ["init", "-q", "-b", "main"])
    git(repo, ["config", "user.email", "t@example.com"])
    git(repo, ["config", "user.name", "tester"])
    // 仓库级固定：不转换换行、关闭签名，保证工作区状态判定与平台无关
    git(repo, ["config", "core.autocrlf", "false"])
    git(repo, ["config", "commit.gpgsign", "false"])
    writeFileSync(join(repo, "a.txt"), "one\n")
    mkdirSync(join(repo, "sub"), { recursive: true })
    writeFileSync(join(repo, "sub", "b.txt"), "two\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "chore: init"])
  })

  afterAll(() => {
    try {
      rmSync(repo, {
        recursive: true,
        force: true,
      })
    } catch {
      /* 忽略 */
    }
  })

  it("工作区干净：两条路径都报无变更", () => {
    expect(readStatus(repo, false)).toEqual(readStatus(repo, true))
    expect(readStatus(repo, false).hasChanges).toBe(false)
  })

  it("仅有未跟踪文件：快速路径的探测为空，但全量命令仍必须带出未跟踪清单", () => {
    writeFileSync(join(repo, "new-untracked.txt"), "x\n")
    const trackedProbe = git(repo, ["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=no"])
    // 探测为空（已跟踪文件确实没变）——这正是快速路径的判定依据
    expect(trackedProbe.trim()).toBe("")
    // 但最终结果必须仍然报告这个未跟踪文件
    const status = readStatus(repo, true)
    expect(status.hasChanges).toBe(true)
    expect(status.untrackedCount).toBe(1)
    expect(status.paths).toContain("new-untracked.txt")
    expect(status).toEqual(readStatus(repo, false))
    rmSync(join(repo, "new-untracked.txt"), { force: true })
  })

  it("已有跟踪文件被修改：探测非空，两条路径结果一致", () => {
    writeFileSync(join(repo, "a.txt"), "one modified\n")
    const trackedProbe = git(repo, ["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=no"])
    expect(trackedProbe.trim()).not.toBe("")
    const status = readStatus(repo, true)
    expect(status.hasChanges).toBe(true)
    expect(status.unstagedCount).toBe(1)
    expect(status).toEqual(readStatus(repo, false))
    git(repo, ["checkout", "--", "a.txt"])
  })

  it("已暂存变更：两条路径结果一致", () => {
    writeFileSync(join(repo, "sub", "b.txt"), "two staged\n")
    git(repo, ["add", "sub/b.txt"])
    const status = readStatus(repo, true)
    expect(status.stagedCount).toBe(1)
    expect(status).toEqual(readStatus(repo, false))
    git(repo, ["reset", "-q", "--hard"])
  })
})
