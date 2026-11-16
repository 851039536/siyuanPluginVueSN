// src/features/gitPush/managers/GitExecutor.quotepath.git.spec.ts — 路径不转义（P2-4）
//
// 背景：`core.quotepath`（默认 true）会让 git 把**非 ASCII 路径**输出成八进制转义：
//   `"tmp/\344\270\255\346\226\207.txt"`
// 后果不止「看起来乱码」：`status --porcelain` 的路径与实际文件名对不上，
// 于是「点击暂存某个中文文件」「丢弃改动」这类按路径匹配的操作会静默失效。
//
// 原先每个调用点自己写 `["-c", "core.quotepath=false"]`，34 处散落在 5 个文件里 ——
// 任何一处漏写就埋一个只在中文文件名下复现的 bug。现在收敛到 GitExecutor.execGit。
//
// 本文件用真实 git 锁住三件事：
//   ① 默认注入生效：status / ls-files 输出裸 UTF-8；
//   ② 调用方仍可覆盖（`-c core.quotepath=true` 在后，git 取最后一个）；
//   ③ 路径能被解析器原样还原（不是「看起来对」而是可回写）。
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

/** 纯中文路径 —— quotepath 是它唯一的「可能被转义」原因 */
const CN_FILE = "中文.txt"
/** 中文 + 空格：**空格本身**就会触发 git 的引号包裹（与 quotepath 无关），用于区分两种规则 */
const CN_SPACE_FILE = "中文 文件.txt"

describe("GitExecutor 统一注入 core.quotepath=false（真实 git）", () => {
  let repo = ""
  let executor: GitExecutor

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gp-quotepath-"))
    git(repo, ["init", "-q", "-b", "main", "."])
    git(repo, ["config", "user.email", "t@test"])
    git(repo, ["config", "user.name", "t"])
    writeFileSync(join(repo, CN_FILE), "1\n")
    writeFileSync(join(repo, CN_SPACE_FILE), "1\n")
    git(repo, ["add", "-A"])
    git(repo, ["commit", "-qm", "c1"])
    // 改成「已修改」，让 status 必须输出这些路径
    writeFileSync(join(repo, CN_FILE), "2\n")
    writeFileSync(join(repo, CN_SPACE_FILE), "2\n")

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

  it("status --porcelain 输出裸 UTF-8 路径（无八进制转义）", async () => {
    const raw = await executor.execGit(repo, ["status", "--porcelain"])
    // 纯中文名：不转义、也不加引号
    expect(raw).toContain(` M ${CN_FILE}`)
    // 中文 + 空格：**空格**仍会让 git 加引号（这是 porcelain 的引号规则，与 quotepath 无关），
    // 但引号内必须是裸 UTF-8 —— 下面单独断言这点
    expect(raw).toContain(`"${CN_SPACE_FILE}"`)
    expect(raw).not.toContain("\\344") // 中 = UTF-8 E4 B8 AD；出现它说明仍在转义
  }, 60000)

  it("ls-files 输出同样不转义（换行分隔、逐个裸 UTF-8）", async () => {
    const raw = await executor.execGit(repo, ["ls-files"])
    const names = raw.split("\n").map((l) => l.trim()).filter(Boolean)
    expect(names.sort()).toEqual([CN_SPACE_FILE, CN_FILE].sort())
    expect(raw).not.toContain("\\344")
  }, 60000)

  it("调用方仍可覆盖：显式传 core.quotepath=true 时恢复转义（git 取最后一个 -c）", async () => {
    const raw = await executor.execGit(repo, ["-c", "core.quotepath=true", "status", "--porcelain"])
    // 覆盖生效 ⇒ 出现八进制转义（且含引号）
    expect(raw).toContain("\\344")
    expect(raw).toContain("\"")
  }, 60000)

  it("注入不影响命令语义：diff 能按该路径取到补丁", async () => {
    const raw = await executor.execGit(repo, ["diff", "--text", "--", CN_FILE])
    expect(raw).toContain(`a/${CN_FILE}`)
    expect(raw).toContain("+2")
  }, 60000)
})
