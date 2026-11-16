// src/features/gitPush/managers/tags.git.spec.ts — Tag 读取的两处收缩（P2-8）
//
// 背景：
//   ① `getTags` 原用 `git tag -l` 输出**全部** Tag，再在 JS 里 `.slice(0, limit)`。
//      千级 Tag 的仓库每次详情加载都要传输并解析全量输出；改用
//      `for-each-ref --count=<limit> --sort=-creatordate refs/tags` 让 git 在输出侧截断。
//   ② `getRemoteTags` 原用 `ls-remote --tags`（含 annotated tag 的 `^{}` peel 行）再过滤；
//      加 `--refs` 后 git 直接不输出 peel 行。
//
// 这两处都只改「怎么取」，不改「取到什么」——本文件用真实 git 断言语义完全等价。
import { execFileSync } from "node:child_process"
import {
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
import { GitExecutor } from "./GitExecutor"
import { RepoOps } from "./RepoOps"

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim()
}

/** 带额外环境变量执行 git（用于给 annotated tag 指定 tagger 日期，让排序确定） */
function gitEnv(cwd: string, args: string[], env: NodeJS.ProcessEnv): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, ...env },
  }).trim()
}

describe("Tag 读取（真实 git）", () => {
  let root = ""
  let repo = ""
  let bare = ""
  let ops: RepoOps
  /** 三个提交的完整 hash，按提交顺序 */
  let hashes: string[] = []

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "gp-tags-"))
    repo = join(root, "repo")
    bare = join(root, "remote.git")
    git(root, ["init", "-q", "-b", "main", repo])
    git(repo, ["config", "user.email", "t@test"])
    git(repo, ["config", "user.name", "t"])

    for (let i = 1; i <= 3; i++) {
      writeFileSync(join(repo, `f${i}.txt`), `${i}`)
      git(repo, ["add", "-A"])
      // 作者与提交者日期都固定成递增日期：`creatordate` 对轻量 tag 取的是**提交日期**
      // （不是 tag 创建时间），只设 --date 会留下 committer=now，排序立刻变成「轻量 tag 排最前」
      const date = `2024-01-0${i}T00:00:00`
      gitEnv(repo, ["commit", "-qm", `c${i}`], {
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      })
    }
    hashes = git(repo, ["log", "--format=%H", "--reverse"]).split("\n")

    // 轻量 tag 指向 c1（creatordate = 提交日期 2024-01-01）；annotated tag 用 tagger 日期，
    // 逐一给不同的值 —— 否则同一秒创建会形成排序并列，断言顺序就变成 flaky
    git(repo, ["tag", "v1", hashes[0]])
    gitEnv(repo, ["tag", "-a", "v2", "-m", "second", hashes[1]], { GIT_COMMITTER_DATE: "2024-02-02T00:00:00" })
    gitEnv(repo, ["tag", "-a", "v3", "-m", "third", hashes[2]], { GIT_COMMITTER_DATE: "2024-03-03T00:00:00" })

    git(root, ["init", "-q", "--bare", "-b", "main", bare])
    git(repo, ["remote", "add", "origin", bare])
    git(repo, ["push", "-q", "origin", "--tags"])

    const fakeStorage = {
      networkTimeout: { loadOrDefault: async () => 240 },
      localTimeout: { loadOrDefault: async () => 60 },
      gitConcurrency: { loadOrDefault: async () => 4 },
    } as never
    ops = new RepoOps(new GitExecutor(fakeStorage))
  }, 120000)

  afterAll(() => {
    try { rmSync(root, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言 */ }
  })

  it("按创建时间倒序返回，limit 在输出侧生效", async () => {
    const two = await ops.getTags(repo, 2)
    expect(two.map((t) => t.name)).toEqual(["v3", "v2"])

    const one = await ops.getTags(repo, 1)
    expect(one.map((t) => t.name)).toEqual(["v3"])
  })

  it("limit 足够大时返回全部；limit<=0 不截断", async () => {
    expect((await ops.getTags(repo, 10)).map((t) => t.name)).toEqual(["v3", "v2", "v1"])
    expect((await ops.getTags(repo, 0)).map((t) => t.name)).toEqual(["v3", "v2", "v1"])
  })

  it("hash 与提交对应：annotated 取解引用后的 commit，lightweight 取自身", async () => {
    const all = await ops.getTags(repo, 10)
    const byName = new Map(all.map((t) => [t.name, t.hash]))
    // annotated tag 的 %(*objectname) 是它指向的 commit
    expect(byName.get("v3")).toBe(hashes[2])
    expect(byName.get("v2")).toBe(hashes[1])
    // lightweight tag 没有解引用对象，回落到 %(objectname)（即 commit 本身）
    expect(byName.get("v1")).toBe(hashes[0])
  })

  it("远程 Tag 名不含 ^{} peel 行，也不重复", async () => {
    const names = await ops.getRemoteTags(repo, "origin")
    expect(names.sort()).toEqual(["v1", "v2", "v3"])
    expect(names.some((n) => n.includes("^{}"))).toBe(false)
  })
})
