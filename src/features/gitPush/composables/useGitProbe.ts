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
  /** 真实 gitdir 绝对路径缓存（供 stat 预筛定位 index；空串 = 解析失败，预筛不生效） */
  gitDir?: string
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

  /** gitdir 解析结果缓存（避免每轮 stat 预筛都付一次 rev-parse；失败也缓存空串以免反复重试） */
  const gitDirCache = new Map<string, string>()

  /**
   * 解析并缓存项目 gitdir（stat 预筛定位 .git/index 用）。
   * 失败缓存空串：预筛对该项目永久走「总是查询」的保守路径，不会每轮重试打转。
   * `syncProjects` / 周期性 rebuild 时会清缓存，使路径修正后能重新解析。
   */
  async function resolveGitDirCached(projectId: string): Promise<string> {
    const cached = gitDirCache.get(projectId)
    if (cached !== undefined) return cached
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) return ""
    let dir = ""
    try {
      dir = await manager.getGitDir(resolveValidPath(project))
    } catch {
      dir = ""
    }
    if (!destroyed) gitDirCache.set(projectId, dir)
    return dir
  }

  /**
   * stat 预筛：用一次 `fs.stat`（微秒级、**零子进程**）判断值不值得跑 git。
   *
   * 这是本方案减少 spawn 的核心手段——工作区干净且无 git 操作时 `.git/index` 的 mtime 不变，
   * 直接跳过本轮 `git status`，省下 ~250ms 进程费。空闲时轮询成本 ≈ 一次 stat。
   *
   * ⚠️ 判据含两项：index mtime（暂存/提交/checkout）+ HEAD oid（reset --soft、detached 切换
   *    等不动 index 的场景）。任一变化即需查询。
   * ⚠️ 预筛是**保守**设计：宁可多查，不可漏报。任何不确定路径（gitdir 未解析出、index 不存在、
   *    stat 抛错、无 HEAD 基准）一律返回 true 交给 git 定夺，正确性不依赖预筛。
   */
  async function needStatusQuery(project: GitProject, entry: PollEntry): Promise<boolean> {
    const cfg = getConfig()
    if (!cfg.poll.statPrefilter) return true
    const node = getNodeModules()
    if (!node) return true
    const { fs, path } = node

    // ① index mtime 判据。必须用真实 gitdir 而非拼接 `${projectPath}/.git`：
    //    worktree / submodule / 分离式 gitdir 下 `.git` 可能是文件或指向别处，
    //    拼接路径会 stat 失败 → 永久回退「总是查询」→ 该用户的预筛优化静默失效。
    //    gitdir 解析结果缓存进 entry，避免每轮多付一次 rev-parse。
    let gitDir = entry.gitDir
    if (gitDir === undefined) {
      gitDir = await resolveGitDirCached(project.id)
      entry.gitDir = gitDir
    }
    if (!gitDir) return true
    try {
      const indexStat = fs.statSync(path.join(gitDir, "index"))
      const mtime = indexStat.mtimeMs
      const firstRun = entry.lastIndexMtime === undefined
      const indexChanged = !firstRun && mtime !== entry.lastIndexMtime
      entry.lastIndexMtime = mtime
      if (firstRun || indexChanged) {
        // index 变了说明工作区/暂存动过：顺带刷新 HEAD 基准，
        // 否则下一轮会因 lastHead 滞后而多发一次 getHeadHash（rev-parse）进程
        await refreshHeadBaseline(project, entry)
        return true
      }
    } catch {
      return true
    }

    // ② HEAD oid 判据（index 未变时才需要；无基准则先建立基准）
    if (entry.lastHead === undefined) {
      await refreshHeadBaseline(project, entry)
      return true
    }
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

  /** 刷新 HEAD 基准（失败静默：基准缺失只是让后续多查一轮，不影响正确性） */
  async function refreshHeadBaseline(project: GitProject, entry: PollEntry): Promise<void> {
    try {
      const head = await manager.getHeadHash(resolveValidPath(project))
      if (head && !destroyed) entry.lastHead = head
    } catch {
      // 忽略：下轮会重试建立基准
    }
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
        // 变化判定：任一计数 / 清单长度 / 分支名不同即视为「有变化」。
        // 只比较对用户可见的维度，避免把无关字段抖动当成变化而破坏退避。
        // ⚠️ 必须含 branch：`loadStatus` 的 refresh 模式复用缓存分支名而非强制 rev-parse，
        //    故「外部切了分支但 index 未变」（HEAD 被非 checkout 方式改写，或文件监听不可用时）
        //    单凭计数无法察觉，卡片会一直停留在旧分支的数据上。
        changed = !before
          || before.files.length !== after?.files.length
          || before.hasChanges !== after?.hasChanges
          || before.stagedCount !== after?.stagedCount
          || before.unstagedCount !== after?.unstagedCount
          || before.untrackedCount !== after?.untrackedCount
          || before.branch !== after?.branch
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
    // 定时器已触发，句柄自然失效，只需清记账（此处不经 timers.clear——它已从注册表移除）
    pollTimer = null
    if (isPaused() || !isActive()) {
      schedulePollRound()
      return
    }
    await runPollRoundNow()
  }

  /**
   * 取消待发的轮询定时器。
   *
   * ⚠️ 必须在**直接调用 `pollRound()` 之前**调用：`pollRound` 自身只是把 `pollTimer` 置 null，
   * 并不取消已注册到 TimerRegistry 的真实句柄。若不清句柄就再跑一轮，那个待发定时器稍后仍会
   * 触发并开启**第二条并发的轮询链**——每轮都会对全部项目跑一次 git status（每次约 210ms 进程费），
   * 正是本特性要消除的开销。并发链还会让 `pollTimer` 的记账（以及「取最小间隔」的节奏）失真。
   */
  function cancelPollTimer(): void {
    if (pollTimer !== null) {
      timers.clear(pollTimer)
      pollTimer = null
    }
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
    // 先取消待发定时器再直接跑一轮：否则待发定时器稍后仍会触发，形成第二条并发轮询链
    cancelPollTimer()
    void pollRound()
    if (!cfg.network.enabled || cfg.network.fetchOnRefocusAfterMs <= 0) return
    if (away >= cfg.network.fetchOnRefocusAfterMs) {
      // 网络层同理：取消待发 fetch 再立即补一次，避免同一时刻两轮 fetch
      if (networkTimer !== null) { timers.clear(networkTimer); networkTimer = null }
      void networkRound()
    }
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
        gitDirCache.delete(id)
        scheduler.clearProject(id)
      }
      // 周期性失效 gitdir 缓存：项目路径可能被编辑（换目录），缓存会指向旧 gitdir
      gitDirCache.clear()
      for (const entry of pollEntries.values()) entry.gitDir = undefined
      void ensureWatch()
      scheduleRebuild()
    }, REBUILD_INTERVAL_MS)
  }

  /** 项目集合变化时重排（新增补监听与轮询状态；删除由下轮 rebuild 清理） */
  function syncProjects(): void {
    if (destroyed) return
    // 项目集合变了，gitdir 缓存可能对应已删除/改路径的项目，整体失效重解析
    gitDirCache.clear()
    for (const entry of pollEntries.values()) {
      entry.gitDir = undefined
      entry.lastIndexMtime = undefined
      entry.lastHead = undefined
    }
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
   * 立即探测一次（用户点「立即检测」/ 解除暂停时调用）。
   *
   * 清零预筛基准：用户主动要求，不能因「看起来没变化」被跳过。
   * 同时取消待发定时器，保证这次主动探测与既有调度链**合并为一轮**而非并发两轮。
   *
   * ⚠️ 与 `pollRound` 的可见性门控不同：这是**显式用户动作**，即便此刻
   * `isActive()` 为假（如独立窗口切到后台再点按钮）也应给出反馈而非静默无操作。
   * 故此处不经 `pollRound` 的早退分支，改为无条件执行一轮本地状态查询。
   */
  async function probeNow(): Promise<void> {
    if (destroyed || isPaused()) return
    const cfg = getConfig()
    for (const entry of pollEntries.values()) {
      entry.interval = cfg.poll.intervalMs
      entry.lastIndexMtime = undefined
      entry.lastHead = undefined
      // 路径可能在面板外被改过：一并失效 gitdir 缓存，让本轮重新解析
      entry.gitDir = undefined
    }
    gitDirCache.clear()
    cancelPollTimer()
    await runPollRoundNow()
  }

  /**
   * 无条件跑一轮（不做可见性/暂停门控——调用方负责判定）。
   * `pollRound` 保留门控语义供自动调度使用，此处供显式动作使用。
   */
  async function runPollRoundNow(): Promise<void> {
    let anyChanged = false
    for (const project of projects.value) {
      if (destroyed) return
      if (await pollOnce(project)) anyChanged = true
    }
    onProbeResult?.(anyChanged, Date.now())
    schedulePollRound()
  }

  function destroy(): void {
    destroyed = true
    window.removeEventListener("focus", handleFocus)
    window.removeEventListener("blur", handleBlur)
    watcher?.destroy()
    watcher = null
    pollEntries.clear()
    gitDirCache.clear()
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
