// 「HEAD 尚未诞生」的空仓库（unborn HEAD）下，暂存区操作的语义单测。
//
// 为什么单独立一份：`git init` 之后、首个提交之前，`HEAD` 是个悬空引用，
// 一部分命令会以 `fatal: ambiguous argument 'HEAD'` 直接失败（实测 git 2.55：
// 不带路径的 `git reset HEAD` 失败，带 `-- <path>` 的形态与裸 `git reset` 均正常）。
// 这正是「新建项目第一次 add 之后想取消暂存」的必经路径 —— 失败会让用户以为
// 应用坏了，且没有任何 UI 绕路可走（只能手工删 .git/index）。
//
// 只断言 WorktreeOps 对外行为（工作区/索引的可见状态），不锁定具体命令写法，
// 这样未来换成 `git restore --staged` 之类实现时用例仍然成立。
import type { DiscardTarget, GitPushStorage } from "../types/storage"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import { GitExecutor } from "./GitExecutor"
import { WorktreeOps } from "./WorktreeOps"

const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-unborn-"))
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

// GitExecutor 不覆盖子进程环境，故把隔离配置写进本 worker 进程（理由同 discardFiles.git.spec.ts）
process.env.GIT_CONFIG_GLOBAL = ISOLATED_ENV.GIT_CONFIG_GLOBAL
process.env.GIT_CONFIG_SYSTEM = ISOLATED_ENV.GIT_CONFIG_SYSTEM
process.env.GIT_CONFIG_NOSYSTEM = "1"

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  })
}

function createOps(): WorktreeOps {
  return new WorktreeOps(new GitExecutor({} as GitPushStorage))
}

/** 索引里已暂存的路径（`--cached` 只列暂存区，未跟踪文件不会出现） */
function stagedPaths(repo: string): string[] {
  return git(repo, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean).sort()
}

describe("空仓库（unborn HEAD）下的暂存操作", () => {
  let repo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "gp-unborn-spec-"))
    git(repo, ["init", "-q", "-b", "main"])
    git(repo, ["config", "user.email", "t@example.com"])
    git(repo, ["config", "user.name", "tester"])
    git(repo, ["config", "core.autocrlf", "false"])
    git(repo, ["config", "commit.gpgsign", "false"])
    // 刻意不提交：本文件的全部用例都要求 HEAD 悬空
    writeFileSync(join(repo, "a.txt"), "one\n")
    mkdirSync(join(repo, "sub"), { recursive: true })
    writeFileSync(join(repo, "sub", "b.txt"), "two\n")
    // 全量 pnpm test 会并发拉起几十个 worker，每个都 spawn git，放宽建仓超时
  }, 30_000)

  afterEach(() => {
    try {
      rmSync(repo, { recursive: true, force: true })
    } catch {
      /* 忽略 */
    }
  })

  it("unstageAll：全部退回未跟踪，且工作区内容不动", async () => {
    git(repo, ["add", "-A"])
    expect(stagedPaths(repo)).toEqual(["a.txt", "sub/b.txt"])

    await createOps().unstageAll(repo)

    expect(stagedPaths(repo)).toEqual([])
    // 取消暂存 ≠ 丢改动：文件必须原样留在磁盘上
    expect(readFileSync(join(repo, "a.txt"), "utf8")).toBe("one\n")
    expect(readFileSync(join(repo, "sub", "b.txt"), "utf8")).toBe("two\n")
    expect(git(repo, ["status", "--porcelain"]).trim()).toBe("?? a.txt\n?? sub/")
  })

  it("unstageFile：只退指定路径，其余暂存项保留", async () => {
    git(repo, ["add", "-A"])

    await createOps().unstageFile(repo, "a.txt")

    expect(stagedPaths(repo)).toEqual(["sub/b.txt"])
    // porcelain 先列已跟踪变更、再列未跟踪项，故顺序不能按字母排
    expect(git(repo, ["status", "--porcelain"]).trim()).toBe("A  sub/b.txt\n?? a.txt")
  })

  it("discardFile（已暂存的新增）：删除工作区文件并退出索引", async () => {
    git(repo, ["add", "-A"])

    await createOps().discardFile(repo, "a.txt", true, "added")

    expect(existsSync(join(repo, "a.txt"))).toBe(false)
    expect(stagedPaths(repo)).toEqual(["sub/b.txt"])
  })

  it("discardFiles（混合批）：被选中项清空，未选中项原样保留", async () => {
    git(repo, ["add", "-A"])
    writeFileSync(join(repo, "d.txt"), "untracked\n")

    const targets: DiscardTarget[] = [
      { path: "a.txt", status: "added", staged: true },
      { path: "d.txt", status: "untracked", staged: false },
    ]

    await createOps().discardFiles(repo, targets)

    expect(existsSync(join(repo, "a.txt"))).toBe(false)
    expect(existsSync(join(repo, "d.txt"))).toBe(false)
    // 未选中项不受影响
    expect(stagedPaths(repo)).toEqual(["sub/b.txt"])
    expect(readFileSync(join(repo, "sub", "b.txt"), "utf8")).toBe("two\n")
  })
})
