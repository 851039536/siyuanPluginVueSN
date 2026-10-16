// GitDirWatcher 集成单测：对**真实 git 仓库**断言 .git 文件监听确实能感知各类 git 操作。
//
// 为什么必须是真实 git + 真实 fs.watch（而非 mock）：
//   本模块的全部价值都建立在「git 操作会改写 .git 下文件、而 fs.watch 能收到事件」这一前提上。
//   该前提是**平台相关**的（Windows 的 fs.watch 语义与 inotify 不同，且对目录/文件的
//   监听能力有差异），mock 掉 fs 只能验证「我调用了 watch」，无法证明「事件真的会来」。
//   故此处用真仓库跑真操作，直接断言回调被触发。
//
// 覆盖重点：
//   ① commit 改 index + refs → 必须触发
//   ② commit 能合并成**一次**通知（防抖生效，否则一次提交会引发 3~5 轮重载）
//   ③ 切分支改 HEAD → 必须触发
//   ④ 纯工作区改动（未 add/commit）→ **不**触发（这是有意的边界，由轮询层覆盖）
//   ⑤ destroy 后不再触发（防止卸载后回调打到已销毁的宿主）
import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest"
import { GitDirWatcher } from "./GitDirWatcher"

/** 屏蔽开发者真实 git 配置的隔离环境（与本目录其它 *.git.spec.ts 同策略） */
const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-watch-"))
  const globalCfg = join(dir, "gitconfig")
  const systemCfg = join(dir, "gitsystemconfig")
  writeFileSync(globalCfg, "")
  writeFileSync(systemCfg, "")
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalCfg,
    GIT_CONFIG_SYSTEM: systemCfg,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "T",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "T",
    GIT_COMMITTER_EMAIL: "t@example.com",
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

/** 创建含一次提交的临时仓库，返回其路径与 gitdir */
function makeRepo(): { path: string, gitDir: string } {
  const path = mkdtempSync(join(tmpdir(), "gp-watch-repo-"))
  git(path, ["init", "-q", "-b", "main"])
  writeFileSync(join(path, "a.txt"), "1\n")
  git(path, ["add", "-A"])
  git(path, ["commit", "-q", "-m", "init"])
  const gitDir = git(path, ["rev-parse", "--absolute-git-dir"]).trim()
  return { path, gitDir }
}

/** 等待条件成立（轮询断言，避免依赖固定 sleep 时长导致的偶发失败） */
async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (cond()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return cond()
}

describe("GitDirWatcher（真实 fs.watch + 真实 git）", () => {
  const repos: string[] = []
  const watchers: GitDirWatcher[] = []

  afterEach(() => {
    for (const w of watchers) w.destroy()
    watchers.length = 0
    for (const r of repos) {
      try { rmSync(r, { recursive: true, force: true }) } catch { /* 清理失败不掩盖断言结果 */ }
    }
    repos.length = 0
  })

  /** 建仓库 + 建监听，返回事件收集器 */
  function setup(projectId = "p1", debounceMs = 150) {
    const repo = makeRepo()
    repos.push(repo.path)
    const events: string[] = []
    const watcher = new GitDirWatcher(debounceMs, (id) => events.push(id))
    watchers.push(watcher)
    const ok = watcher.watch(projectId, repo.gitDir)
    return { repo, events, watcher, ok }
  }

  it("能在真实仓库上建立监听（.git 下确实存在可监听目标）", () => {
    const { ok, watcher } = setup()
    expect(ok).toBe(true)
    expect(watcher.watchedCount).toBe(1)
  })

  it("commit 会被感知（改 index + refs）", async () => {
    const { repo, events } = setup()
    writeFileSync(join(repo.path, "b.txt"), "2\n")
    git(repo.path, ["add", "-A"])
    git(repo.path, ["commit", "-q", "-m", "second"])

    const fired = await waitFor(() => events.length > 0)
    expect(fired).toBe(true)
    expect(events[0]).toBe("p1")
  })

  it("一次 commit 合并为单次通知（防抖生效，不产生 3~5 轮重载）", async () => {
    const { repo, events } = setup("p2", 400)
    writeFileSync(join(repo.path, "c.txt"), "3\n")
    git(repo.path, ["add", "-A"])
    git(repo.path, ["commit", "-q", "-m", "third"])

    await waitFor(() => events.length > 0)
    // 等过防抖窗口，确认没有后续补发
    await new Promise((r) => setTimeout(r, 700))
    expect(events.length).toBe(1)
  })

  it("切分支会被感知（改 HEAD）", async () => {
    const { repo, events } = setup("p3")
    git(repo.path, ["checkout", "-q", "-b", "feature"])

    const fired = await waitFor(() => events.length > 0)
    expect(fired).toBe(true)
  })

  it("纯工作区改动不触发（有意边界：该场景由轮询层覆盖）", async () => {
    const { repo, events } = setup("p4", 150)
    // 只改文件，不 add / 不 commit —— 不写 .git 下任何文件
    writeFileSync(join(repo.path, "d.txt"), "4\n")

    await new Promise((r) => setTimeout(r, 800))
    expect(events.length).toBe(0)
  })

  it("destroy 后不再触发（防止卸载后回调打到已销毁宿主）", async () => {
    const { repo, events, watcher } = setup("p5", 100)
    watcher.destroy()
    writeFileSync(join(repo.path, "e.txt"), "5\n")
    git(repo.path, ["add", "-A"])
    git(repo.path, ["commit", "-q", "-m", "after-destroy"])

    await new Promise((r) => setTimeout(r, 700))
    expect(events.length).toBe(0)
    expect(watcher.watchedCount).toBe(0)
  })

  it("unwatch 单个项目后该项目不再触发", async () => {
    const { repo, events, watcher } = setup("p6", 100)
    watcher.unwatch("p6")
    expect(watcher.isWatching("p6")).toBe(false)

    writeFileSync(join(repo.path, "f.txt"), "6\n")
    git(repo.path, ["add", "-A"])
    git(repo.path, ["commit", "-q", "-m", "after-unwatch"])

    await new Promise((r) => setTimeout(r, 600))
    expect(events.length).toBe(0)
  })

  it("gitdir 不存在时返回 false（调用方据此降级到轮询层）", () => {
    const watcher = new GitDirWatcher(100, () => {})
    watchers.push(watcher)
    expect(watcher.watch("bad", join(tmpdir(), "definitely-not-a-gitdir-xyz"))).toBe(false)
    expect(watcher.watchedCount).toBe(0)
  })
})
