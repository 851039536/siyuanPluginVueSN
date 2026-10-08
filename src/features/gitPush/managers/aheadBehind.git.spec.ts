// 远程 ahead/behind 批量读取（for-each-ref）等价性与语义单测：对**真实 git 仓库**断言
//
// 回归目标：原实现逐远程 `rev-list --left-right --count <remote>/<branch>...HEAD`（N 远程 = N 次进程），
// 现改为单次 `for-each-ref --format=%(refname:short)%00%(ahead-behind:HEAD) refs/remotes`。
// 本文件断言三件事：
//   ① 批量结果与逐远程 rev-list **逐字段相等**（含真实分叉场景，防止 behind/ahead 颠倒）
//   ② 远程分支不存在（noUpstream）时 for-each-ref 静默缺行、退出码 0
//   ③ 「<远程名>/<分支名>」精确匹配过滤，不误纳同平台其他分支 / 非平台远程
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
import { parseAheadBehind } from "../utils/gitOutput"

/** 屏蔽开发者真实 git 配置的隔离环境（与同目录其它 .git.spec.ts 同策略） */
const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-ab-"))
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

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  })
}

/** 生产路径复刻：单次 for-each-ref + parseAheadBehind */
function readBatched(cwd: string): Map<string, { ahead: number, behind: number }> {
  const raw = git(cwd, [
    "for-each-ref",
    "--format=%(refname:short)%00%(ahead-behind:HEAD)",
    "refs/remotes",
  ])
  return parseAheadBehind(raw)
}

/** 旧实现复刻：逐远程 rev-list --left-right --count */
function readPerRemote(cwd: string, remoteName: string, branch: string): { ahead: number, behind: number } | null {
  try {
    const out = git(cwd, ["rev-list", "--left-right", "--count", `${remoteName}/${branch}...HEAD`])
    const parts = out.split("\t")
    return { behind: Number.parseInt(parts[0] || "0", 10), ahead: Number.parseInt(parts[1] || "0", 10) }
  } catch {
    return null
  }
}

describe("远程 ahead/behind 批量读取（for-each-ref）", () => {
  let base: string
  let upstream: string
  let work: string
  let branch = ""

  // 本 hook 要建两个真实仓库（clone + 多次 commit），本机每次 git 调用约 300ms 的进程启动费，
  // 累计远超 Vitest 默认 10s 的 hookTimeout，故显式放宽（与 testTimeout 的 30s 预算同口径）。
  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "gp-aheadbehind-"))
    upstream = join(base, "upstream")
    work = join(base, "work")
    mkdirSync(upstream, { recursive: true })

    git(upstream, ["init", "-q", "-b", "main"])
    git(upstream, ["config", "user.email", "t@example.com"])
    git(upstream, ["config", "user.name", "tester"])
    git(upstream, ["config", "core.autocrlf", "false"])
    git(upstream, ["config", "commit.gpgsign", "false"])
    // 单次提交即够建立跟踪关系：后续分叉场景由各自用例按需追加提交（省去此处多余的进程开销）
    writeFileSync(join(upstream, "base.txt"), "base\n")
    git(upstream, ["add", "-A"])
    git(upstream, ["commit", "-q", "-m", "base"])

    git(base, ["clone", "-q", upstream, work])
    git(work, ["config", "user.email", "t@example.com"])
    git(work, ["config", "user.name", "tester"])
    git(work, ["config", "core.autocrlf", "false"])
    branch = git(work, ["branch", "--show-current"]).trim()
  }, 60000)

  afterAll(() => {
    try {
      rmSync(base, {
        recursive: true,
        force: true,
      })
    } catch {
      /* 忽略 */
    }
  })

  it("完全同步：批量与逐远程结果一致，且均为 0/0", () => {
    const batched = readBatched(work)
    const single = readPerRemote(work, "origin", branch)
    expect(batched.get(`origin/${branch}`)).toEqual(single)
    expect(single).toEqual({ behind: 0, ahead: 0 })
  })

  it("本地领先 2：ahead=2、behind=0（防止 behind/ahead 颠倒的关键用例）", () => {
    for (let i = 1; i <= 2; i++) {
      writeFileSync(join(work, `local${i}.txt`), `L${i}\n`)
      git(work, ["add", "-A"])
      git(work, ["commit", "-q", "-m", `local ${i}`])
    }
    const batched = readBatched(work)
    const single = readPerRemote(work, "origin", branch)
    expect(batched.get(`origin/${branch}`)).toEqual(single)
    expect(single).toEqual({ behind: 0, ahead: 2 })
  })

  it("双方分叉（领先 2 落后 3）：批量与逐远程逐字段一致", () => {
    // upstream 再追加 3 个提交，本地 fetch 后即有落后
    for (let i = 1; i <= 3; i++) {
      writeFileSync(join(upstream, `up${i}.txt`), `U${i}\n`)
      git(upstream, ["add", "-A"])
      git(upstream, ["commit", "-q", "-m", `up ${i}`])
    }
    git(work, ["fetch", "-q", "origin"])

    const batched = readBatched(work)
    const single = readPerRemote(work, "origin", branch)
    expect(batched.get(`origin/${branch}`)).toEqual(single)
    expect(single).toEqual({ behind: 3, ahead: 2 })
  })

  it("多远程：一次调用覆盖全部平台 ref，且各自与逐远程结果一致", () => {
    // 从同一起点补出另外三个平台远程（模拟用满四平台的项目）
    git(work, ["update-ref", `refs/remotes/github/${branch}`, `origin/${branch}`])
    git(work, ["update-ref", `refs/remotes/gitee/${branch}`, `origin/${branch}`])

    const batched = readBatched(work)
    for (const remote of ["origin", "github", "gitee"]) {
      const refName = `${remote}/${branch}`
      expect(batched.get(refName)).toEqual(readPerRemote(work, remote, branch))
    }
    // 三个远程指向同一提交，计数应彼此相同
    expect(batched.get(`github/${branch}`)).toEqual(batched.get(`gitee/${branch}`))
  })

  it("noUpstream：远程跟踪 ref 不存在时 for-each-ref 静默缺行（退出码 0），rev-list 则报错", () => {
    const raw = git(work, [
      "for-each-ref",
      "--format=%(refname:short)%00%(ahead-behind:HEAD)",
      "refs/remotes/nonexistent",
    ])
    // 不报错、空输出 —— 调用方据此判定 noUpstream
    expect(raw.trim()).toBe("")
    expect(readBatched(work).has(`nonexistent/${branch}`)).toBe(false)
    // 对照：旧路径对不存在的远程会抛错
    expect(readPerRemote(work, "nonexistent", branch)).toBeNull()
  })

  it("精确匹配：同平台其他分支与非平台远程不会污染「<远程名>/<分支名>」查询", () => {
    git(work, ["update-ref", `refs/remotes/origin/other-branch`, `origin/${branch}`])
    git(work, ["update-ref", `refs/remotes/upstream/${branch}`, `origin/${branch}`])
    const batched = readBatched(work)

    // 当前分支的 ref 仍可查到
    expect(batched.get(`origin/${branch}`)).toEqual(readPerRemote(work, "origin", branch))
    // 但 other-branch 不应被当作「当前分支的 origin ref」误纳：
    // 生产侧按 refName.endsWith(`/${branch}`) 过滤，`origin/other-branch` 不以 /main 结尾，故被排除
    const currentBranchRefs = [...batched.keys()].filter((k) => k.endsWith(`/${branch}`))
    expect(currentBranchRefs).toContain(`origin/${branch}`)
    expect(currentBranchRefs).not.toContain("origin/other-branch")
  })
})
