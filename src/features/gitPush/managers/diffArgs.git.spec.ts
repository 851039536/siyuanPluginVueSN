// diffArgs.git.spec.ts — 真实 git：用户配置不能破坏补丁解析
//
// 覆盖：color.ui=always（ANSI）、diff.noprefix / mnemonicPrefix（路径前缀）、
// diff.external（外部 diff 驱动）、二进制文件、缓冲区溢出的错误分类。
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitBufferOverflowError } from "../utils/errors"
import { buildWorktreeDiffArgs } from "../utils/gitDiffArgs"
import { parseChangesetDiff } from "../utils/gitOutput"
import { GitExecutor } from "./GitExecutor"
import { WorktreeOps } from "./WorktreeOps"

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  }).trim()
}

describe("diff 安全参数（真实 git + 污染配置）", () => {
  let repo = ""
  let cfgDir = ""
  let executor: GitExecutor
  let ops: WorktreeOps
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL
  const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gp-diffargs-"))
    cfgDir = mkdtempSync(join(tmpdir(), "gp-diffcfg-"))
    const globalConfig = join(cfgDir, "gitconfig")
    writeFileSync(globalConfig, [
      "[color]",
      "\tui = always",
      "[diff]",
      "\tnoprefix = true",
      "\tmnemonicPrefix = true",
      "\texternal = git-diff-should-not-run",
      "",
    ].join("\n"))
    process.env.GIT_CONFIG_GLOBAL = globalConfig
    process.env.GIT_CONFIG_NOSYSTEM = "1"

    git(repo, ["init", "-q", "-b", "main", "."])
    git(repo, ["config", "user.email", "t@test"])
    git(repo, ["config", "user.name", "t"])
    writeFileSync(join(repo, "a.txt"), "1\n")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "c1"])
    writeFileSync(join(repo, "a.txt"), "2\n")

    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      localTimeout: { loadOrDefault: async () => 60 },
      gitConcurrency: { loadOrDefault: async () => 4 },
    } as never
    executor = new GitExecutor(fakeStorage)
    ops = new WorktreeOps(executor)
  }, 120000)

  afterAll(() => {
    process.env.GIT_CONFIG_GLOBAL = savedGlobal
    process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem
    try { rmSync(repo, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
    try { rmSync(cfgDir, { recursive: true, force: true }) } catch { /* 同上 */ }
  })

  it("color.ui=always / noprefix / external 均被覆盖，补丁可直接解析", async () => {
    const result = await ops.getFileDiffResult(repo, "a.txt")
    expect(result.status).toBe("ok")
    expect(result.text).not.toMatch(/\u001b\[/) // 无 ANSI
    expect(result.text).toContain("+++ b/a.txt")
    expect([...parseChangesetDiff(result.text).keys()]).toEqual(["a.txt"])
  })

  it("变更集补丁按 b/ 前缀提取路径", async () => {
    const map = await ops.getChangesetDiff(repo)
    expect(map).not.toBeNull()
    expect(Object.keys(map ?? {})).toEqual(["a.txt"])
  })

  it("numstat 概览可用（供失败后按规模加载）", async () => {
    const overview = await ops.getChangesetOverview(repo)
    expect(overview?.["a.txt"]).toEqual({ add: 1, del: 1, binary: false })
  })

  it("未跟踪二进制文件归类为 binary 而不是乱码文本", async () => {
    writeFileSync(join(repo, "bin.dat"), Buffer.from([0, 1, 2, 3, 0]))
    const result = await ops.getFileDiffResult(repo, "bin.dat", false, "untracked")
    expect(result.status).toBe("binary")
  })

  it("缓冲区溢出抛专用错误（供上层映射为 tooLarge）", async () => {
    await expect(executor.execGit(
      repo,
      buildWorktreeDiffArgs({ paths: ["a.txt"] }),
      undefined,
      undefined,
      undefined,
      { maxBuffer: 64 },
    )).rejects.toBeInstanceOf(GitBufferOverflowError)
  }, 60000)

  it("提交内单文件补丁同样带状态", async () => {
    const hash = git(repo, ["rev-parse", "HEAD"])
    const result = await ops.getCommitFilePatchResult(repo, hash, "a.txt")
    expect(result.status).toBe("ok")
    expect(result.text).toContain("+1")
  })
})
