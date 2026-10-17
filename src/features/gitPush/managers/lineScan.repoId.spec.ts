// `resolveRepoIdentity` 单测 —— 修复「项目路径改指向同 commit 的另一份克隆」时命中错误缓存。
//
// 背景 bug：缓存失效判据原先只有 HEAD oid。clone / 模板复制出的两个仓库初始 commit
// 完全相同，把项目路径改指向另一份克隆时 headOid 一致 → 命中缓存 → 返回旧仓库行数。
//
// 本函数是零 git 调用的替代判据（比较 .git 的规范化路径），
// 必须覆盖三种仓库布局：普通目录式 .git、worktree 的文件式 .git、无 .git。
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, normalize, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { resolveRepoIdentity } from "./lineScan"

describe("resolveRepoIdentity", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gpush-repoid-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("普通仓库：身份为 <root>/.git 的规范化路径", () => {
    const repo = join(dir, "repoA")
    mkdirSync(join(repo, ".git"), { recursive: true })
    expect(resolveRepoIdentity(repo)).toBe(`git:${normalize(join(repo, ".git"))}`)
  })

  it("关键回归：两份同 commit 的克隆（不同路径）身份必须不同", () => {
    // 模拟 clone：两个目录各有自己的 .git
    const a = join(dir, "repoA")
    const b = join(dir, "repoB")
    mkdirSync(join(a, ".git"), { recursive: true })
    mkdirSync(join(b, ".git"), { recursive: true })

    const idA = resolveRepoIdentity(a)
    const idB = resolveRepoIdentity(b)
    expect(idA).not.toBe(idB)
    expect(idA).toBeTruthy()
    expect(idB).toBeTruthy()
  })

  it("同一仓库的等价路径写法得到相同身份", () => {
    const repo = join(dir, "repoA")
    mkdirSync(join(repo, ".git"), { recursive: true })
    const id1 = resolveRepoIdentity(repo)
    // 带尾部分隔符 / 相对等价写法
    const id2 = resolveRepoIdentity(`${repo}/`)
    expect(id1).toBe(id2)
  })

  it("worktree：.git 是文件，按 gitdir 指向的真实库路径区分", () => {
    const main = join(dir, "main")
    const wt = join(dir, "wt-feature")
    const wtGitDir = join(main, ".git", "worktrees", "wt-feature")
    mkdirSync(wtGitDir, { recursive: true })
    mkdirSync(wt, { recursive: true })
    // worktree 的 .git 是文件，内容为 `gitdir: <abs path>`
    writeFileSync(join(wt, ".git"), `gitdir: ${wtGitDir}\n`, "utf8")

    expect(resolveRepoIdentity(wt)).toBe(`git:${normalize(wtGitDir)}`)
  })

  it("worktree：gitdir 为相对路径时按工作区根解析", () => {
    const wt = join(dir, "wt")
    mkdirSync(wt, { recursive: true })
    writeFileSync(join(wt, ".git"), "gitdir: ../shared/wt-gitdir\n", "utf8")
    expect(resolveRepoIdentity(wt)).toBe(`git:${normalize(resolve(wt, "../shared/wt-gitdir"))}`)
  })

  it("两个不同 worktree 的身份不同（各自 gitdir 不同）", () => {
    const main = join(dir, "main")
    for (const name of ["wt1", "wt2"]) {
      const wtGitDir = join(main, ".git", "worktrees", name)
      mkdirSync(wtGitDir, { recursive: true })
      const wt = join(dir, name)
      mkdirSync(wt, { recursive: true })
      writeFileSync(join(wt, ".git"), `gitdir: ${wtGitDir}`, "utf8")
    }
    const id1 = resolveRepoIdentity(join(dir, "wt1"))
    const id2 = resolveRepoIdentity(join(dir, "wt2"))
    expect(id1).not.toBe(id2)
  })

  it("无 .git 目录：退化为工作区根身份，不同目录仍可区分", () => {
    const a = join(dir, "plainA")
    const b = join(dir, "plainB")
    mkdirSync(a, { recursive: true })
    mkdirSync(b, { recursive: true })
    expect(resolveRepoIdentity(a)).toBe(`dir:${normalize(a)}`)
    expect(resolveRepoIdentity(a)).not.toBe(resolveRepoIdentity(b))
  })

  it(".git 文件内容损坏时仍给出可用身份（退化为 .git 路径本身）", () => {
    const repo = join(dir, "broken")
    mkdirSync(repo, { recursive: true })
    writeFileSync(join(repo, ".git"), "not a gitdir line", "utf8")
    const id = resolveRepoIdentity(repo)
    expect(id).toBe(`git:${normalize(join(repo, ".git"))}`)
  })

  it("空路径返回空串（调用方据此保守失效，而非误判命中）", () => {
    expect(resolveRepoIdentity("")).toBe("")
  })
})
