// 工作区状态读取语义单测：对真实 git 仓库断言
// `status --porcelain` 单次调用即可完整覆盖「已跟踪变更 / 未跟踪文件 / 暂存变更」三类语义。
//
// 历史背景：本文件原用于验证 `fastWhenClean` 快速路径（先探测 `--untracked-files=no` 再补跑全量）
// 与全量路径的等价性。该快速路径已移除（实测其为净亏：探测+全量 ≈ 2× 单次全量，
// 且 `-uno` 与全量几乎同价——瓶颈是每次 git 调用的进程启动费 ~310ms，而非文件扫描量）。
// 本文件改为直接断言「单次全量命令」在各场景下的正确性，覆盖原先依赖对比才能暴露的边界
// （尤其「仅有未跟踪文件」这一类，曾是快速路径最容易吞掉结果的地方）。
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
 * 复刻 WorktreeOps.getWorkingTreeStatus 的生产路径（单次 `status --porcelain` + parseWorktreeStatus）。
 * 不经 GitExecutor，避免拉起插件依赖。
 */
function readStatus(cwd: string) {
  const raw = git(cwd, ["-c", "core.quotepath=false", "status", "--porcelain"])
  // hasChanges 由 files.length 派生（与 WorktreeOps.readFullWorktreeStatus 一致）
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

describe("工作区状态单次读取语义", () => {
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

  it("工作区干净：报无变更", () => {
    const status = readStatus(repo)
    expect(status.hasChanges).toBe(false)
    expect(status.stagedCount).toBe(0)
    expect(status.unstagedCount).toBe(0)
    expect(status.untrackedCount).toBe(0)
    expect(status.paths).toEqual([])
  })

  it("仅有未跟踪文件：必须带出未跟踪清单（历史快速路径最易吞掉的一类）", () => {
    writeFileSync(join(repo, "new-untracked.txt"), "x\n")
    const status = readStatus(repo)
    expect(status.hasChanges).toBe(true)
    expect(status.untrackedCount).toBe(1)
    expect(status.stagedCount).toBe(0)
    expect(status.unstagedCount).toBe(0)
    expect(status.paths).toContain("new-untracked.txt")
    rmSync(join(repo, "new-untracked.txt"), { force: true })
  })

  it("已有跟踪文件被修改：计入未暂存", () => {
    writeFileSync(join(repo, "a.txt"), "one modified\n")
    const status = readStatus(repo)
    expect(status.hasChanges).toBe(true)
    expect(status.unstagedCount).toBe(1)
    expect(status.stagedCount).toBe(0)
    expect(status.untrackedCount).toBe(0)
    expect(status.paths).toContain("a.txt")
    git(repo, ["checkout", "--", "a.txt"])
  })

  it("已暂存变更：计入已暂存", () => {
    writeFileSync(join(repo, "sub", "b.txt"), "two staged\n")
    git(repo, ["add", "sub/b.txt"])
    const status = readStatus(repo)
    expect(status.hasChanges).toBe(true)
    expect(status.stagedCount).toBe(1)
    expect(status.unstagedCount).toBe(0)
    expect(status.paths).toContain("sub/b.txt")
    git(repo, ["reset", "-q", "--hard"])
  })

  it("未跟踪 + 已跟踪修改并存：三类计数各自独立归属", () => {
    writeFileSync(join(repo, "a.txt"), "modified again\n")
    writeFileSync(join(repo, "loose.txt"), "loose\n")
    const status = readStatus(repo)
    expect(status.unstagedCount).toBe(1)
    expect(status.untrackedCount).toBe(1)
    expect(status.stagedCount).toBe(0)
    expect(status.paths).toEqual(["a.txt", "loose.txt"])
    git(repo, ["checkout", "--", "a.txt"])
    rmSync(join(repo, "loose.txt"), { force: true })
  })
})
