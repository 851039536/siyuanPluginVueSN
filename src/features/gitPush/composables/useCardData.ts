// gitPush 项目卡片 Tab 数据自包含（log/branches/stash/tags/冲突/diff/md 卡内经 manager 直取，
// 父层操作经调度器脏标记通知重载；同名查询经调度器单飞去重）
//
// 卡片态按「项目 id + 主路径」缓存在模块级 Map 中：切换分类 / 智能视图会让卡片卸载，
// 复用时直接命中缓存（数据、显示条数、在途查询与失败冷却全部保留），避免每次回到原分类
// 都重跑 4~5 次 git。LRU 上限防止已删项目条目常驻。
import type { Ref } from "vue"
import type {
  BranchInfo,
  CommitLogEntry,
  CommitStat,
  ConflictFile,
  GitProject,
  StashEntry,
  TagInfo,
} from "../types"
import type { CardTabId } from "../types/cardTab"
import type { MdFileEntry } from "./useMarkdownFiles"
import {
  inject,
  onMounted,
  ref,
  watch,
} from "vue"
import { CARD_SERVICES_KEY } from "../types"
import {
  DEFAULT_LOG_LIMIT,
  diffCacheKey,
  getProjectRemoteNames,
  pruneRecordCache,
  resolveValidPath,
} from "../utils"
import { scanMarkdownFiles } from "./useMarkdownFiles"

/** Tag→commit 映射拉取上限（防异常大仓库失控） */
const TAG_COMMIT_MAP_LIMIT = 500

/** 卡片态缓存上限（按项目数计；超出后淘汰最久未访问的条目） */
const CARD_STATE_LIMIT = 32

/** 卡片自持数据 + 一次性查询标志（单个项目的全部可变状态） */
interface CardDataState {
  /** 当前项目访问器（重挂载时更新，保证多设备路径按最新项目对象解析） */
  project: () => GitProject
  projectId: string
  branches: Ref<BranchInfo[]>
  logEntries: Ref<CommitLogEntry[]>
  logLoading: Ref<boolean>
  logStats: Ref<Map<string, CommitStat>>
  stashList: Ref<StashEntry[]>
  tags: Ref<TagInfo[]>
  tagsLoading: Ref<boolean>
  tagCommitMap: Ref<Map<string, string[]>>
  remoteTags: Ref<Map<string, string[]>>
  conflicts: Ref<ConflictFile[]>
  fileDiffs: Ref<Record<string, string>>
  diffLoading: Ref<Record<string, boolean>>
  mdFiles: Ref<MdFileEntry[]>
  logLimit: Ref<number | "all">
  /** logLoading 引用计数（详情首载与手动刷新可能并发） */
  logLoadingRefCount: number
  /** 日志 / 统计请求序号守卫（陈旧响应丢弃） */
  logRequestSeq: number
  logStatsRequestSeq: number
  detailsLoaded: boolean
  detailsPromise: Promise<void> | null
  detailsFailures: number
  detailsCooldownUntil: number
  logStatsRequested: boolean
  remoteTagsRequested: boolean
  /** 差异缓存的在飞去重表与版本记录 */
  diffInflight: Map<string, Promise<unknown>>
  diffMeta: Record<string, number>
  diffTreeVersion: number
}

/** 项目 id + 主路径 → 卡片态（路径变更视为另一个项目，避免复用旧仓库数据） */
const cardStates = new Map<string, CardDataState>()

/** 卡片上次激活的 Tab（会话级记忆；切分类 / 切视图后恢复） */
const cardTabs = new Map<string, CardTabId>()

/** 读取项目上次激活的 Tab（未记录时默认工作区） */
export function getCardTab(projectId: string): CardTabId {
  return cardTabs.get(projectId) ?? "worktree"
}

/** 记录项目当前 Tab（供下次挂载恢复） */
export function rememberCardTab(projectId: string, tab: CardTabId): void {
  cardTabs.set(projectId, tab)
}

/** 构造一个空的卡片态 */
function createState(project: () => GitProject): CardDataState {
  const p = project()
  return {
    project,
    projectId: p.id,
    branches: ref<BranchInfo[]>([]),
    logEntries: ref<CommitLogEntry[]>([]),
    logLoading: ref(false),
    logStats: ref<Map<string, CommitStat>>(new Map()),
    stashList: ref<StashEntry[]>([]),
    tags: ref<TagInfo[]>([]),
    tagsLoading: ref(false),
    tagCommitMap: ref<Map<string, string[]>>(new Map()),
    remoteTags: ref<Map<string, string[]>>(new Map()),
    conflicts: ref<ConflictFile[]>([]),
    fileDiffs: ref<Record<string, string>>({}),
    diffLoading: ref<Record<string, boolean>>({}),
    mdFiles: ref<MdFileEntry[]>([]),
    logLimit: ref<number | "all">(DEFAULT_LOG_LIMIT),
    logLoadingRefCount: 0,
    logRequestSeq: 0,
    logStatsRequestSeq: 0,
    detailsLoaded: false,
    detailsPromise: null,
    detailsFailures: 0,
    detailsCooldownUntil: 0,
    logStatsRequested: false,
    remoteTagsRequested: false,
    diffInflight: new Map<string, Promise<unknown>>(),
    diffMeta: {},
    diffTreeVersion: 0,
  }
}

/** 取缓存态（命中即刷新 LRU 次序并更新项目访问器；未命中则新建并按上限淘汰最旧） */
function acquireState(project: () => GitProject): CardDataState {
  const p = project()
  const key = `${p.id}::${p.path}`
  const cached = cardStates.get(key)
  if (cached) {
    cardStates.delete(key)
    cardStates.set(key, cached)
    cached.project = project
    return cached
  }
  const state = createState(project)
  cardStates.set(key, state)
  while (cardStates.size > CARD_STATE_LIMIT) {
    const oldest = cardStates.keys().next().value
    if (oldest === undefined) break
    cardStates.delete(oldest)
  }
  return state
}

export function useCardData(project: () => GitProject) {
  const services = inject(CARD_SERVICES_KEY)!
  const {
    manager,
    scheduler,
  } = services
  const state = acquireState(project)

  /** 当前项目有效路径（多设备路径解析，实时求值不缓存） */
  const path = () => resolveValidPath(state.project())

  /** 卡片自持数据域的统一单飞入口（force 时绕过在飞查询，用于写操作后的强制重载） */
  function runQuery<T>(kind: "branches" | "stash" | "tags" | "remoteTags" | "conflicts", load: () => Promise<T>, force = false) {
    return scheduler.run(state.projectId, kind, load, force ? { force: true } : undefined)
  }

  async function loadBranches(force = false) {
    state.branches.value = await runQuery("branches", () => manager.getBranches(path()), force)
  }

  /** 更新显示条数（LOG 列表选择框变化时同步，保证后续无参刷新沿用当前选择） */
  function setLogLimit(count: number | "all") {
    state.logLimit.value = count
  }

  /**
   * 加载提交日志并同步项目最近活动时间（count 缺省走 logLimit）。
   *  显式传入 count（用户切换条数）时绕过单飞：必须按新条数重抓，不能复用旧条数的在飞查询。
   *  绕过单飞 ⇒ 可能并发多笔（快速切换条数），故用请求序号守卫写入：
   *  条数小的查询通常更快，若慢的「大条数」结果后到并覆盖，列表会少于用户所选条数
   */
  async function loadLog(count?: number | "all", force = false) {
    const seq = ++state.logRequestSeq
    const entries = await scheduler.run(
      state.projectId,
      "log",
      () => manager.getCommitLog(path(), count ?? state.logLimit.value),
      count === undefined && !force ? undefined : { force: true },
    )
    // 仅最后一次发起的请求可写入（陈旧响应直接丢弃，避免小条数结果被后到的大条数结果覆盖）
    if (seq !== state.logRequestSeq) return
    state.logEntries.value = entries
    const latest = entries[0]?.date
    if (latest) await services.recordCommitActivity(state.projectId, latest)
  }

  /**
   * 加载体提交变更规模（--shortstat 批量单命令；条数跟随 logLimit，上限由 manager 侧收口）。
   *  与 loadLog 同因：强制重取绕过单飞，快速切换条数会并发多笔 --shortstat 查询
   *  （全历史扫 diff，代价高），若慢的「小条数」结果后到会覆盖新的大条数统计。
   *  同样用请求序号守卫写入；logStats 按完整 hash 索引（与 %H 同口径），条数不匹配不会报错只会静默缺数据。
   */
  async function loadLogStats(force = false) {
    const seq = ++state.logStatsRequestSeq
    const stats = await scheduler.run(
      state.projectId,
      "logStats",
      () => manager.getCommitShortStats(path(), state.logLimit.value),
      force ? { force: true } : undefined,
    )
    if (seq !== state.logStatsRequestSeq) return
    state.logStats.value = stats
  }

  async function loadStash(force = false) {
    state.stashList.value = await runQuery("stash", () => manager.stashList(path()), force)
  }

  async function loadTags(force = false) {
    // 一次拉取足够多的 Tag：前 10 条供 TagPanel 展示（保持原 limit 10 行为），全量构建 hash → Tag 名映射供 LOG Tab 使用
    const all = await runQuery("tags", () => manager.getTags(path(), TAG_COMMIT_MAP_LIMIT), force)
    state.tags.value = all.slice(0, 10)
    const map = new Map<string, string[]>()
    for (const t of all) {
      if (!t.hash) continue
      const names = map.get(t.hash)
      if (names) names.push(t.name)
      else map.set(t.hash, [t.name])
    }
    state.tagCommitMap.value = map
  }

  /** 后台拉取各远程已有的 Tag 名列表（ls-remote 网络命令并行执行，失败远程静默跳过，不阻塞 UI） */
  async function loadRemoteTags(force = false) {
    const names = getProjectRemoteNames(state.project()).map((r) => r.name)
    if (names.length === 0) {
      state.remoteTags.value = new Map()
      return
    }
    const results = await runQuery("remoteTags", async () =>
      Promise.all(names.map(async (name) => {
        try {
          return [name, await manager.getRemoteTags(path(), name)] as const
        } catch {
          // 单远程拉取失败（网络/超时）不记录，UI 不显示该远程的推送状态，避免误标"未推送"
          return null
        }
      })), force)
    const map = new Map<string, string[]>()
    for (const r of results) {
      if (r) map.set(r[0], r[1])
    }
    state.remoteTags.value = map
  }

  async function loadConflicts(force = false) {
    state.conflicts.value = await runQuery("conflicts", () => manager.getConflictFiles(path()), force)
  }

  // ── 懒加载与手动刷新入口 ──

  /**
   * logLoading 用引用计数而非布尔：详情首载与手动刷新/切换条数可能并发，
   *  布尔会被先完成的那笔翻回 false，导致仍在飞的查询对应的转圈提前消失
   *  （与 stashLoading / gitOpLoading 的引用计数范式一致）
   */

  /** 进入一笔日志查询（返回退出函数，保证异常路径也能正确减计数） */
  function beginLogLoading(): () => void {
    state.logLoadingRefCount++
    state.logLoading.value = true
    let ended = false
    return () => {
      if (ended) return
      ended = true
      // 不再用 Math.max(0, …) 夹取：那会掩盖 enter/exit 配对错误（重复调用退出函数会
      // 让计数变负却静默归零）。上方 ended 守卫已保证每个闭包至多减一次，
      // 若仍出现负数即为真实缺陷，应在开发期暴露而非被夹掉。
      state.logLoadingRefCount--
      state.logLoading.value = state.logLoadingRefCount > 0
    }
  }

  /**
   * 首次点卡片 / 切 Tab 时懒加载详情。
   *  实例级标记 + 在途 Promise 双守卫：原实现「await 之后才置标记」使并发两次调用都能穿过守卫而重复发 git。
   *  失败重试退避：全失败（如仓库被删）时若每次点击都重跑整组查询，会放大成「点一下 = 7~10 个 git」；
   *  这里记录失败次数，2 次后进入 30s 冷却，冷却期内直接返回，避免错误路径被反复触发。
   */
  async function ensureDetailsLoaded(): Promise<void> {
    if (state.detailsLoaded) return
    if (state.detailsPromise) return state.detailsPromise
    if (Date.now() < state.detailsCooldownUntil) return
    const endLoading = beginLogLoading()
    const promise = (async () => {
      try {
        // 首载并发收敛：同步等待的只有「首屏可见」的 4 项。
        // 原实现把 loadConflicts 也并入同一 Promise.all，单卡片首开即 5 路 git 子进程，
        // 而 GitExecutor 的本地池上限默认 3（gitMaxConcurrent），超出部分排队 ——
        // 多卡片工作区下会把共享池占满，拖慢其他卡片与本卡片后续操作。
        await Promise.all([loadLog(), loadBranches(), loadStash(), loadTags()])
        state.detailsLoaded = true
        state.detailsFailures = 0
        // conflicts 改为后台异步补齐（不阻塞详情展示，语义不变）：
        // 若项目在打开面板前即处于冲突合并态，仅靠 dirty 信号（resolve/abort 触发）
        // 永远拉不到，故仍必须在首载时发起，只是不再占用首屏等待窗口。
        void loadConflicts().catch(() => {})
        // ⚠️ 远程 Tag 状态（每远程 1 次网络 ls-remote）与提交变更统计（200 条约 2.3s）
        //    不再在首载时发起：它们只被 LOG / TAG 面板消费，首载就发等于让「点一下卡片」
        //    额外付最多 4 次网络命令 + 一次全历史 diff 扫描（审查报告 §P1）。
        //    改为对应面板首次可见时懒加载（ensureRemoteTags / ensureLogStats）。
      } catch {
        // 加载失败不标记为已加载，允许重试；但连续失败后进入冷却，避免错误路径被反复触发
        state.detailsFailures++
        if (state.detailsFailures >= 2) state.detailsCooldownUntil = Date.now() + 30_000
      } finally {
        endLoading()
        state.detailsPromise = null
      }
    })()
    state.detailsPromise = promise
    return promise
  }

  /** LOG 面板首次可见时懒加载提交变更规模（--shortstat，代价高，失败静默；失败后允许下次切换重试） */
  function ensureLogStats(): void {
    if (state.logStatsRequested) return
    state.logStatsRequested = true
    loadLogStats().catch(() => {
      // 失败回退标记：下次切到 LOG 面板可再试一次，避免一次 git 抖动后统计永久为空
      state.logStatsRequested = false
    })
  }

  /** TAG 面板首次可见时懒加载远程 Tag 状态（网络 ls-remote，失败静默；失败后允许下次切换重试） */
  function ensureRemoteTags(): void {
    if (state.remoteTagsRequested) return
    state.remoteTagsRequested = true
    loadRemoteTags().catch(() => {
      // 失败回退标记：下次切到 TAG 面板可再试一次，避免一次网络抖动后永久无远程状态
      state.remoteTagsRequested = false
    })
  }

  /**
   * LOG Tab 手动刷新 / 变更显示条数 / 父层写操作后重载：一律强制重取（均为「数据已变」场景）。
   *  统计与列表并行：统计失败不影响列表，故不 await（列表渲染优先级更高）
   */
  async function reloadLog(count?: number | "all") {
    const endLoading = beginLogLoading()
    try {
      await loadLog(count, true)
    } catch {
      // 刷新失败静默降级：调用方（点击/切换条数）不处理拒绝，避免未处理的 Promise 拒绝
    } finally {
      endLoading()
    }
    if (state.logStatsRequested) void loadLogStats(true).catch(() => {})
  }

  /** TAG Tab 手动刷新（强制重取） */
  async function refreshTags() {
    state.tagsLoading.value = true
    try {
      await loadTags(true)
      // 远程 Tag 状态若已在 TAG 面板加载过，跟随刷新（否则等面板打开再懒加载）
      if (state.remoteTagsRequested) await loadRemoteTags(true).catch(() => {})
    } finally {
      state.tagsLoading.value = false
    }
  }

  // ── 文件差异缓存（版本化：工作区每次刷新递增版本，取数时记录版本，版本不符即过期）──
  // 过期条目不删除：打开中的弹窗不会因后台刷新闪空态，仅下次非 force 读取时视为未命中重新取。
  /**
   * 查看文件差异（卡内版）。默认 force=false：
   * - 缓存命中且版本未过期 → 直接返回（来回导航 / 重开弹窗 / 切 scope 命中预取缓存 = 0 git 进程）；
   * - 单飞：同 (文件, 范围) 在飞时共享同一 Promise，不重复 spawn git diff；
   * - force=true 绕过前两者（语义对齐 scheduler.run 的 force）：用于「内容必然已变」的写后路径
   *   （弹窗内暂存切换、暂存状态翻转后的重载）。
   * ⚠️ status 为可选提示（FileChange.status 透传）：untracked 命中 manager 层单进程快速路径（3 → 1）。
   */
  async function loadDiff(file: string, staged: boolean, opts?: { force?: boolean, status?: string }) {
    const key = diffCacheKey(file, staged)
    if (!opts?.force && key in state.fileDiffs.value && state.diffMeta[key] === state.diffTreeVersion) return
    const inflight = state.diffInflight.get(key)
    if (inflight) return inflight
    // 取数时快照版本：响应期间工作区若刷新，本条结果自动降级为「过期」（下次读取重新取）
    const fetchedAtVersion = state.diffTreeVersion
    const exec = (async () => {
      try {
        const text = await manager.getFileDiff(path(), file, staged, opts?.status)
        state.fileDiffs.value[key] = text
        state.diffMeta[key] = fetchedAtVersion
        pruneRecordCache(state.fileDiffs.value, 30)
        // 与 fileDiffs 同步淘汰：prune 删掉的键不再保留版本记录
        for (const k of Object.keys(state.diffMeta)) {
          if (!(k in state.fileDiffs.value)) delete state.diffMeta[k]
        }
      } catch {
        // 取差异失败按空差异呈现（弹窗显示空态），不向上抛以免调用方产生未处理的 Promise 拒绝
        state.fileDiffs.value[key] = ""
        state.diffMeta[key] = fetchedAtVersion
      } finally {
        delete state.diffLoading.value[key]
        state.diffInflight.delete(key)
      }
    })()
    // 创建与登记之间是同步段（首个 await 前不可能有别的调用方插进来），登记必然先于任何并发清理
    state.diffInflight.set(key, exec)
    state.diffLoading.value[key] = true
    return exec
  }

  // ── 父层脏标记响应（提交/stash/tag/冲突/批量刷新完成后按域重载）──

  /**
   * 消费本项目脏域并重载对应数据（幂等：无脏域则无操作）。
   *  一律 force：脏标记语义是「数据已变，必须重取」，复用在飞旧查询会把变更前的数据写回（脏标记失效）
   */
  function applyDirty() {
    const kinds = scheduler.consumeDirty(state.projectId)
    if (!kinds) return
    // 全部后台重载统一吞掉拒绝：这些调用无人 await，插件也未注册 unhandledrejection 处理器，
    // 一旦 git 失败（路径被删/仓库损坏）会冒泡成未处理的 Promise 拒绝。失败按「本次不刷新」降级，
    // 与 loadDiff 的 catch-and-fallback 一致
    const safeReload = (p: Promise<unknown>) => { p.catch(() => {}) }
    if (kinds.has("log")) {
      safeReload(loadLog(undefined, true))
      // 统计只在 LOG 面板用过（已请求过）时才跟着重载；否则等面板打开再懒加载
      if (state.logStatsRequested) safeReload(loadLogStats(true))
    }
    if (kinds.has("branches")) safeReload(loadBranches(true))
    if (kinds.has("stash")) safeReload(loadStash(true))
    if (kinds.has("tags")) {
      // loadTags 失败时跳过远程 Tag 刷新（否则 .then 不执行且整链成为未处理拒绝）
      safeReload(loadTags(true).then(() => {
        // 推送/删除 Tag 后同步刷新远程 Tag 状态（网络命令后台执行）；
        // 与 TAG 面板懒加载同口径：面板未打开过就跳过，避免未展示面板也付 N 次 ls-remote
        if (state.remoteTagsRequested) loadRemoteTags(true).catch(() => {})
      }))
    }
    if (kinds.has("conflicts")) safeReload(loadConflicts(true))
  }

  // 工作区版本号：workingTrees 条目每次整体替换（新对象引用）即递增
  watch(() => scheduler.workingTrees.value[state.projectId], () => {
    state.diffTreeVersion++
  })

  // 单值 epoch watch：替代原 5 个按域 watch（每个都读取同一个 cardRefreshSignals 对象，
  // 任一域变更都令全部卡片的全部 watcher 重新求值）。无脏域时本回调立即返回。
  watch(() => scheduler.epoch.value, applyDirty)
  // 卡片重挂载时补消费：卸载期间父层写入的脏标记不会被 watch 捕获
  onMounted(applyDirty)

  // Markdown 文件标识：每次挂载刷新一次（扫描结果本身带目录 mtime 缓存，命中时为 0 IO）
  onMounted(() => {
    state.mdFiles.value = scanMarkdownFiles(path())
  })

  return {
    branches: state.branches,
    logEntries: state.logEntries,
    logLoading: state.logLoading,
    logStats: state.logStats,
    stashList: state.stashList,
    tags: state.tags,
    tagsLoading: state.tagsLoading,
    tagCommitMap: state.tagCommitMap,
    remoteTags: state.remoteTags,
    conflicts: state.conflicts,
    fileDiffs: state.fileDiffs,
    diffLoading: state.diffLoading,
    mdFiles: state.mdFiles,
    ensureDetailsLoaded,
    ensureLogStats,
    ensureRemoteTags,
    reloadLog,
    refreshTags,
    loadDiff,
    logLimit: state.logLimit,
    setLogLimit,
  }
}
