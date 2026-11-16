// src/features/gitPush/composables/useConsistencyAudit.spec.ts — 一致性分析的进程预算（P1-3）
//
// 锁住三件事（任何一条回退都会让「分析 20 个项目」重新变成几百次 git 进程）：
//   ① 远程名取项目记录，不再逐项目 `git remote -v`；
//   ② 本地分支 + 远程跟踪 ref 由**一次** `getRefSnapshot` 取齐（原先是 getBranches + getRemoteTrackingRefs 两次）；
//   ③ 本地分支 sha 与远程跟踪 ref sha 相同 ⇒ 直接判定 synced，**不调用** countAheadBehind。
//
// 用假 manager（不启动任何 git 子进程），断言的是「调用了什么、调了几次」，不是 git 行为本身
// —— git 侧行为由 WorktreeOps 的真实仓库用例守护。
import type { GitProject } from "../types/storage"
import type { RefSyncSnapshot } from "../types/gitRefs"
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { useConsistencyAudit } from "./useConsistencyAudit"

function makeProject(overrides: Partial<GitProject> = {}): GitProject {
  return {
    id: "P1",
    name: "P1",
    path: "/repo/p1",
    categoryId: "c1",
    addedAt: 0,
    githubRemote: "origin",
    giteeRemote: "upstream",
    ...overrides,
  } as GitProject
}

/** 构造引用快照：branches 为 [名字, sha, 是否当前]，remoteRefs 为 [remote, branch, sha] */
function snapshot(
  branches: Array<[string, string, boolean?]>,
  remoteRefs: Array<[string, string, string]>,
): RefSyncSnapshot {
  return {
    branches: branches.map(([name, sha, current]) => ({
      name,
      sha,
      current: current ?? false,
    })),
    remoteRefs: remoteRefs.map(([remote, branch, sha]) => ({
      remote,
      branch,
      sha,
    })),
  }
}

function makeManager(opts: {
  snapshots?: Record<string, RefSyncSnapshot>
  aheadBehind?: (remoteRef: string, localBranch: string) => { ahead: number, behind: number }
  detectedRemotes?: string[]
}) {
  const getProjects = vi.fn(async () => [makeProject()])
  const detectRemotes = vi.fn(async () => (opts.detectedRemotes ?? ["origin"]).map((name) => ({
    name,
    url: `https://example.com/${name}.git`,
    isGithub: name === "origin",
    isGitee: false,
    isCnb: false,
    isGitea: false,
  })))
  const getRefSnapshot = vi.fn(async (path: string) => {
    const fromMap = opts.snapshots?.[path]
    if (fromMap) return fromMap
    return {
      branches: [],
      remoteRefs: [],
    }
  })
  const countAheadBehind = vi.fn(async (_path: string, remoteRef: string, localBranch: string) => {
    return opts.aheadBehind ? opts.aheadBehind(remoteRef, localBranch) : { ahead: 0, behind: 0 }
  })
  const fetchRemoteAt = vi.fn(async () => {})
  const cache = { value: null as unknown }
  const storage = {
    consistencyCache: {
      loadOrDefault: async () => cache.value ?? {
        analyzedAt: "",
        projectLimit: "all" as const,
        rows: [],
      },
      save: async (data: unknown) => {
        cache.value = data
        return true
      },
    },
  }
  const manager = {
    getProjects,
    detectRemotes,
    getRefSnapshot,
    countAheadBehind,
    fetchRemoteAt,
    storage,
  }
  return {
    manager,
    getProjects,
    detectRemotes,
    getRefSnapshot,
    countAheadBehind,
    fetchRemoteAt,
  }
}

describe("useConsistencyAudit —— 进程预算", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("全部同步（sha 相同）：只一次快照，零次 rev-list，零次 remote -v", async () => {
    const { manager, detectRemotes, getRefSnapshot, countAheadBehind, fetchRemoteAt } = makeManager({
      snapshots: {
        "/repo/p1": snapshot(
          [["main", "aaa", true], ["dev", "bbb"], ["feature/x", "ccc"]],
          [
            ["origin", "main", "aaa"],
            ["origin", "dev", "bbb"],
            ["origin", "feature/x", "ccc"],
            ["upstream", "main", "aaa"],
            ["upstream", "dev", "bbb"],
            ["upstream", "feature/x", "ccc"],
          ],
        ),
      },
    })
    const audit = useConsistencyAudit(manager as never)
    audit.fetchFirst.value = false
    await audit.runAudit()

    expect(getRefSnapshot).toHaveBeenCalledTimes(1)
    expect(countAheadBehind).not.toHaveBeenCalled()
    expect(detectRemotes).not.toHaveBeenCalled()
    expect(fetchRemoteAt).not.toHaveBeenCalled()

    const row = audit.displayRows.value[0]
    // issueOnly 默认 true ⇒ 全同步的项目被过滤掉，此处直接看完整行
    expect(row).toBeUndefined()
  })

  it("仅 sha 不同的那一对才跑 rev-list，并给出正确的 ahead/behind 状态", async () => {
    const { manager, countAheadBehind } = makeManager({
      snapshots: {
        "/repo/p1": snapshot(
          [["main", "aaa", true], ["dev", "bbb"]],
          [
            ["origin", "main", "ccc"],
            ["origin", "dev", "bbb"],
            ["upstream", "main", "ccc"],
            ["upstream", "dev", "bbb"],
          ],
        ),
      },
      aheadBehind: (remoteRef) => (remoteRef === "origin/main" ? { ahead: 2, behind: 0 } : { ahead: 1, behind: 3 }),
    })
    const audit = useConsistencyAudit(manager as never)
    audit.fetchFirst.value = false
    await audit.runAudit()

    // main 的两个远程 + dev 的两个远程里，只有 main 的两个远程 sha 不等 ⇒ 2 次
    expect(countAheadBehind).toHaveBeenCalledTimes(2)

    const summary = audit.summary.value
    expect(summary.ahead).toBe(1) // origin/main
    expect(summary.diverged).toBe(1) // upstream/main
    expect(summary.synced).toBe(2) // dev@origin + dev@upstream
  })

  it("本地独有 / 远程独有分支都被正确标注", async () => {
    const { manager } = makeManager({
      snapshots: {
        "/repo/p1": snapshot(
          [["main", "aaa", true], ["only-local", "ddd"]],
          [
            ["origin", "main", "aaa"],
            ["origin", "only-remote", "eee"],
          ],
        ),
      },
    })
    const audit = useConsistencyAudit(manager as never)
    audit.fetchFirst.value = false
    // 关闭「仅显示问题项目」：否则 synced 行会被过滤掉，看不到对比全貌
    audit.issueOnly.value = false
    await audit.runAudit()

    const row = audit.displayRows.value.find((r) => r.id === "P1")
    const states = row?.branches.map((b) => `${b.remote}:${b.branch}:${b.state}`) ?? []
    expect(states).toContain("origin:main:synced")
    expect(states).toContain("origin:only-local:localOnly")
    expect(states).toContain("origin:only-remote:remoteOnly")
  })

  it("项目记录里没有平台远程时才回落 detectRemotes", async () => {
    const { manager, detectRemotes, fetchRemoteAt } = makeManager({
      snapshots: {
        "/repo/p1": snapshot([["main", "aaa", true]], [["origin", "main", "aaa"]]),
      },
      detectedRemotes: ["origin"],
    })
    // 去掉平台远程映射
    const noRemoteProject = makeProject({
      githubRemote: undefined,
      giteeRemote: undefined,
    })
    manager.getProjects = vi.fn(async () => [noRemoteProject])

    const audit = useConsistencyAudit(manager as never)
    audit.fetchFirst.value = false
    await audit.runAudit()

    expect(detectRemotes).toHaveBeenCalledTimes(1)
    expect(fetchRemoteAt).not.toHaveBeenCalled()
  })
})
