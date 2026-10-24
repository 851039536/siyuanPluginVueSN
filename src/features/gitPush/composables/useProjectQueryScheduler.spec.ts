// src/features/gitPush/composables/useProjectQueryScheduler.spec.ts
//
// 锁住 code review 发现的一个**会让性能优化归零**的缺陷（勿回退）：
//
//   背景：loadStatus 原本把「调用方显式传入的分支名」和「上次查询缓存的 branch」
//        混为一谈，都透传给 loadWorkingTree。而 WorktreeOps.getWorkingTreeStatus
//        只要收到 opts.branch 就走 v1 路径，**且不回查 HEAD**。
//        于是形成死循环：缓存有值 ⇒ 传 branch ⇒ 走 v1 ⇒ 仍写回同一缓存值
//        ⇒ 下次继续传 ⇒ 永远 v1。v2 单调用合并（每项目省一次 git 进程）
//        只在每个项目**首次**加载时生效一次，之后全部退回旧路径，收益归零。
//        副作用：外部 checkout 后缓存分支名不会失效，静默陈旧。
//
// 修复后的契约：
//   ① 只有**调用方显式** opts.branch 才透传给 loadWorkingTree（走 v1，省得合理）
//   ② 缓存命中的 branch **绝不**透传 —— 必须留空让 v2 刷新分支名
//   ③ loadWorkingTree 是分支名缓存的**唯一写入点**
//
// 用假 manager，不启动任何 git 子进程。
import type { Ref } from "vue"
import type { GitProject } from "../types/storage"
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { ref } from "vue"
import { useProjectQueryScheduler } from "./useProjectQueryScheduler"

function makeProject(): GitProject {
  return {
    id: "P1",
    name: "P1",
    path: "/repo/p1",
    categoryId: "c1",
    addedAt: 0,
  } as GitProject
}

function makeWorkingTree(branch: string) {
  return {
    branch,
    files: [],
    stagedCount: 0,
    unstagedCount: 0,
    untrackedCount: 0,
    hasChanges: false,
  }
}

/**
 * 假 manager：记录 getWorkingTreeStatus 收到的 opts，
 * 并模拟 WorktreeOps 的行为 —— 有 opts.branch 时按该值返回（v1），否则"自己发现"分支（v2）。
 */
function makeManager(v2DiscoveredBranch: string) {
  const getWorkingTreeStatus = vi.fn(async (_path: string, opts?: { branch?: string }) => {
    return makeWorkingTree(opts?.branch ?? v2DiscoveredBranch)
  })
  const manager = {
    getBranch: vi.fn(async () => v2DiscoveredBranch),
    getWorkingTreeStatus,
    checkPushStatus: vi.fn(async (_id: string, opts?: { branch?: string }) => ({
      branch: opts?.branch ?? "",
      remotes: {},
      needsPush: false,
    })),
  }
  return {
    manager,
    getWorkingTreeStatus,
  }
}

/** 手动控制 resolve 时机的 Promise（模拟查询在飞期间 clearProject） */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("useProjectQueryScheduler —— 分支名透传契约", () => {
  let projects: Ref<GitProject[]>

  beforeEach(() => {
    projects = ref<GitProject[]>([makeProject()])
  })

  it("首次加载：不传分支名给 loadWorkingTree（走 v2 单调用）", async () => {
    const {
      manager,
      getWorkingTreeStatus,
    } = makeManager("main")
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    await scheduler.loadStatus("P1", { mode: "refresh" })

    expect(getWorkingTreeStatus).toHaveBeenCalled()
    const opts = getWorkingTreeStatus.mock.calls[0][1]
    // ⚠️ 核心断言：没有分支名 ⇒ WorktreeOps 走 v2 合并路径
    expect(opts?.branch).toBeUndefined()
  })

  it("第二次刷新：缓存已有分支名，仍不得透传（否则永远退回 v1）", async () => {
    const {
      manager,
      getWorkingTreeStatus,
    } = makeManager("main")
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    // 第一次：v2 发现分支名并写入缓存
    await scheduler.loadStatus("P1", { mode: "refresh" })
    expect(scheduler.workingTrees.value.P1?.branch).toBe("main")

    // 重置调用记录，观察第二次
    getWorkingTreeStatus.mockClear()
    await scheduler.loadStatus("P1", { mode: "refresh" })

    const opts = getWorkingTreeStatus.mock.calls[0][1]
    // ⚠️ 回归断言：这是 review 发现的缺陷点 —— 修复前此处会是 "main"
    expect(opts?.branch).toBeUndefined()
  })

  it("调用方显式传入分支名：透传（走 v1，调用方已解析故合理）", async () => {
    const {
      manager,
      getWorkingTreeStatus,
    } = makeManager("main")
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    await scheduler.loadStatus("P1", {
      mode: "refresh",
      branch: "feature/x",
    })

    const opts = getWorkingTreeStatus.mock.calls[0][1]
    expect(opts?.branch).toBe("feature/x")
  })

  it("loadWorkingTree 是分支名缓存的唯一写入点：刷新后缓存等于最新分支名", async () => {
    const { manager } = makeManager("main")
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    await scheduler.loadWorkingTree("P1")

    // 直接查缓存（resolveBranch 命中缓存时不再发 git）
    const cached = await scheduler.resolveBranch("P1")
    expect(cached).toBe("main")
    // getBranch 只在缓存未命中时才被调用；此处缓存已由 v2 结果回填，故应为 0 次
    expect(manager.getBranch).not.toHaveBeenCalled()
  })

  it("v2 未产出分支名（空仓库/detached）时不写缓存，后续仍可重试", async () => {
    const { manager } = makeManager("") // 模拟 v2 取不到分支名
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    await scheduler.loadWorkingTree("P1")
    expect(scheduler.workingTrees.value.P1?.branch).toBe("")

    // 缓存为空 ⇒ 后续 resolveBranch 会真正去问 git（可恢复，不会被空串永久污染）
    manager.getBranch.mockResolvedValueOnce("main")
    const branch = await scheduler.resolveBranch("P1")
    expect(branch).toBe("main")
    expect(manager.getBranch).toHaveBeenCalledTimes(1)
  })
})

describe("useProjectQueryScheduler —— clearProject 代际守卫", () => {
  let projects: Ref<GitProject[]>

  beforeEach(() => {
    projects = ref<GitProject[]>([makeProject()])
  })

  it("查询在飞时 clearProject：迟到的 pushStatus 不得回写，且不记新鲜度", async () => {
    const status = deferred<{ branch: string, remotes: Record<string, never>, needsPush: boolean }>()
    const manager = {
      getBranch: vi.fn(async () => "main"),
      getWorkingTreeStatus: vi.fn(),
      checkPushStatus: vi.fn(() => status.promise),
    }
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    const loading = scheduler.loadPushStatus("P1", { branch: "main" })
    scheduler.clearProject("P1")
    status.resolve({ branch: "main", remotes: {}, needsPush: false })
    await loading

    expect(scheduler.pushStatuses.value.P1).toBeUndefined()
    // 过期查询不得标记为「已加载」，否则 ensure 会永久跳过该项目
    expect(scheduler.has("P1", "pushStatus")).toBe(false)
  })

  it("查询在飞时 clearProject：迟到的 workingTree 与分支名都不得回写", async () => {
    const tree = deferred<ReturnType<typeof makeWorkingTree>>()
    const manager = {
      getBranch: vi.fn(async () => "main"),
      getWorkingTreeStatus: vi.fn(() => tree.promise),
      checkPushStatus: vi.fn(),
    }
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    const loading = scheduler.loadWorkingTree("P1")
    scheduler.clearProject("P1")
    tree.resolve(makeWorkingTree("main"))
    await loading

    expect(scheduler.workingTrees.value.P1).toBeUndefined()
    expect(scheduler.has("P1", "workingTree")).toBe(false)
    // 分支名缓存也不得被过期结果污染：后续解析必须真正问 git
    expect(await scheduler.resolveBranch("P1")).toBe("main")
    expect(manager.getBranch).toHaveBeenCalledTimes(1)
  })
})

describe("useProjectQueryScheduler —— refreshRemote", () => {
  let projects: Ref<GitProject[]>

  beforeEach(() => {
    projects = ref<GitProject[]>([makeProject()])
  })

  function makeRemoteManager() {
    const updated = { ...makeProject(), githubRemote: "github" } as GitProject
    const manager = {
      getBranch: vi.fn(async () => "main"),
      getWorkingTreeStatus: vi.fn(),
      checkPushStatus: vi.fn(async () => ({ branch: "main", remotes: {}, needsPush: false })),
      refreshRemotes: vi.fn(async () => updated),
      fetchAllForProject: vi.fn(async () => ({ fetched: [], errors: [] })),
    }
    return { manager, updated }
  }

  it("刷新后把最新项目快照同步回 projects Ref（卡片远程名不滞后）", async () => {
    const { manager, updated } = makeRemoteManager()
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    await scheduler.refreshRemote("P1")

    // ref 深响应式会把对象包装为 proxy，故比较值而非引用
    expect(projects.value[0]).toEqual(updated)
    expect(projects.value[0].githubRemote).toBe("github")
  })

  it("远程配置未变时不替换 projects 数组（避免后台批量刷新触发全量重渲染）", async () => {
    const manager = {
      getBranch: vi.fn(async () => "main"),
      getWorkingTreeStatus: vi.fn(),
      checkPushStatus: vi.fn(async () => ({ branch: "main", remotes: {}, needsPush: false })),
      refreshRemotes: vi.fn(async () => ({ ...makeProject() })),
      fetchAllForProject: vi.fn(async () => ({ fetched: [], errors: [] })),
    }
    const scheduler = useProjectQueryScheduler(manager as any, projects)
    const before = projects.value[0]

    await scheduler.refreshRemote("P1")

    expect(projects.value[0]).toBe(before)
  })

  it("force=true 时忽略缓存分支，重新解析 HEAD", async () => {
    const { manager } = makeRemoteManager()
    const scheduler = useProjectQueryScheduler(manager as any, projects)
    scheduler.setBranch("P1", "cached-old")

    await scheduler.refreshRemote("P1", { force: true })

    expect(manager.getBranch).toHaveBeenCalledTimes(1)
  })

  it("不传 force 时复用缓存分支（省一次 rev-parse）", async () => {
    const { manager } = makeRemoteManager()
    const scheduler = useProjectQueryScheduler(manager as any, projects)
    scheduler.setBranch("P1", "cached-old")

    await scheduler.refreshRemote("P1")

    expect(manager.getBranch).not.toHaveBeenCalled()
  })

  it("force 刷新可穿透非 force 的在飞刷新（手动不被后台探测吞掉）", async () => {
    const gate = deferred<{ fetched: string[], errors: string[] }>()
    let fetchCalls = 0
    const manager = {
      getBranch: vi.fn(async () => "main"),
      getWorkingTreeStatus: vi.fn(),
      checkPushStatus: vi.fn(async () => ({ branch: "main", remotes: {}, needsPush: false })),
      refreshRemotes: vi.fn(async () => makeProject()),
      fetchAllForProject: vi.fn(() => {
        fetchCalls++
        return fetchCalls === 1 ? gate.promise : Promise.resolve({ fetched: [], errors: [] })
      }),
    }
    const scheduler = useProjectQueryScheduler(manager as any, projects)

    const background = scheduler.refreshRemote("P1")
    const manual = scheduler.refreshRemote("P1", { force: true })
    await manual

    // 未被后台任务复用：重新 fetch 一次，并强制解析分支
    expect(manager.fetchAllForProject).toHaveBeenCalledTimes(2)
    expect(manager.getBranch).toHaveBeenCalledTimes(1)

    gate.resolve({ fetched: [], errors: [] })
    await background
  })
})
