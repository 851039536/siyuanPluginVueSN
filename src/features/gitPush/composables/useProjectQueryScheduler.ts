// gitPush 项目查询调度器：单飞去重 + 分支名复用 + 新鲜度节流 + 脏标记（查询调度的唯一权威）
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  LoadProjectStatusOptions,
  LoadStatusOptions,
  ProjectQueryKind,
  ProjectQueryScheduler,
  PushStatusInfo,
  RunQueryOptions,
  WorkingTreeInfo,
} from "../types"
import { ref } from "vue"
import {
  findProject,
  resolveValidPath,
} from "../utils"

/** 在飞查询 / 新鲜度时间戳的复合键 */
function queryKey(id: string, kind: ProjectQueryKind): string {
  return `${id}:${kind}`
}

/**
 * 项目查询调度器。
 *
 * 收敛此前分散在 5 处的调度关注点：
 *   - useGitOps        的 loadPushStatus / loadWorkingTree / loadProjectGitStatus / loadStatsData 四份实现
 *   - useRefreshOps    内联的第五份（含 refreshRemotes 与状态重查的竞态处理）
 *   - index.vue        的 loadingProjectIds Set（跨触发器项目级去重）
 *   - useCardData      的 detailsLoaded 布尔（卡片级详情去重，原实现存在并发缺口）
 *   - WorkingTreePanel 的 lastRefreshStartedAt（自动刷新最小间隔）
 *
 * 三档职责互不重叠：
 *   ① 单飞   — 同 (id, kind) 在飞时共享 Promise，失败不缓存（下次可重试）
 *   ② 新鲜度 — 成功后写时间戳，支撑 ensure 模式跳过与 minIntervalMs 节流
 *   ③ 脏标记 — 父层写操作标脏，卡片消费脏集按需重载（取代 push 型 per-域信号）
 */
export function useProjectQueryScheduler(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
): ProjectQueryScheduler {
  /** 推送状态缓存（所有权在此，useGitOps 重导出以保持既有公共面） */
  const pushStatuses = ref<Record<string, PushStatusInfo>>({})
  /** 工作区状态缓存（所有权在此） */
  const workingTrees = ref<Record<string, WorkingTreeInfo>>({})
  /** 响应式脏信号：任何 invalidate 递增（卡片只 watch 此单值） */
  const epoch = ref(0)

  /** 在飞查询：键 `${id}:${kind}` → Promise（同键并发调用共享之） */
  const inflight = new Map<string, Promise<unknown>>()
  /** 各域最后一次成功加载时间戳（ms），支撑 ensure 与节流 */
  const lastLoadedAt = new Map<string, number>()
  /** 分支名缓存：分支名是 pushStatus / workingTree 的共同前置，缓存后每轮至多 1 次 rev-parse */
  const branchCache = new Map<string, string>()
  /** 脏域集合（非响应式；epoch 负责通知，脏集负责「哪些域」） */
  const dirty = new Map<string, Set<ProjectQueryKind>>()

  // ── ① 单飞原语 ──

  async function run<T>(
    id: string,
    kind: ProjectQueryKind,
    load: () => Promise<T>,
    opts?: RunQueryOptions,
  ): Promise<T> {
    const key = queryKey(id, kind)
    if (!opts?.force) {
      const pending = inflight.get(key) as Promise<T> | undefined
      if (pending) return pending
    }
    const task = (async () => {
      const result = await load()
      // 仅成功才刷新时间戳：失败不标记为已加载，保证 ensure 模式下次仍会重试
      lastLoadedAt.set(key, Date.now())
      return result
    })()
    inflight.set(key, task)
    try {
      return await task
    } finally {
      // 失败不缓存：无论成败都清在飞条目，调用方可立即重试
      if (inflight.get(key) === task) inflight.delete(key)
    }
  }

  function has(id: string, kind: ProjectQueryKind): boolean {
    return lastLoadedAt.has(queryKey(id, kind))
  }

  function isFresh(id: string, kind: ProjectQueryKind, withinMs: number): boolean {
    const at = lastLoadedAt.get(queryKey(id, kind))
    return at !== undefined && Date.now() - at < withinMs
  }

  // ── ②+③ 脏标记 ──

  function invalidate(id: string, ...kinds: ProjectQueryKind[]): void {
    if (kinds.length === 0) return
    let set = dirty.get(id)
    if (!set) {
      set = new Set()
      dirty.set(id, set)
    }
    for (const k of kinds) set.add(k)
    // 单值信号：卡片只需比较 epoch，无需 O(卡片数 × 域数) 的 getter 求值
    epoch.value++
  }

  function consumeDirty(id: string): Set<ProjectQueryKind> | undefined {
    const set = dirty.get(id)
    if (!set) return undefined
    dirty.delete(id)
    return set
  }

  // ── 分支名（pushStatus / workingTree 的共同前置） ──

  async function resolveBranch(id: string, opts?: { force?: boolean }): Promise<string> {
    if (!opts?.force) {
      const cached = branchCache.get(id)
      if (cached !== undefined) return cached
    }
    return run(id, "branch", async () => {
      const project = findProject(projects, id)
      if (!project) return ""
      const branch = await manager.getBranch(resolveValidPath(project))
      // 仅缓存非空分支：空串代表 detached HEAD / 空仓库 / 路径失效，
      // 缓存会使项目修复后永远拿不到分支名（原实现每次都重试）
      if (branch) branchCache.set(id, branch)
      return branch
    }, opts)
  }

  function setBranch(id: string, branch: string): void {
    branchCache.set(id, branch)
  }

  // ── 状态查询 ──

  async function loadPushStatus(id: string, opts?: LoadStatusOptions): Promise<void> {
    await run(id, "pushStatus", async () => {
      const branch = opts?.branch ?? (await resolveBranch(id))
      pushStatuses.value[id] = await manager.checkPushStatus(id, { branch })
    }, { force: opts?.force })
  }

  async function loadWorkingTree(id: string, opts?: LoadStatusOptions): Promise<void> {
    await run(id, "workingTree", async () => {
      const project = findProject(projects, id)
      if (!project) return
      // ⚠️ 只有在**调用方显式给了分支名**时才这里解析；否则一律留空交给
      //    WorktreeOps.getWorkingTreeStatus 走 v2 单调用路径（一次 git 同时拿分支+工作区）。
      //
      //    历史写法是 `opts?.branch ?? (await resolveBranch(id))` —— 这会让每次
      //    独立调用 loadWorkingTree（卡片工作区刷新、handleRefresh 等）都先付一次
      //    rev-parse，v2 合并省下的进程又被赔回去。缓存命中时看似免费，但
      //    缓存未命中/被 clearProject 后就是一次白跑的进程。
      const branch = opts?.branch
      workingTrees.value[id] = await manager.getWorkingTreeStatus(resolveValidPath(project), {
        branch,
        fastWhenClean: opts?.fastWhenClean,
      })
      // 回填分支别名缓存：v2 产出的分支名对后续 pushStatus 查询有用
      const settled = workingTrees.value[id]?.branch
      if (settled) setBranch(id, settled)
    }, { force: opts?.force })
  }

  /** ensure 模式是否可跳过（两域都已有成功结果） */
  function statusAlreadyLoaded(id: string): boolean {
    return has(id, "pushStatus") && has(id, "workingTree")
  }

  async function loadStatus(id: string, opts?: LoadProjectStatusOptions): Promise<void> {
    const mode = opts?.mode ?? "refresh"
    if (mode === "ensure" && statusAlreadyLoaded(id)) return
    // 节流：refresh 时距上次成功过近则跳过（自动刷新与面板内操作的去重）
    if (mode === "refresh" && opts?.minIntervalMs && isFresh(id, "workingTree", opts.minIntervalMs)) return

    const project = findProject(projects, id)
    if (!project) return

    // ── 分支名来源（决定能否省掉一次 git 进程）──
    // 目标：让 loadWorkingTree 走 WorktreeOps 的 v2 单调用路径（一次 git 同时返回
    // 分支名与工作区），因此这里**尽量不预先 resolveBranch**（那会多付一次进程）。
    //
    // 优先级：
    //  ① 调用方显式传入（refreshRemote / handleRefreshWorkingTree 已解析过，白得）
    //  ② 工作区缓存里的 branch（上一次查询的产物，零成本）
    //  ③ 两者都没有 ⇒ **留空**交给 loadWorkingTree 用 v2 自己取，取回后再回填别名缓存
    //
    // ⚠️ 为什么不再无条件 `await resolveBranch(id)`：那样每个首次加载的项目都会
    //    先付一次 rev-parse（本机实测 0.6~1.3s），v2 合并的意义就没了。
    //    代价是 pushStatus 需要等 branch 确定后才能发起 —— 见下方 Promise.all 编排。
    const knownBranch = opts?.branch || workingTrees.value[id]?.branch || ""

    const needPushStatus = !(mode === "ensure" && has(id, "pushStatus"))
    const needWorkingTree = !(mode === "ensure" && has(id, "workingTree"))

    // 工作区查询：不传 branch ⇒ 走 v2 单调用；传 branch ⇒ 走 v1（省不下进程，但调用方已知）
    const workingTreeTask = needWorkingTree
      ? loadWorkingTree(id, { branch: knownBranch || undefined, fastWhenClean: opts?.fastWhenClean })
      : Promise.resolve()

    /**
     * pushStatus 需要一个分支名才能算 ahead/behind。
     *
     * 取法按「是否已经有分支名」分两种，**关键是绝不与 v2 重复解析**：
     *   · 已有（入参/缓存）⇒ 立即并行发起，与工作区查询重叠
     *   · 没有 ⇒ 等工作区查询的 v2 结果把 branch 写进 workingTrees，再从这里取。
     *     此时**不能**再调 resolveBranch —— 那会额外发一次 rev-parse，
     *     与 v2 的 status 构成「2 次进程」，把 P0 省下的那一次又赔回去。
     *     只有在 v2 也没拿到分支（查询失败/空仓库）时，才回退 resolveBranch 兜底。
     */
    const pushStatusTask = (async () => {
      if (!needPushStatus) return

      let branch = knownBranch
      if (!branch) {
        // 等 v2 结果落地（workingTreeTask 已完成 or 未发起），再从缓存读
        await workingTreeTask
        branch = workingTrees.value[id]?.branch || ""
      }
      if (!branch) {
        // v2 未产出分支名（空仓库 / detached / 查询失败）：兜底走一次解析。
        // 此路径下 v2 本就未多付进程（它已失败或确实无分支），故不算重复。
        branch = await resolveBranch(id)
      }
      if (!branch) return
      await loadPushStatus(id, { branch })
    })()

    await Promise.all([workingTreeTask, pushStatusTask])

    // 回填分支别名缓存：任何一次查询拿到的分支名都对后续调用有用，
    // 可省掉下次的 resolveBranch。仅在非空时写（空串代表 detached/空仓/路径失效，
    // 缓存会让项目修复后永远拿不到分支名）。
    const settled = workingTrees.value[id]?.branch
    if (settled && !opts?.branch) setBranch(id, settled)
  }

  /**
   * 统一远程刷新管线。合并此前两条会各自 fetch 的入口
   * （handleFetchAll 直调 fetchAllForProject 与 handleRefreshRemoteStatus 经 checkPushStatus 内部 fetch）：
   * 单飞后同一项目同时触发两个入口只产生一轮网络 fetch。
   * 本管线是全局唯一的「fetch 后重查状态」路径，checkPushStatus 不再承担 fetch 职责。
   */
  async function refreshRemote(id: string, opts?: { force?: boolean }): Promise<void> {
    await run(id, "remoteRefresh", async () => {
      const project = findProject(projects, id)
      if (!project) return
      // 先刷新远程配置（本地 git remote -v），避免后续用陈旧远程名 fetch
      await manager.refreshRemotes(id)
      // 强制重解析分支名（fetch 后缓存分支名可能已变）
      const branch = await resolveBranch(id, { force: true })
      // 把刚解析出的分支名写回缓存：紧随其后的 loadWorkingTree（如 handleRefresh 的
      // 「全部刷新」会先 refreshRemote 再刷工作区）可直接复用，省掉一次 rev-parse。
      // resolveBranch 内部已对非空分支写缓存，此处显式再写一次是防御性冗余（幂等）。
      if (branch) setBranch(id, branch)
      // 一次网络 fetch 更新跟踪分支
      await manager.fetchAllForProject(id)
      // 状态重查必须 force：若加入别处在飞的状态查询，会拿到 fetch 之前的旧 ahead/behind
      await loadPushStatus(id, {
        branch,
        force: true,
      })
    }, opts)
  }

  // ── 缓存清理 ──

  function clearProject(id: string): void {
    delete pushStatuses.value[id]
    delete workingTrees.value[id]
    branchCache.delete(id)
    dirty.delete(id)
    const prefix = `${id}:`
    for (const key of [...inflight.keys()]) {
      if (key.startsWith(prefix)) inflight.delete(key)
    }
    for (const key of [...lastLoadedAt.keys()]) {
      if (key.startsWith(prefix)) lastLoadedAt.delete(key)
    }
  }

  return {
    epoch,
    pushStatuses,
    workingTrees,
    run,
    has,
    isFresh,
    invalidate,
    consumeDirty,
    resolveBranch,
    setBranch,
    loadPushStatus,
    loadWorkingTree,
    loadStatus,
    refreshRemote,
    clearProject,
  }
}
