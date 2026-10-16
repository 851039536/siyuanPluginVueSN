// 第 2/3 层探测：工作区轮询（含 index mtime 预筛与指数退避）+ 网络慢轮询
//
// ⚠️ 本模块**不自己发 git 命令**，只决定「何时」调用既有入口（scheduler.loadStatus / refreshRemote）。
//    去重、单飞、新鲜度一律由 `useProjectQueryScheduler` 承担——避免出现第三条派发路径
//    （useProjectQueryScheduler.ts 顶部注释明确警告过该反模式）。
//
// 三层成本结构（实测：git 进程启动固定 ~210ms，命令本身仅 ~30ms，故「调用次数」是唯一杠杆）：
//   第 1 层 GitDirWatcher  —— fs.watch，0 次 spawn，捕获 commit/fetch/切分支/merge/stash
//   第 2 层 本模块 poll    —— stat 预筛（0 spawn）→ 未变则跳过；变了才跑一次 git status
//   第 3 层 本模块 network —— fetch，绝不进短定时器，默认关闭
import type { TimerHandle } from "@/utils/timerRegistry"
import type { Ref } from "vue"
import type { GitProject, ProbeConfig, ProjectQueryScheduler } from "../types"
import { getNodeModules } from "@/utils/nodeModules"
import { TimerRegistry } from "@/utils/timerRegistry"
import { GitDirWatcher } from "../managers/GitDirWatcher"
import { nextProbeInterval } from "../types/probeConfig"
import { resolveValidPath } from "../utils"

/** 单项目轮询运行态 */
interface PollEntry {
  /** 当前退避间隔（ms），探测到变化时回到基准 */
  interval: number
  /** 上次观察到的 .git/index mtimeMs（stat 预筛基准；undefined = 尚无基准） */
  lastIndexMtime?: number
  /** 上次观察到的 HEAD oid（预筛第二判据，覆盖不动 index 的场景） */
  lastHead?: string
}

/** 探测依赖 */
export interface GitProbeDeps {
  /** 仅取所需能力，避免整包依赖 manager */
  manager: {
    getGitDir: (projectPath: string) => Promise<string>
    getHeadHash: (projectPath: string) => Promise<string>
  }
  projects: Ref<GitProject[]>
  scheduler: ProjectQueryScheduler
  /** 读取当前探测配置（每次调度实时读取，设置改动无需重建实例） */
  getConfig: () => ProbeConfig
  /** git 全局暂停中（暂停期间不探测） */
  isPaused: () => boolean
  /** 视图是否在前台（不在前台不轮询；窗口失焦由 focus/blur 单独处理） */
  isActive: () => boolean
  /** 每轮探测结果回调（供 UI 展示「刚刚检测过」状态） */
  onProbeResult?: (changed: boolean, at: number) => void
  /** 受控周期：可由调用方注入以便单测；默认 window.setTimeout */
  schedule?: (fn: () => void, ms: number) => TimerHandle
}

/** 监听重建间隔：git gc / 项目增删可能使 watcher 失效，周期重建（5 分钟） */
const REBUILD_INTERVAL_MS = 5 * 60 * 1000

export function useGitProbe(deps: GitProbeDeps) {
  const {
    manager,
    projects,
    scheduler,
    getConfig,
    isPaused,
    isActive,
    onProbeResult,
  } = deps

  /** 定时器统一托管（随 destroy 清理，遵循统一入口原则） */
  const timers = new TimerRegistry()
  /** 第 1 层：.git 文件监听（0 spawn） */
  let watcher: GitDirWatcher | null = null
  /** 第 2 层：各项目轮询状态 */
  const pollEntries = new Map<string, PollEntry>()
  /** 第 1/2/3 层各自的待发定时器句柄（null = 无待发） */
  let pollTimer: TimerHandle | null = null
  let networkTimer: TimerHandle | null = null
  /** 窗口最近一次失焦时间戳（0 = 当前聚焦），用于「离开较久后重聚焦补 fetch」 */
  let blurredAt = 0
  /** 已销毁标记（异步链路在销毁后不再写状态/排定时器） */
  let destroyed = false

  // ── 第 1 层：文件监听（0 次 git 进程）──

  /**
   * 为全部项目建立/刷新 .git 监听。
   *
   * 每项目需一次 `rev-parse --absolute-git-dir`（~250ms），故**只在建立与周期性重建时执行**，
   * 不进轮询热路径。已在监听的项目跳过，避免重复付这份进程费。
   */
  async function ensureWatch(): Promise<void> {
    const cfg = getConfig()
    if (!cfg.watch.enabled) {
      watcher?.destroy()
      watcher = null
      return
    }
    if (!watcher) {
      watcher = new GitDirWatcher(cfg.watch.debounceMs, handleWatchChange)
    } else {
      watcher.setDebounceMs(cfg.watch.debounceMs)
    }
    const active = watcher
    for (const project of projects.value) {
      if (destroyed || !active) return
      if (active.isWatching(project.id)) continue
      const gitDir = await manager.getGitDir(resolveValidPath(project))
      // await 期间可能已销毁或配置被关掉，双重检查后再落下监听
      if (!gitDir || destroyed || watcher !== active) continue
      if (!active.watch(project.id, gitDir)) {
        // 环境不支持（无 Node / 路径不可用）→ 静默降级到第 2 层轮询。
        // 轮询层仍覆盖全部变化，只是延迟更高，无需打扰用户
        continue
      }
      // 建立监听的同时记住当前 HEAD，作为 stat 预筛的第二判据
      const entry = ensurePollEntry(project.id)
      try {
        const head = await manager.getHeadHash(resolveValidPath(project))
        if (head && !destroyed) entry.lastHead = head
      } catch {
        // 基准缺失只是让首轮多跑一次 status，可忽略
      }
    }
  }

  /**
   * 文件监听命中：只标脏、不直接查询。
   *
   * 标脏后由既有 `consumeDirty` 链路驱动卡片按域重载，无需新增派发路径。
   * 六个域全标：一次 git 操作（尤其 fetch / commit）可能同时影响日志、分支、stash。
   * 同时重置退避——用户刚动过仓库，接下来大概率还会动。
   */
  function handleWatchChange(projectId: string): void {
    if (destroyed || isPaused()) return
    scheduler.invalidate(projectId, "pushStatus", "workingTree", "log", "branches", "stash")
    const entry = pollEntries.get(projectId)
    if (entry) entry.interval = getConfig().poll.intervalMs
    onProbeResult?.(true, Date.now())
  }

  // ── 第 2 层：工作区轮询（stat 预筛 + 指数退避）──

  function ensurePollEntry(projectId: string): PollEntry {
    let entry = pollEntries.get(projectId)
    if (!entry) {
      entry = { interval: getConfig().poll.intervalMs }
      pollEntries.set(projectId, entry)
    }
    return entry
  }

  /**
   * stat 预筛：用一次 `fs.stat`（微秒级、**零子进程**）判断值不值得跑 git。
   *
   * 这是本方案减少 spawn 的核心手段——工作区干净且无 git 操作时 `.git/index` 的 mtime 不变，
   * 直接跳过本轮 `git status`，省下 ~250ms 进程费。空闲时轮询成本 ≈ 一次 stat。
   *
   * ⚠️ 判据含两项：index mtime（暂存/提交/checkout）+ HEAD oid（reset --soft、detached 切换
   *    等不动 index 的场景）。任一变化即需查询。
   * ⚠️ 预筛是**保守**设计：宁可多查，不可漏报。任何不确定路径（.git 非目录、index 不存在、
   *    stat 抛错、无 HEAD 基准）一律返回 true 交给 git 定夺，正确性不依赖预筛。
   */
  async function needStatusQuery(project: GitProject, entry: PollEntry): Promise<boolean> {
    const cfg = getConfig()
    if (!cfg.poll.statPrefilter) return true
    const node = getNodeModules()
    if (!node) return true
    const { fs, path } = node
    const projectPath = resolveValidPath(project)

    // ① index mtime 判据
    try {
      // 用 --absolute-git-dir 的结果更准，但为省一次 spawn 此处按常规布局拼 .git；
      // 非常规布局（worktree/分离 gitdir）下 .git 可能是文件，statSync 的 index 路径会失败 → 下方 catch 回退「总是查询」
      const indexStat = fs.statSync(path.join(projectPath, ".git", "index"))
      const mtime = indexStat.mtimeMs
      const firstRun = entry.lastIndexMtime === undefined
      const indexChanged = !firstRun && mtime !== entry.lastIndexMtime
      entry.lastIndexMtime = mtime
      if (firstRun || indexChanged) return true
    } catch {
      return true
    }

    // ② HEAD oid 判据（index 未变时才需要；无基准则先建立基准）
    if (entry.lastHead === undefined) return true
    try {
      const head = await manager.getHeadHash(resolveValidPath(project))
      if (!head) return true
      if (head !== entry.lastHead) {
        entry.lastHead = head
        return true
      }
    } catch {
      return true
    }
    return false
  }

  /** 单项目一轮轮询；返回「本轮是否探测到变化」（供退避判定） */
  async function pollOnce(project: GitProject): Promise<boolean> {
    const entry = ensurePollEntry(project.id)
    let changed = false
    try {
      if (await needStatusQuery(project, entry)) {
        const before = scheduler.workingTrees.value[project.id]
        await scheduler.loadStatus(project.id, { mode: "refresh" })
        const after = scheduler.workingTrees.value[project.id]
        // 变化判定：任一计数或清单长度不同即视为「有变化」。
        // 只比较对用户可见的维度，避免把无关字段抖动当成变化而破坏退避
        changed = !before
          || before.files.length !== after?.files.length
          || before.hasChanges !== after?.hasChanges
          || before.stagedCount !== after?.stagedCount
          || before.unstagedCount !== after?.unstagedCount
          || before.untrackedCount !== after?.untrackedCount
        if (changed) {
          // 工作区变了 → 提交历史/分支也可能变（用户在终端提交过），标脏让卡片按需重载
          scheduler.invalidate(project.id, "log", "branches", "stash")
        }
      }
    } catch {
      // 探测失败静默：下一轮重试。探测是后台增强，失败不得打扰用户
    }
    const cfg = getConfig()
    entry.interval = nextProbeInterval(entry.interval, changed, cfg.poll.intervalMs, cfg.poll.maxIntervalMs)
    return changed
  }

  /** 一轮全量轮询（暂停 / 非前台时跳过，但保持调度链不断） */
  async function pollRound(): Promise<void> {
    if (destroyed) return
    pollTimer = null
    if (isPaused() || !isActive()) {
      schedulePollRound()
      return
    }
    let anyChanged = false
    for (const project of projects.value) {
      if (destroyed) return
      if (await pollOnce(project)) anyChanged = true
    }
    onProbeResult?.(anyChanged, Date.now())
    schedulePollRound()
  }

  /**
   * 排下一轮。间隔取「全部项目当前退避间隔的最小值」——
   * 各项目独立退避，但只要有一个项目还处于基准间隔（近期动过），整体就按更快的节奏跑；
   * 全部空闲时自然收敛到上限。
   */
  function schedulePollRound(): void {
    if (destroyed) return
    const cfg = getConfig()
    if (!cfg.poll.enabled) return
    if (pollTimer !== null) return
    const intervals = [...pollEntries.values()].map((e) => e.interval)
    const delay = intervals.length > 0 ? Math.min(...intervals) : cfg.poll.intervalMs
    pollTimer = timers.setTimeout(() => { pollTimer = null; void pollRound() }, delay)
  }

  // ── 第 3 层：网络轮询（唯一能发现「需拉取」的层）──

  /**
   * 网络轮询一轮：调既有 `refreshRemote`（内含「刷新远程配置 → fetch → 状态重查」单飞管线）。
   *
   * ⚠️ 默认关闭：fetch 是网络往返，不能像本地查询那样高频跑。
   *    开启后也由 clampProbeConfig 强制 ≥ 5 分钟。
   * ⚠️ 串行而非并发：避免同时对 N 个远程发起 fetch 造成网络拥塞；
   *    且 fetch 走的是 GitExecutor 独立网络池，不会挤占本地查询通道。
   */
  async function networkRound(): Promise<void> {
    if (destroyed) return
    networkTimer = null
    const cfg = getConfig()
    if (!cfg.network.enabled || isPaused() || !isActive()) {
      scheduleNetworkRound()
      return
    }
    for (const project of projects.value) {
      if (destroyed) return
      try {
        await scheduler.refreshRemote(project.id)
      } catch {
        // 网络失败静默降级：下轮重试（错误呈现由用户主动刷新路径负责）
      }
    }
    if (!destroyed) onProbeResult?.(true, Date.now())
    scheduleNetworkRound()
  }

  function scheduleNetworkRound(): void {
    if (destroyed) return
    const cfg = getConfig()
    if (!cfg.network.enabled) return
    if (networkTimer !== null) return
    networkTimer = timers.setTimeout(() => { networkTimer = null; void networkRound() }, cfg.network.intervalMs)
  }

  /**
   * 窗口重新聚焦：立即补一轮本地状态；离开较久则再补一次 fetch。
   * 这是「需拉取」的主要发现时机——用户离开一段时间回来，最可能想知道远程有没有新提交。
   */
  function handleFocus(): void {
    if (destroyed || isPaused()) return
    const cfg = getConfig()
    const away = blurredAt > 0 ? Date.now() - blurredAt : 0
    blurredAt = 0
    void pollRound()
    if (!cfg.network.enabled || cfg.network.fetchOnRefocusAfterMs <= 0) return
    if (away >= cfg.network.fetchOnRefocusAfterMs) void networkRound()
  }

  function handleBlur(): void {
    blurredAt = Date.now()
  }

  // ── 生命周期 ──

  /** 启动探测（配置全关时为空操作） */
  function start(): void {
    if (destroyed) return
    const cfg = getConfig()
    // 建监听需逐项目 rev-parse，故仅在监听开启时付这份成本
    if (cfg.watch.enabled) void ensureWatch()
    if (cfg.poll.enabled) {
      for (const p of projects.value) ensurePollEntry(p.id)
      schedulePollRound()
    }
    if (cfg.network.enabled) scheduleNetworkRound()
    window.addEventListener("focus", handleFocus)
    window.addEventListener("blur", handleBlur)
    scheduleRebuild()
  }

  /**
   * 周期性：清理已删项目 + 重建失效监听。
   * git gc 会删掉 packed-refs / refs 下文件使 watcher 静默失效，项目增删也需要补建。
   */
  function scheduleRebuild(): void {
    if (destroyed) return
    timers.setTimeout(() => {
      if (destroyed) return
      // 已删除的项目解除监听并清调度状态（避免句柄与缓存泄漏）
      const alive = new Set(projects.value.map((p) => p.id))
      for (const id of [...pollEntries.keys()]) {
        if (alive.has(id)) continue
        watcher?.unwatch(id)
        pollEntries.delete(id)
        scheduler.clearProject(id)
      }
      void ensureWatch()
      scheduleRebuild()
    }, REBUILD_INTERVAL_MS)
  }

  /** 项目集合变化时重排（新增补监听与轮询状态；删除由下轮 rebuild 清理） */
  function syncProjects(): void {
    if (destroyed) return
    const cfg = getConfig()
    if (cfg.watch.enabled) void ensureWatch()
    if (cfg.poll.enabled) {
      for (const p of projects.value) ensurePollEntry(p.id)
    }
  }

  /** 配置变更后重排（开关/间隔改动立即生效，无需重启面板） */
  function applyConfig(): void {
    if (destroyed) return
    const cfg = getConfig()
    // 基准间隔可能被改小：已退避的项目一律回到新基准
    for (const entry of pollEntries.values()) entry.interval = cfg.poll.intervalMs

    if (pollTimer !== null) { timers.clear(pollTimer); pollTimer = null }
    if (networkTimer !== null) { timers.clear(networkTimer); networkTimer = null }

    if (!cfg.watch.enabled) {
      watcher?.destroy()
      watcher = null
    } else {
      void ensureWatch()
    }
    if (cfg.poll.enabled) schedulePollRound()
    if (cfg.network.enabled) scheduleNetworkRound()
  }

  /**
   * 立即探测一次（用户点「立即检测」/ 面板重新可见时调用）。
   * 清零预筛基准：用户主动要求，不能因「看起来没变化」被跳过。
   */
  async function probeNow(): Promise<void> {
    if (destroyed || isPaused()) return
    const cfg = getConfig()
    for (const entry of pollEntries.values()) {
      entry.interval = cfg.poll.intervalMs
      entry.lastIndexMtime = undefined
      entry.lastHead = undefined
    }
    await pollRound()
  }

  function destroy(): void {
    destroyed = true
    window.removeEventListener("focus", handleFocus)
    window.removeEventListener("blur", handleBlur)
    watcher?.destroy()
    watcher = null
    pollEntries.clear()
    timers.clearAll()
    pollTimer = null
    networkTimer = null
  }

  /** 已建立文件监听的项目数（设置面板/诊断展示） */
  function getWatchedCount(): number {
    return watcher?.watchedCount ?? 0
  }

  return {
    start,
    destroy,
    probeNow,
    syncProjects,
    applyConfig,
    getWatchedCount,
  }
}
