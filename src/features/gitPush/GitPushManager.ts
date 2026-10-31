// Git 推送任务管理门面：组合各领域协作者（managers/），对外暴露统一 API
import type { Plugin } from "siyuan"
import type { App } from "vue"
import type {
  LineStatsStore,
  ProjectStatsRecord,
} from "./managers/LineStatsStore"
import type { AllPlatformResult } from "./managers/RemoteOps"
import type { RepoCleanStep } from "./managers/RepoCleanOps"
import type { NumstatCommit } from "./reportMetrics"
import type {
  BfgCleanPlan,
  BfgCleanResult,
  BfgRuntimeState,
  PlatformKey,
  RepoScanResult,
} from "./types/meta"
import type { ProbeConfig } from "./types/probeConfig"
import type { PushProfileInput, PushProfileView } from "./types/pushProfile"
import { GIT_CONFIG_ENV_MIN_MAJOR, GIT_CONFIG_ENV_MIN_MINOR } from "./types/pushProfile"
import type {
  BranchInfo,
  CommitLogEntry,
  CommitStat,
  CommitTemplate,
  ConflictFile,
  GitProject,
  GitRemoteInfo,
  ProjectCategory,
  ProjectPathExtras,
  PushStatusInfo,
  ScannedGitRepo,
  StashEntry,
  TagInfo,
  WorkingTreeInfo,
} from "./types/storage"
import type { AiApiConfig } from "@/utils/aiApi"
import type { DockAppHandle } from "@/utils/vueAppHelper"
import {
  openTab,
  openWindow,
} from "siyuan"
import {
  createApp,
  h,
} from "vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { clearMarkdownScanCacheFor } from "./composables/useMarkdownFiles"
import GitPushPanel from "./index.vue"
import { BfgOps } from "./managers/BfgOps"
import {
  buildRootHash,
  CommitIndex,
  rootHashGitDir,
} from "./managers/CommitIndex"
import { CommitMsgGenerator } from "./managers/CommitMsgGenerator"
import { GitExecutor } from "./managers/GitExecutor"
import {
  canSkipScan,
  isIndexComplete,
  nextCoveredDays,
} from "./managers/indexCoverage"
import { createIndexIo } from "./managers/indexDir"
import {
  resolveRepoIdentity,
  scanProjectFileLines,
  sumScannedLines,
} from "./managers/lineScan"
import {
  openLineStatsStore,
} from "./managers/LineStatsStore"
import { ProjectStore } from "./managers/ProjectStore"
import { ProjectWriteLock } from "./managers/ProjectWriteLock"
import { PushProfileStore } from "./managers/PushProfileStore"
import { RemoteOps } from "./managers/RemoteOps"
import { RepoCleanOps } from "./managers/RepoCleanOps"
import { RepoOps } from "./managers/RepoOps"
import { ReportOps } from "./managers/ReportOps"
import { scriptSessions } from "./managers/ScriptSessionStore"
import { WorktreeOps } from "./managers/WorktreeOps"
import {
  clampIndexMaxCommits,
  INDEX_META_VERSION,
} from "./types/indexCache"
import { clampProbeConfig } from "./types/probeConfig"
import { GitPushStorage } from "./types/storage"
import {
  buildPushProfileEnv,
  DEFAULT_LOG_LIMIT,
  getCurrentDeviceName,
  poolProcess,
  resolveValidPath,
} from "./utils"

/** 索引状态查询的加载并发上限（每项目 2 次 NDJSON 读盘 + 解析；限流压住设置面板打开时的 IO 峰值） */
const INDEX_STATUS_LOAD_CONCURRENCY = 4

/** 自定义 Tab 模型实例的最小结构（init 回调的 this） */
interface TabCustom {
  element?: Element
}

/** 独立窗口自定义页签类型 */
export const GIT_PUSH_TAB_TYPE = "git-push-tab"

/** 模块级重复注册防护：多窗口场景下每个渲染进程只注册一次 */
let tabRegistered = false

export class GitPushManager {
  private plugin: Plugin
  storage: GitPushStorage
  private executor: GitExecutor
  private store: ProjectStore
  /** 推送账号（全局默认 + 项目绑定；git 子进程环境解析的数据源） */
  private pushProfiles: PushProfileStore
  /** Git 是否支持 GIT_CONFIG_COUNT（≥2.31）；null = 尚未探测 */
  private gitConfigEnvSupported: boolean | null = null
  /** 版本探测进行中（仅用于让探测命令自身跳过环境解析，防止递归） */
  private gitVersionChecking = false
  /** 在途版本探测 Promise（并发的网络命令共享同一次探测结果） */
  private gitVersionProbe: Promise<boolean> | null = null
  /** 令牌因 Git 版本过低被跳过时只告警一次 */
  private warnedTokenSkipped = false
  private remoteOps: RemoteOps
  private worktreeOps: WorktreeOps
  private repoOps: RepoOps
  private commitMsgGen: CommitMsgGenerator
  private reportOps: ReportOps
  /** BFG 运行时层（Java 探测 + jar 下载 + 进程执行） */
  private bfgOps: BfgOps
  /** 仓库清理编排（体检扫描 + BFG 六步工作流） */
  private repoCleanOps: RepoCleanOps
  /** 项目级写锁：git 写操作（本地写 + push/pull）按项目路径串行，防 index.lock 竞争 */
  private writeLock = new ProjectWriteLock()
  /** 独立窗口页签 Vue app 与容器（addTab 承载） */
  private tabApp: App | null = null
  private tabContainer: HTMLElement | null = null
  /**
   * Dock 面板卸载句柄（createVueDockApp 返回）。
   *
   * 必须由 manager 持有并在 destroy() 中调用：`addDock` 的 destroy 回调只在 Dock 移除时触发，
   * 而插件卸载路径不会等待该回调，面板内探测链（定时器 + fs.watch）会随之泄漏。
   */
  private dockHandle: DockAppHandle | null = null
  /**
   * gitdir 解析缓存（projectPath → { dir }）。
   *
   * 探测层为每个项目重建 `.git` 监听时要付一次 `rev-parse --absolute-git-dir`（~250ms/进程）。
   * 缓存到 manager 后，独立页签/浮动窗口重开时不再重复付这份进程成本；
   * 5 分钟 TTL 与探测层周期性重建同口径，项目路径变更时按 path 键自然失效。
   */
  private gitDirCache = new Map<string, { dir: string, at: number }>()
  /** 同 path 的解析在途 Promise（并发调用共享一次 rev-parse，避免重建时 N 路并发进程） */
  private gitDirPending = new Map<string, Promise<string>>()
  /**
   * 已销毁标记。
   *
   * destroy() 之后必须阻止「异步链路恢复后再初始化」：getIndex/getLineStatsStore 的
   * await 期间若发生卸载，旧实现会把新建的实例重新写回字段（commitIndex/lineStatsStoreInit），
   * 于是刚释放的内存与 SQLite 句柄被重新创建且再无人关闭。
   */
  private destroyed = false
  /**
   * 本地提交索引（延迟构造：目录解析需 await 工作空间路径，而构造函数不能是 async）。
   * null = 尚未初始化或索引不可用（此时全部统计路径回退到直接跑 git）。
   */
  private commitIndex: CommitIndex | null = null
  /** 索引初始化 Promise（并发调用共享同一次初始化，失败只告警一次） */
  private indexInit: Promise<CommitIndex | null> | null = null

  /**
   * 行数统计 SQLite 存储（延迟构造，理由同 commitIndex）。
   * 只经 getLineStatsStore() 访问；初始化 Promise 缓存见 lineStatsStoreInit。
   */
  /** 行数存储初始化 Promise（并发调用共享同一次初始化） */
  private lineStatsStoreInit: Promise<LineStatsStore | null> | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GitPushStorage(plugin)
    this.executor = new GitExecutor(this.storage)
    this.store = new ProjectStore(this.storage, this.executor)
    this.pushProfiles = new PushProfileStore(this.storage)
    this.remoteOps = new RemoteOps(this.executor, this.store, this.storage, this.writeLock)
    this.worktreeOps = new WorktreeOps(this.executor)
    this.repoOps = new RepoOps(this.executor)
    this.commitMsgGen = new CommitMsgGenerator(plugin, this.executor, this.worktreeOps, this.storage)
    this.reportOps = new ReportOps(this.executor)
    this.bfgOps = new BfgOps(plugin, { load: () => this.storage.bfgPrefs.loadOrDefault() })
    this.repoCleanOps = new RepoCleanOps(this.executor, this.bfgOps, this.worktreeOps, plugin.name)
    this.registerTabModel()
  }

  // ── 本地提交索引（跨会话增量刷新的核心；不可用时全部路径自动回退直接跑 git）──

  /**
   * 获取索引实例（首次调用解析目录并构造；失败返回 null 且只告警一次）。
   * 索引关闭（indexEnabled=false）时同样返回 null，使所有调用方走旧路径。
   *
   * 失败时**清空缓存的初始化 Promise**：否则一次瞬时失败（启动期 dataDir 尚未就绪、
   * 目录短暂不可写）会把 `indexInit` 永久钉死为 null，导致整个会话都用不上索引，
   * 且 `setIndexEnabled(true)` / `clearIndex()` 都无法恢复。清空后下次调用会重试。
   */
  async getIndex(): Promise<CommitIndex | null> {
    if (this.destroyed) return null
    if (!(await this.storage.indexEnabled.loadOrDefault())) return null
    if (this.indexInit) return this.indexInit
    const init = (async () => {
      try {
        const io = await createIndexIo(this.plugin)
        if (!io) {
          console.warn("[gitPush] 无法确定插件数据目录，本地提交索引已禁用（统计将直接扫描 git）")
          return null
        }
        const meta = await this.storage.indexMeta.loadOrDefault()
        return new CommitIndex(io, meta)
      } catch (e) {
        console.warn("[gitPush] 本地提交索引初始化失败，已回退直接扫描 git", e)
        return null
      }
    })()
    this.indexInit = init
    const index = await init
    // 卸载竞态：await 期间已 destroy → 不能把新实例写回字段，直接丢弃并释放
    if (this.destroyed) {
      index?.dispose()
      return null
    }
    // 初始化失败（null）不保留缓存，允许后续调用重新尝试；成功则保持缓存复用
    if (!index && this.indexInit === init) this.indexInit = null
    this.commitIndex = index
    return index
  }

  /**
   * 获取行数统计 SQLite 存储（首次调用构造；不可用返回 null 且只告警一次）。
   *
   * 失败时**清空缓存的初始化 Promise**：与 getIndex 同理，一次瞬时失败
   * （启动期工作区路径未就绪）不应把 `lineStatsStoreInit` 永久钉死为 null。
   */
  async getLineStatsStore(): Promise<LineStatsStore | null> {
    if (this.destroyed) return null
    if (this.lineStatsStoreInit) return this.lineStatsStoreInit
    const init = (async () => {
      try {
        const store = await openLineStatsStore(this.plugin)
        if (!store) {
          console.warn("[gitPush] 行数统计数据库不可用，行数扫描将每次全量重算（功能不受影响，仅较慢）")
        }
        return store
      } catch (e) {
        console.warn("[gitPush] 行数统计存储初始化失败，已回退全量重算", e)
        return null
      }
    })()
    this.lineStatsStoreInit = init
    const store = await init
    // 卸载竞态：await 期间已 destroy → 立即关闭新连接，且不写回缓存（否则句柄永不释放）
    if (this.destroyed) {
      try { store?.close() } catch { /* 关闭失败不影响卸载 */ }
      return null
    }
    // 失败不保留缓存，允许后续调用重新尝试；成功则保持复用
    if (!store && this.lineStatsStoreInit === init) this.lineStatsStoreInit = null
    return store
  }

  /** 索引元数据持久化（索引写盘后由调用方触发；失败仅告警，不影响本次统计结果） */
  async persistIndexMeta(): Promise<void> {
    if (!this.commitIndex) return
    try {
      await this.storage.indexMeta.save({
        version: INDEX_META_VERSION,
        projects: this.commitIndex.getProjectMetas(),
      })
    } catch (e) {
      console.warn("[gitPush] 索引元数据持久化失败", e)
    }
  }

  /** 清空本地提交索引（设置面板「重建索引」/ 排障用） */
  async clearIndex(): Promise<void> {
    const index = await this.getIndex()
    if (!index) return
    await index.clearAll()
    await this.persistIndexMeta()
  }

  /** 索引开关（关闭后统计路径回退直接跑 git） */
  async setIndexEnabled(on: boolean): Promise<void> {
    await this.storage.indexEnabled.save(on)
  }

  /** 读取索引开关 */
  async isIndexEnabled(): Promise<boolean> {
    return this.storage.indexEnabled.loadOrDefault()
  }

  /** 单项目索引提交上限（设置项，超出即标记截断） */
  async getIndexMaxCommits(): Promise<number> {
    return clampIndexMaxCommits(await this.storage.indexMaxCommits.loadOrDefault())
  }

  /** 设置单项目索引提交上限（钳位后持久化；下次扫描生效） */
  async setIndexMaxCommits(n: number): Promise<void> {
    await this.storage.indexMaxCommits.save(clampIndexMaxCommits(n))
  }

  // ── 行数统计（存量行数 + 仓库生命周期，增量扫描 + SQLite 复用）──

  /**
   * 扫描单项目的存量行数（增量）与生命周期时间。
   *
   * 性能设计（本机实测单次 git 调用 ≈ 300–500ms，几乎全是进程创建开销，
   * 故**减少调用次数**比减少数据量更有效）：
   * - 生命周期快照：`getRepoLifecycle` 用 **2 次** git 调用拿齐 HEAD oid / 末次提交 / 根提交
   *   （原实现为 3 次：log -n1 + rev-parse --absolute-git-dir + log --reverse -1）；
   * - `HEAD oid` 未变 → **直接读 SQLite 汇总行返回**，不再跑 ls-files、不再 statSync；
   * - HEAD 变了 → `git ls-files`（1 次）+ 逐文件 statSync 比对，只重读变化文件。
   *
   * 失效判据只用 `project.id + HEAD oid`（不再比较 gitdir）：正是为了省掉
   * `rev-parse --absolute-git-dir` 这次调用。
   *
   * 生命周期时间：
   * - `firstCommit`（新建日期）：历史根时间，`rev-list --max-parents=0` 一次拿到；
   *   只要非空就永久复用（根提交不会因新提交改变）。
   * - `lastCommit`（最后修改）：HEAD 提交时间，随 `log -n1` 一并返回，零额外调用。
   *
   * @param project 目标项目（取其 id / name / 路径）
   * @param shouldInclude 扩展名过滤谓词（只影响 totalLines 合计，不影响缓存内容）
   * @param forceRescan 忽略缓存强制重算（详情弹窗「刷新」用）
   */
  async scanProjectLineStats(
    project: GitProject,
    shouldInclude: (path: string) => boolean,
    forceRescan = false,
  ): Promise<{
    totalLines: number
    fileCount: number
    firstCommit: string
    lastCommit: string
    fileLines: Map<string, number | null>
    source: "cache" | "incremental" | "full"
  }> {
    const projectPath = resolveValidPath(project)
    const store = await this.getLineStatsStore()
    // 2 次 git 调用拿齐生命周期（原 3 次）
    const lifecycle = await this.reportOps.getRepoLifecycle(projectPath)
    const nowIso = new Date().toISOString()

    // 空仓库（无 HEAD）：无文件、无提交，直接给出空结果（不必读写缓存）
    if (!lifecycle.head) {
      return {
        totalLines: 0,
        fileCount: 0,
        firstCommit: "",
        lastCommit: "",
        fileLines: new Map<string, number | null>(),
        source: "cache",
      }
    }

    const cached: ProjectStatsRecord | null = store ? store.getProjectStats(project.id) : null
    // 仓库身份（零 git 调用，仅 fs 探测 .git 路径）。
    // 必须参与判定：clone / 模板复制出的两个仓库初始 HEAD 完全相同，
    // 只比 headOid 会让「项目路径改指向另一份克隆」命中缓存、返回旧仓库行数。
    const repoId = resolveRepoIdentity(projectPath)
    const identityMatch = !!cached
      && cached.headOid === lifecycle.head
      && !!repoId
      && cached.repoId === repoId

    // ── 快路径 1：HEAD 未变 → 直接复用（零 ls-files、零 statSync、零读盘）──
    if (identityMatch && !forceRescan) {
      const files = store!.getFileLines(project.id)
      let totalLines = 0
      let fileCount = 0
      for (const [p, rec] of files) {
        if (rec.lines === null || !shouldInclude(p)) continue
        totalLines += rec.lines
        fileCount++
      }
      // 历史根时间：**本次探测值优先，缓存值仅作探测失败时的兜底**。
      //
      // 为什么不能反过来（先用缓存）：旧实现用 `git log --reverse -1` 取「首个提交」，
      // 而 `--reverse` 作用于**已按条数截断的输出**（`-n 1` 先截成 1 条 = HEAD，
      // `--reverse` 再反转这一条），故该命令恒返回 **HEAD 的时间**。
      // 那个错误值一旦写进缓存，就会被「有值就复用」的逻辑永久固化，
      // 表现为「新建日期」与「最后修改」永远相同。
      //
      // 现在 `rootDate` 由 `getRepoLifecycle` **每次都并发探测**（与 HEAD 一次调用打包，
      // 零额外进程开销），故直接采信新鲜值 —— 旧缓存里的错值会被自动纠正。
      // 探测失败（git 抖动 / shallow 未就绪）时 rootDate 为空，才回退缓存兜底。
      const firstCommit = lifecycle.rootDate || cached.firstCommit
      const lastCommit = lifecycle.lastDate
      // 纠正后落库（rootDate 为空时保留旧值，不把正确数据冲掉）
      if (firstCommit !== cached.firstCommit || lastCommit !== cached.lastCommit) {
        try {
          store!.updateCommitTimes(project.id, firstCommit, lastCommit, cached.analyzedAt)
        } catch {
          // 补写失败不影响返回（下次仍会尝试）
        }
      }
      const fileLines = new Map<string, number | null>()
      for (const [p, rec] of files) fileLines.set(p, rec.lines)
      return {
        totalLines,
        fileCount,
        firstCommit,
        lastCommit,
        fileLines,
        source: "cache",
      }
    }

    // ── 路径 2/3：增量扫描（store 可用）或全量扫描（store 不可用）──
    // 这 1 次 ls-files 只在 HEAD 变化时发生
    const trackedFiles = await this.reportOps.getTrackedFiles(projectPath)
    const cachedFiles = store ? store.getFileLines(project.id) : new Map()
    // 判据选择：**这里刻意不用 git status 变更集，一律逐文件 statSync**。
    //
    // 本函数走到这里的前提是「HEAD 已经变了」。而 git status 描述的是
    // 「工作区相对 index 的差异」——它**看不见 index 自身的变化**：
    //   ① 切分支（git checkout/worktree switch）：文件内容变了，index 同步更新，
    //      于是 git status 报「干净」，变更集为空 → 全部文件沿用旧行数 → **行数错误**；
    //   ② 外部执行 git add / git reset --hard / stash：同理。
    // 这类场景在实际使用中非常常见（切分支是日常操作），而它们正好全部落在
    // 「HEAD 变了」这条路径上，因此 git status 变更集在这里不但省不了多少，
    // 还会引入静默的数据错误。
    //
    // statSync 本身就能发现内容变化（按 mtime+size 比对），故这里是正确解；
    // 大仓库的 stat 成本（约 93µs/文件）已由「只对变化文件读内容」抵消，
    // 且 git status 自身也要付出一次 220ms 级进程启动，收益本就有限。
    const scan = scanProjectFileLines(projectPath, trackedFiles, cachedFiles)
    const totalLines = sumScannedLines(scan.files, shouldInclude)
    let fileCount = 0
    const fileLines = new Map<string, number | null>()
    for (const f of scan.files) {
      fileLines.set(f.path, f.lines)
      if (f.lines !== null && shouldInclude(f.path)) fileCount++
    }

    // 历史根时间：与快路径同口径 —— **本次探测值优先**，缓存仅在探测失败时兜底。
    // （旧实现是「缓存有值就复用」，会把旧版 `git log --reverse -1` 写错的
    //   HEAD 时间永久固化，使「新建日期」恒等于「最后修改」。）
    const firstCommit = lifecycle.rootDate || cached?.firstCommit || ""
    const lastCommit = lifecycle.lastDate

    if (store) {
      try {
        store.saveProjectStats({
          projectId: project.id,
          name: project.name,
          totalLines,
          fileCount,
          firstCommit,
          lastCommit,
          headOid: lifecycle.head,
          // 仓库身份（.git 规范化路径）：使「改指向另一份 clone」正确失效
          repoId,
          analyzedAt: nowIso,
        }, scan.files)
      } catch (e) {
        // 落库失败不影响本次结果：下次分析只是又走一遍增量扫描
        console.warn(`[gitPush] 行数统计落库失败（项目 ${project.name}）`, e)
      }
    }

    return {
      totalLines,
      fileCount,
      firstCommit,
      lastCommit,
      fileLines,
      source: store ? "incremental" : "full",
    }
  }

  /** 清理已删除项目的行数统计数据（项目列表变化后调用，防数据无界增长） */
  async pruneLineStats(keepIds: string[]): Promise<void> {
    const store = await this.getLineStatsStore()
    if (!store) return
    try {
      store.pruneProjects(keepIds)
    } catch (e) {
      console.warn("[gitPush] 清理行数统计数据失败", e)
    }
  }

  /** 清空全部行数统计缓存（设置面板「重建索引」/ 排障用；下次分析全量重算） */
  async clearLineStats(): Promise<void> {
    const store = await this.getLineStatsStore()
    if (!store) return
    try {
      store.pruneProjects([])
    } catch (e) {
      console.warn("[gitPush] 清空行数统计缓存失败", e)
    }
  }

  /**
   * 索引状态摘要（设置面板展示：目录 + 已索引项目数 + 各项目提交数与截断标记）。
   *
   * 必须逐项目 `ensureLoaded` 后再取提交数：`getCommitCount` 返回的是**内存段长度**，
   * 未加载的项目恒为 0，直接展示会让设置面板对每个项目都显示「0 条提交」。
   * 单项目读取失败（文件损坏/被删）按 0 呈现，不让整个状态查询失败。
   *
   * 并发受限：`ensureLoaded` 每项目要读盘解析两份 NDJSON，且解析后的段会常驻内存
   * （仅 invalidate/clearAll 时释放）。原实现用 `Promise.all` 对全部项目并发，
   * 在索引项目较多时打开设置面板即形成一次性 N 路读盘 + 解析峰值。改为经
   * poolProcess 限流（恒定并发、无批次屏障），既压住峰值又不拖慢整体。
   */
  async getIndexStatus(): Promise<{ dir: string, projects: Array<{ projectId: string, commits: number, complete: boolean, analyzedAt: string }> }> {
    const index = await this.getIndex()
    if (!index) {
      return {
        dir: "",
        projects: [],
      }
    }
    const metas = index.getProjectMetas()
    const projects: Array<{ projectId: string, commits: number, complete: boolean, analyzedAt: string }> = []
    // 结果按 metas 原序写入（poolProcess 的 index 即原数组下标），保持展示顺序稳定
    await poolProcess(metas, INDEX_STATUS_LOAD_CONCURRENCY, async (p, i) => {
      let commits = 0
      try {
        await index.ensureLoaded(p.projectId)
        commits = index.getCommitCount(p.projectId)
      } catch {
        // 单项目读取失败不影响其余项目（文件被删/损坏时按 0 展示）
      }
      projects[i] = {
        projectId: p.projectId,
        commits,
        complete: p.complete,
        analyzedAt: p.analyzedAt,
      }
    })
    return {
      dir: index.getDir(),
      projects,
    }
  }

  async init() {
    if (this.destroyed) return
    await this.storage.init()
    await this.pushProfiles.load()
    await this.executor.loadGitConcurrency()
    await this.executor.loadNetworkTimeout()
    await this.executor.loadLocalTimeout()
    await this.remoteOps.loadPushBranchMode()
    // 账号环境按项目路径解析：push/pull/fetch/tag 等全部 go through execGit，无需逐调用点传参
    this.executor.setEnvResolver((cwd, args) => this.resolveGitEnv(cwd, args))
    // 卸载竞态：await 期间插件可能已被卸载（onunload → destroy）。此时再挂 Dock 会创建一个
    // 无人再销毁的 Vue app + 探测链，正是本次要消除的泄漏类型。
    if (this.destroyed) return
    const i18n = this.getPanelI18n()

    this.dockHandle = createVueDockApp(this.plugin, GitPushPanel, {
      icon: "iconGitPush",
      title: i18n.title || "Git 推送",
      type: "git-push-dock",
      width: 420,
      i18n,
      extraProps: {
        manager: this,
      },
    })
  }

  /**
   * 插件卸载 / 禁用时的统一销毁。
   *
   * 清理顺序刻意如此：先停探测侧入口（Dock 面板 unmount → 组件 onUnmounted → gitProbe.destroy），
   * 再销毁执行器与写锁，最后释放索引/行数存储句柄——避免「已卸载但探测链仍在跑」的窗口期。
   * 历史实现只清 writeLock/executor/tab，遗漏 Dock 面板与 SQLite 句柄，导致插件重载后
   * 旧探测链继续 spawn git（详见 docs/gitPush-memory-cpu-review.md §L1/L2）。
   */
  destroy() {
    // 先置标记：阻断 init/getIndex/getLineStatsStore 的异步恢复路径（见字段注释）
    this.destroyed = true
    this.dockHandle?.unmount()
    this.dockHandle = null
    this.unmountTabPanel()
    this.writeLock.destroy()
    this.executor.setEnvResolver(null)
    this.executor.destroy()
    // 杀掉托管中的脚本会话进程（dev server 等长驻脚本关弹窗不杀，但卸载必须清，防孤儿）
    scriptSessions.destroyAll()
    // 释放行数统计 SQLite 句柄（openWithRetry 每次新建 DatabaseSync，不 close 会随重载累积）
    const storeInit = this.lineStatsStoreInit
    this.lineStatsStoreInit = null
    if (storeInit) {
      void storeInit.then((store) => {
        try { store?.close() } catch { /* 关闭失败不影响卸载 */ }
      })
    }
    // 释放提交索引内存段（segments/fileLinesByProject 只增不减，见 §L2）
    this.commitIndex?.dispose()
    this.commitIndex = null
    this.indexInit = null
    this.gitDirCache.clear()
    this.gitDirPending.clear()
  }

  // ── 独立窗口承载（addTab + openTab + openWindow 官方 API）──

  /** 注册独立窗口自定义页签模型（addTab 需同步注册，构造时调用） */
  private registerTabModel() {
    if (tabRegistered) return
    tabRegistered = true

    const self = this
    const init = function (this: TabCustom) {
      if (this.element) {
        self.mountTabPanel(this.element as HTMLElement)
      }
    }
    const destroy = () => {
      self.unmountTabPanel()
    }

    this.plugin.addTab({
      type: GIT_PUSH_TAB_TYPE,
      init: init as () => void,
      destroy,
    })
  }

  /** 挂载 Vue 面板到独立页签容器（容器补全局基准字号类 + 全高，与 createVueDockApp 一致） */
  private mountTabPanel(element: HTMLElement) {
    this.unmountTabPanel()
    const container = document.createElement("div")
    container.classList.add("vp-dock-root")
    container.style.height = "100%"
    container.style.overflow = "hidden"
    this.tabContainer = container
    element.appendChild(container)
    this.tabApp = createApp({
      setup: () => () => h(GitPushPanel as any, {
        i18n: this.getPanelI18n(),
        plugin: this.plugin,
        manager: this,
        mode: "tab",
      }),
    })
    this.tabApp.mount(container)
  }

  private unmountTabPanel() {
    if (this.tabApp) {
      this.tabApp.unmount()
      this.tabApp = null
    }
    if (this.tabContainer) {
      this.tabContainer.remove()
      this.tabContainer = null
    }
  }

  /** 打开独立浮动窗口：先创建/聚焦主窗口页签，再移入浮动窗口（关闭浮动窗口页签自动移回主窗口） */
  async openFloating(): Promise<void> {
    const tab = await this.openTabInMainWindow()
    if (!tab) return
    try {
      openWindow({
        width: 1280,
        height: 800,
        tab,
      })
    } catch (error) {
      console.error("[GitPush] openWindow failed, tab stays in main window:", error)
    }
  }

  /** 在主窗口创建/聚焦页签，返回 Tab（供移入浮动窗口）；失败返回 null */
  private async openTabInMainWindow() {
    try {
      const title = this.getPanelI18n().title || "Git 推送"
      return await openTab({
        app: this.plugin.app,
        custom: {
          id: `${this.plugin.name}${GIT_PUSH_TAB_TYPE}`,
          icon: "iconGitPush",
          title,
        },
        position: "right",
      })
    } catch (error) {
      console.error("[GitPush] openTab failed:", error)
      return null
    }
  }

  /** 面板 i18n 提取（gitPush 嵌套键存在则用之，否则回退到根 i18n） */
  private getPanelI18n(): Record<string, any> {
    const pluginI18n = (this.plugin.i18n as Record<string, any>) || {}
    return pluginI18n.gitPush || pluginI18n
  }

  // ── 执行器（并发上限 / 网络超时 / 取消）──

  getGitConcurrency(): number { return this.executor.getGitConcurrency() }

  async setGitConcurrency(n: number): Promise<void> { return this.executor.setGitConcurrency(n) }

  /** 获取网络命令超时（秒，供设置面板显示） */
  getNetworkTimeout(): number { return this.executor.getNetworkTimeout() }

  /** 设置网络命令超时（秒）并持久化 */
  async setNetworkTimeout(n: number): Promise<void> { return this.executor.setNetworkTimeout(n) }

  /** 获取本地命令超时（秒，供设置面板显示） */
  getLocalTimeout(): number { return this.executor.getLocalTimeout() }

  /** 设置本地命令超时（秒）并持久化 */
  async setLocalTimeout(n: number): Promise<void> { return this.executor.setLocalTimeout(n) }

  // ── 推送账号（多账号认证 + 提交身份覆盖；不改写任何 .gitconfig）──

  /** 账号视图列表（不含令牌明文） */
  async getPushProfileViews(): Promise<PushProfileView[]> {
    await this.pushProfiles.load()
    return this.pushProfiles.getViews()
  }

  /** 全局默认账号 ID（空串 = 不套用，使用系统 Git 配置） */
  async getDefaultPushProfileId(): Promise<string> {
    await this.pushProfiles.load()
    return this.pushProfiles.getDefaultId()
  }

  /** 全局默认账号显示名（空串 = 系统 Git 配置） */
  async getDefaultPushProfileLabel(): Promise<string> {
    await this.pushProfiles.load()
    return this.pushProfiles.getDefaultLabel()
  }

  /** 新建或更新账号（令牌留空且主机已存在时保留原密文） */
  async savePushProfile(input: PushProfileInput): Promise<PushProfileView> {
    await this.pushProfiles.load()
    return this.pushProfiles.saveProfile(input)
  }

  /** 删除账号，并清空仍绑定它的项目（避免项目停留在失效绑定上） */
  async deletePushProfile(id: string): Promise<void> {
    await this.pushProfiles.load()
    const projects = await this.store.getProjects()
    const affected = projects.filter((p) => p.pushProfileId === id)
    await this.pushProfiles.deleteProfile(id)
    for (const p of affected) {
      await this.updateProjectMeta(p.id, { pushProfileId: "" })
    }
  }

  /** 设置全局默认账号（空串 = 不套用；不存在的 ID 视为清空） */
  async setDefaultPushProfileId(id: string): Promise<void> {
    await this.pushProfiles.load()
    await this.pushProfiles.setDefaultId(id)
  }

  /** Git 是否支持 GIT_CONFIG_COUNT（null = 尚未探测过；false 时令牌凭据不生效） */
  getGitConfigEnvSupported(): boolean | null {
    return this.gitConfigEnvSupported
  }

  /** 主动探测 Git 版本（设置面板展示令牌可用性；无项目时用进程工作目录） */
  async checkGitConfigEnvSupport(): Promise<boolean> {
    if (this.gitConfigEnvSupported !== null) return this.gitConfigEnvSupported
    const projects = await this.store.getProjects()
    const cwd = projects[0]?.path || process.cwd()
    return this.ensureGitConfigEnvSupported(cwd)
  }

  /**
   * 解析 git 子进程账号环境（GitExecutor 注入的 resolver）。
   * 顺序：项目路径 → 项目绑定（或全局默认）→ 环境变量。
   */
  private async resolveGitEnv(cwd: string, args: string[]): Promise<Record<string, string> | undefined> {
    if (this.destroyed || this.gitVersionChecking || !this.pushProfiles.hasAny()) return undefined
    const project = await this.store.findProjectByPath(cwd)
    if (!project) return undefined
    const profile = this.pushProfiles.resolveForProject(project)
    if (!profile) return undefined
    const configEnvSupported = profile.credentials.length > 0
      ? await this.ensureGitConfigEnvSupported(cwd)
      : true
    const { env, skippedCredentialHosts } = buildPushProfileEnv(profile, args, { configEnvSupported })
    if (skippedCredentialHosts.length && !this.warnedTokenSkipped) {
      this.warnedTokenSkipped = true
      console.warn(
        `[gitPush] 当前 Git 版本低于 ${GIT_CONFIG_ENV_MIN_MAJOR}.${GIT_CONFIG_ENV_MIN_MINOR}，`
        + `账号令牌凭据不会生效（${skippedCredentialHosts.join(", ")}）；提交身份仍生效，升级 Git 后自动恢复`,
      )
    }
    return Object.keys(env).length > 0 ? env : undefined
  }

  /** 探测 Git 是否支持 GIT_CONFIG_COUNT（≥2.31）；探测失败不缓存，下次网络操作重试 */
  private async ensureGitConfigEnvSupported(cwd: string): Promise<boolean> {
    if (this.gitConfigEnvSupported !== null) return this.gitConfigEnvSupported
    // 并发的网络命令共享同一次探测：先到的发起探测、后到的等结果。
    // 否则「推送所有待推送项目」这类并发场景下，探测期间启动的推送拿不到结论，
    // 会把令牌当「版本过低」静默跳过，回退到系统凭据 —— 可能用错账号推送且无任何报错。
    if (this.gitVersionProbe) return this.gitVersionProbe
    const probe = (async () => {
      this.gitVersionChecking = true
      try {
        const out = await this.executor.execGit(cwd, ["--version"])
        const match = out.match(/(\d+)\.(\d+)/)
        if (!match) return false
        const major = Number(match[1])
        const minor = Number(match[2])
        const supported = major > GIT_CONFIG_ENV_MIN_MAJOR
          || (major === GIT_CONFIG_ENV_MIN_MAJOR && minor >= GIT_CONFIG_ENV_MIN_MINOR)
        this.gitConfigEnvSupported = supported
        return supported
      } catch {
        return false
      } finally {
        this.gitVersionChecking = false
      }
    })()
    this.gitVersionProbe = probe
    try {
      return await probe
    } finally {
      if (this.gitVersionProbe === probe) this.gitVersionProbe = null
    }
  }

  /** 上次扫描导入使用的目录（空串 = 从未扫描过，弹窗保持占位符提示） */
  async getScanDir(): Promise<string> { return this.storage.scanDir.loadOrDefault() }

  /**
   * 记录本次扫描目录并持久化，供下次打开导入弹窗预填。
   * 注意是 `await` 而非 `return`：`TypedStorage.save` 返回 `Promise<boolean>`，
   * 直接 return 会让返回类型 `Promise<void>` 不匹配（保存失败无需向上传播）。
   */
  async setScanDir(dir: string): Promise<void> { await this.storage.scanDir.save(dir) }

  // ── 实时探测配置（三层：文件监听 / 工作区轮询 / 网络轮询）──

  /** 读取实时探测配置（逐字段钳位兜底，容忍旧版本或手改的存储内容） */
  async getProbeConfig(): Promise<ProbeConfig> {
    return clampProbeConfig(await this.storage.probeConfig.loadOrDefault())
  }

  /** 保存实时探测配置（归一化后落盘，保证内存与磁盘口径一致） */
  async setProbeConfig(config: Partial<ProbeConfig>): Promise<void> {
    await this.storage.probeConfig.save(clampProbeConfig(config))
  }

  cancelOp(id: string, action?: "push" | "pull"): void { return this.executor.cancelOp(id, action) }

  // ── 项目 / 分类 / 标签 CRUD（ProjectStore）──

  async getProjects(): Promise<GitProject[]> { return this.store.getProjects() }

  async getProjectById(id: string): Promise<GitProject | undefined> { return this.store.getProjectById(id) }

  invalidateProjectCache(): void { return this.store.invalidateProjectCache() }

  async addProject(name: string, path: string, categoryId?: string, tags?: string[], extras?: ProjectPathExtras): Promise<GitProject> {
    // 入库前路径校验：存在性 + 是目录 + 是 git 仓库（此前坏路径项目可静默入库，卡片呈"正常空态"假象）
    const nodeModules = getNodeFsPathOs()
    if (nodeModules) {
      const { fs } = nodeModules
      let isDir = false
      try { isDir = fs.existsSync(path) && fs.statSync(path).isDirectory() } catch { /* 视同不存在 */ }
      if (!isDir) throw new Error(`路径不存在或不是目录：${path}`)
    }
    if (!(await this.worktreeOps.checkIsGitRepo(path))) {
      throw new Error(`不是 Git 仓库（缺少 .git）：${path}`)
    }
    return this.store.addProject(name, path, categoryId, tags, extras)
  }

  async removeProject(id: string): Promise<void> {
    // 删除项目后清掉它的 gitdir 缓存与 Markdown 扫描缓存，避免已删项目条目常驻内存
    const project = await this.store.getProjectById(id)
    const paths = project ? [project.path, ...(project.localPaths || [])] : []
    await this.store.removeProject(id)
    // 项目删除后卡片消失，运行中的脚本会话将失去停止入口，必须一并结束
    scriptSessions.stopByProject(id)
    // 智能跳过缓存独立于 store，删除后一并失效，避免残留旧 ahead
    this.remoteOps.invalidatePushStatusCache(id)
    for (const p of paths) {
      this.invalidateGitDirCache(p)
      clearMarkdownScanCacheFor(p)
    }
  }

  async updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "path" | "tags" | "starred" | "archived" | "note" | "name" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths" | "pathDevices" | "pushProfileId">>): Promise<GitProject | null> {
    // 路径类字段变更后必须失效 gitdir 缓存：否则探测层会继续监听旧目录（最长 5 分钟 TTL）
    const pathFieldsChanged = patch.path !== undefined || patch.localPaths !== undefined
    const before = pathFieldsChanged ? await this.store.getProjectById(id) : undefined
    const updated = await this.store.updateProjectMeta(id, patch)
    if (pathFieldsChanged) {
      // 路径已变：旧路径算出的 ahead/behind 不可复用
      this.remoteOps.invalidatePushStatusCache(id)
      const paths = new Set<string>([
        ...(before ? [before.path, ...(before.localPaths || [])] : []),
        ...(updated ? [updated.path, ...(updated.localPaths || [])] : []),
        ...(patch.path ? [patch.path] : []),
        ...(patch.localPaths || []),
      ])
      for (const p of paths) {
        this.invalidateGitDirCache(p)
        clearMarkdownScanCacheFor(p)
      }
    }
    return updated
  }

  async toggleStar(id: string): Promise<GitProject | null> { return this.store.toggleStar(id) }

  async appendTag(id: string, tag: string): Promise<GitProject | null> { return this.store.appendTag(id, tag) }

  async removeTag(id: string, tag: string): Promise<GitProject | null> { return this.store.removeTag(id, tag) }

  async recordLastActivity(id: string, isoTime: string): Promise<void> { return this.store.recordLastActivity(id, isoTime) }

  async getAllTags(): Promise<string[]> { return this.store.getAllTags() }

  async refreshRemotes(id: string, path?: string): Promise<GitProject | null> {
    const updated = await this.store.refreshRemotes(id, path)
    // 远程名/平台归属可能已变，旧推送状态不再可信
    if (updated) this.remoteOps.invalidatePushStatusCache(id)
    return updated
  }

  async applyRemotes(id: string, remotes: GitRemoteInfo[]): Promise<GitProject | null> {
    const updated = await this.store.applyRemotes(id, remotes)
    if (updated) this.remoteOps.invalidatePushStatusCache(id)
    return updated
  }

  async detectRemotes(projectPath: string): Promise<GitRemoteInfo[]> { return this.store.detectRemotes(projectPath) }

  async getCategories(): Promise<ProjectCategory[]> { return this.store.getCategories() }

  async addCategory(name: string, color?: string): Promise<ProjectCategory> { return this.store.addCategory(name, color) }

  async updateCategory(id: string, data: Partial<Pick<ProjectCategory, "name" | "color">>): Promise<void> {
    return this.store.updateCategory(id, data)
  }

  async deleteCategory(id: string): Promise<void> { return this.store.deleteCategory(id) }

  async moveProject(projectId: string, categoryId: string): Promise<void> { return this.store.moveProject(projectId, categoryId) }

  // ── 远程网络操作（RemoteOps）──

  getPushBranchMode(): "all" | "head" { return this.remoteOps.getPushBranchMode() }

  async setPushBranchMode(mode: "all" | "head"): Promise<void> { return this.remoteOps.setPushBranchMode(mode) }

  async pushToAll(id: string): Promise<AllPlatformResult> { return this.remoteOps.pushToAll(id) }

  async forcePushToAll(id: string): Promise<AllPlatformResult> { return this.remoteOps.forcePushToAll(id) }

  async pullToAll(id: string): Promise<AllPlatformResult> { return this.remoteOps.pullToAll(id) }

  async pushSingle(id: string, target: PlatformKey): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    return this.remoteOps.pushSingle(id, target)
  }

  async pullSingle(id: string, target: PlatformKey): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    return this.remoteOps.pullSingle(id, target)
  }

  async fetchAllForProject(id: string, opts?: { timeoutMs?: number }): Promise<{ fetched: string[], errors: string[] }> {
    return this.remoteOps.fetchAllForProject(id, opts)
  }

  /**
   * 「需拉取」专用短路 fetch：按平台优先级逐个尝试。
   * 短路语义见 RemoteOps.fetchUntilMoved：确认**无需拉取**才停；需拉取则继续下一个平台。
   * 返回值含 fetch 失败/无法判定的平台数，供调用方做「部分项目查不到」提示。
   */
  async fetchUntilMoved(
    id: string,
    opts?: { timeoutMs?: number, signal?: AbortSignal },
  ): Promise<{ moved: boolean, attempted: number, failures: number, unknown: number }> {
    return this.remoteOps.fetchUntilMoved(id, opts)
  }

  /** 按路径 fetch 指定远程（--prune 可选，支持取消），供一致性分析使用 */
  async fetchRemoteAt(cwd: string, remoteName: string, opts?: { prune?: boolean, signal?: AbortSignal }): Promise<void> {
    return this.remoteOps.fetchRemoteAt(cwd, remoteName, opts)
  }

  /** 列出全部远程跟踪分支短名（如 origin/main），供一致性比对 */
  async getRemoteTrackingRefs(projectPath: string): Promise<string[]> {
    return this.worktreeOps.getRemoteTrackingRefs(projectPath)
  }

  /** 计算 localBranch 相对 remoteRef 的领先/落后提交数（左=remote→behind，右=local→ahead） */
  async countAheadBehind(projectPath: string, remoteRef: string, localBranch: string): Promise<{ ahead: number, behind: number }> {
    return this.worktreeOps.countAheadBehind(projectPath, remoteRef, localBranch)
  }

  /** 检查各远程推送状态（仅比对本地跟踪 ref，不发起网络请求；需 fetch 后重查请走远程刷新管线） */
  async checkPushStatus(id: string, opts?: { branch?: string }): Promise<PushStatusInfo> {
    return this.remoteOps.checkPushStatus(id, opts)
  }

  /** 失效推送状态缓存（commit 后调用，防止智能跳过误判） */
  invalidatePushStatusCache(id: string): void {
    this.remoteOps.invalidatePushStatusCache(id)
  }

  // ── 工作区本地操作（WorktreeOps；写操作经项目级写锁串行，防 index.lock 竞争）──

  async getWorkingTreeStatus(projectPath: string, opts?: { branch?: string, fastWhenClean?: boolean }): Promise<WorkingTreeInfo> {
    return this.worktreeOps.getWorkingTreeStatus(projectPath, opts)
  }

  /** 获取文件差异。`status` 为可选提示（如 "untracked"），命中时走单进程快速路径；缺省行为不变 */
  async getFileDiff(projectPath: string, file: string, staged = false, status?: string): Promise<string> {
    return this.worktreeOps.getFileDiff(projectPath, file, staged, status)
  }

  async stageFile(projectPath: string, file: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.stageFile(projectPath, file))
  }

  async stageAll(projectPath: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.stageAll(projectPath))
  }

  async unstageFile(projectPath: string, file: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.unstageFile(projectPath, file))
  }

  async unstageAll(projectPath: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.unstageAll(projectPath))
  }

  async discardFile(projectPath: string, file: string, staged: boolean, status: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.discardFile(projectPath, file, staged, status))
  }

  async commit(projectPath: string, message: string): Promise<string> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.commit(projectPath, message))
  }

  async switchBranch(projectPath: string, branch: string): Promise<string> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.switchBranch(projectPath, branch))
  }

  async stashSave(projectPath: string, message?: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.stashSave(projectPath, message))
  }

  async stashList(projectPath: string): Promise<StashEntry[]> { return this.worktreeOps.stashList(projectPath) }

  async stashPop(projectPath: string, index = 0): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.stashPop(projectPath, index))
  }

  async stashApply(projectPath: string, index = 0): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.stashApply(projectPath, index))
  }

  async stashDrop(projectPath: string, index = 0): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.worktreeOps.stashDrop(projectPath, index))
  }

  async getCommitLog(projectPath: string, count: number | "all" = 30): Promise<CommitLogEntry[]> {
    return this.worktreeOps.getCommitLog(projectPath, count)
  }

  /** 获取最近 N 条提交的变更规模（文件数/增删行数），供 LOG Tab 行悬停提示（批量单命令，失败返回空 Map） */
  async getCommitShortStats(projectPath: string, count: number | "all" = DEFAULT_LOG_LIMIT): Promise<Map<string, CommitStat>> {
    return this.worktreeOps.getCommitShortStats(projectPath, count)
  }

  /** 解析某次提交涉及的文件变更列表（提交日志行内查看提交文件用） */
  async getCommitFiles(projectPath: string, hash: string) {
    return this.worktreeOps.getCommitFiles(projectPath, hash)
  }

  /** 获取某次提交对指定文件的补丁（提交文件弹窗内点击查看修改差异用） */
  async getCommitFilePatch(projectPath: string, hash: string, filePath: string) {
    return this.worktreeOps.getCommitFilePatch(projectPath, hash, filePath)
  }

  async getBranches(projectPath: string): Promise<BranchInfo[]> { return this.worktreeOps.getBranches(projectPath) }

  async getBranch(projectPath: string): Promise<string> { return this.worktreeOps.getBranch(projectPath) }

  async getHeadHash(projectPath: string): Promise<string> { return this.worktreeOps.getHeadHash(projectPath) }

  async checkIsGitRepo(projectPath: string): Promise<boolean> { return this.worktreeOps.checkIsGitRepo(projectPath) }

  /** 解析 gitdir 绝对路径（.git 文件监听定位用；失败返回空串） */
  async getGitDir(projectPath: string): Promise<string> { return this.worktreeOps.getGitDir(projectPath) }

  /**
   * 带 5 分钟 TTL 缓存的 gitdir 解析（探测层建 .git 监听用）。
   *
   * 单次 `rev-parse --absolute-git-dir` ≈ 250ms 进程费；独立页签/浮动窗口重开时
   * 探测层会为全部项目重建监听，不缓存就每次重付 N 次进程。
   * 5 分钟与探测层的周期性重建同口径；失败结果不缓存（允许重试）。
   * 同 path 的在途请求共享同一 Promise：重建时 N 路并发调用只产生 1 次进程。
   */
  async getGitDirCached(projectPath: string): Promise<string> {
    if (this.destroyed) return ""
    const GIT_DIR_CACHE_TTL_MS = 5 * 60 * 1000
    const hit = this.gitDirCache.get(projectPath)
    if (hit && Date.now() - hit.at < GIT_DIR_CACHE_TTL_MS) return hit.dir
    const pending = this.gitDirPending.get(projectPath)
    if (pending) return pending
    const task = (async () => {
      try {
        const dir = await this.worktreeOps.getGitDir(projectPath)
        // 卸载竞态：destroy 期间的解析结果不再写入缓存
        if (dir && !this.destroyed) { this.gitDirCache.set(projectPath, {
          dir,
          at: Date.now(),
        })
        }
        return dir
      } finally {
        this.gitDirPending.delete(projectPath)
      }
    })()
    this.gitDirPending.set(projectPath, task)
    return task
  }

  /** 失效 gitdir 缓存（项目路径变更/删除后调用，避免监听落到旧目录） */
  invalidateGitDirCache(projectPath?: string): void {
    if (projectPath) this.gitDirCache.delete(projectPath)
    else this.gitDirCache.clear()
  }

  /** 仓库是否处于 rebase 中断状态（上次重写失败残留等，供修正弹窗给出准确提示） */
  async isInRebaseState(projectPath: string): Promise<boolean> { return this.worktreeOps.isInRebaseState(projectPath) }

  /** 是否 merge 提交（存在第二父；批量修正弹窗据此标记不可修正项） */
  async isMergeCommit(projectPath: string, hash: string): Promise<boolean> {
    return this.worktreeOps.isMergeCommit(projectPath, hash)
  }

  async rewriteCommitMessage(
    projectPath: string,
    hash: string,
    message: string,
    preserveDate = false,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    const result = await this.writeLock.runExclusive(projectPath, () =>
      this.worktreeOps.rewriteCommitMessage(projectPath, hash, message, preserveDate, onProgress))
    // 改写后失效推送状态缓存（D6：与 commit 路径语义一致；调用方仅持有 path，按 path 反查项目 id）
    void this.invalidatePushStatusCacheByPath(projectPath)
    return result
  }

  /** 按项目路径反查并失效推送状态缓存（rewriteCommitMessage 等只有 path 的调用方使用） */
  private async invalidatePushStatusCacheByPath(projectPath: string): Promise<void> {
    try {
      const projects = await this.store.getProjects()
      for (const p of projects) {
        if (p.path === projectPath || p.localPaths?.includes(projectPath)) {
          this.remoteOps.invalidatePushStatusCache(p.id)
        }
      }
    } catch { /* 缓存失效失败不影响主流程 */ }
  }

  /**
   * 删除指定历史提交（记录级删除、内容不变语义）：
   * 写锁串行 + 完成后失效推送状态缓存（与 rewriteCommitMessage 同模式）。
   */
  async dropCommit(projectPath: string, hash: string, onProgress?: (current: number, total: number) => void): Promise<string> {
    const result = await this.writeLock.runExclusive(projectPath, () =>
      this.worktreeOps.dropCommit(projectPath, hash, onProgress))
    // 历史重写后失效推送状态缓存（与 rewriteCommitMessage 语义一致）
    void this.invalidatePushStatusCacheByPath(projectPath)
    return result
  }

  /** 目标提交是否为当前 HEAD 的祖先（删除提交弹窗前置校验用；hash 支持短/完整） */
  async isAncestorOfHead(projectPath: string, hash: string): Promise<boolean> {
    return this.worktreeOps.isAncestorOfHead(projectPath, hash)
  }

  // ── 仓库元操作（RepoOps；写操作经项目级写锁串行）──

  async getTags(projectPath: string, limit = 10): Promise<TagInfo[]> { return this.repoOps.getTags(projectPath, limit) }

  async createTag(projectPath: string, name: string, message?: string, commitRef?: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.createTag(projectPath, name, message, commitRef))
  }

  async deleteTag(projectPath: string, name: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.deleteTag(projectPath, name))
  }

  async pushTag(projectPath: string, remoteName: string, tag: string): Promise<string> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.pushTag(projectPath, remoteName, tag))
  }

  async getRemoteTags(projectPath: string, remoteName: string): Promise<string[]> {
    return this.repoOps.getRemoteTags(projectPath, remoteName)
  }

  async hasConflict(projectPath: string): Promise<boolean> { return this.repoOps.hasConflict(projectPath) }

  async getConflictFiles(projectPath: string): Promise<ConflictFile[]> { return this.repoOps.getConflictFiles(projectPath) }

  async abortMerge(projectPath: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.abortMerge(projectPath))
  }

  async resolveConflictFile(projectPath: string, file: string, strategy: "theirs" | "ours"): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.resolveConflictFile(projectPath, file, strategy))
  }

  // remote/config 写操作写 .git/config，与本地写操作（commit/stash 等）包同一把项目写锁，消除并发写竞争窗口
  async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.addRemote(projectPath, name, url))
  }

  async removeRemote(projectPath: string, name: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.removeRemote(projectPath, name))
  }

  async renameRemote(projectPath: string, oldName: string, newName: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.renameRemote(projectPath, oldName, newName))
  }

  async getRemoteUrl(projectPath: string, name: string): Promise<string> { return this.repoOps.getRemoteUrl(projectPath, name) }

  async setRemoteUrl(projectPath: string, name: string, url: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.setRemoteUrl(projectPath, name, url))
  }

  async cloneRepo(parentDir: string, url: string, onOutput?: (chunk: string) => void): Promise<string> {
    return this.repoOps.cloneRepo(parentDir, url, onOutput)
  }

  /**
   * 克隆远程仓库到 parentDir，并把新路径并入项目。
   *
   * 与弹窗生命周期解耦：关闭编辑弹窗不中断克隆，结果也不会因弹窗卸载而丢失。
   * 路径以持久化数据为准追加（不覆盖弹窗内未保存的路径草稿），按主路径是否为空决定写入位置。
   * 克隆失败抛错；路径持久化失败不抛错，以 persisted=false 返回（克隆目录已存在，由调用方提示）。
   */
  async cloneRepoToProject(
    projectId: string,
    parentDir: string,
    url: string,
    onOutput?: (chunk: string) => void,
  ): Promise<{ path: string, persisted: boolean }> {
    const path = await this.repoOps.cloneRepo(parentDir, url, onOutput)
    const project = await this.store.getProjectById(projectId)
    if (!project) return { path, persisted: false }
    const existing = [project.path, ...(project.localPaths || [])].filter(Boolean)
    if (existing.includes(path)) return { path, persisted: true }
    const device = getCurrentDeviceName()
    const pathDevices = device
      ? { ...(project.pathDevices || {}), [path]: device }
      : project.pathDevices
    const patch = project.path
      ? { localPaths: [...(project.localPaths || []), path], pathDevices }
      : { path, pathDevices }
    const updated = await this.updateProjectMeta(projectId, patch)
    return { path, persisted: !!updated }
  }

  async getGitGlobalConfig(): Promise<string> { return this.repoOps.getGitGlobalConfig() }

  async setGitGlobalConfig(key: string, value: string): Promise<void> {
    return this.repoOps.setGitGlobalConfig(key, value)
  }

  async unsetGitGlobalConfig(key: string): Promise<void> {
    return this.repoOps.unsetGitGlobalConfig(key)
  }

  getGitConfigFilePath(): string { return this.repoOps.getGitConfigFilePath() }

  async getProjectGitConfig(projectPath: string): Promise<string> { return this.repoOps.getProjectGitConfig(projectPath) }

  async setProjectGitConfig(projectPath: string, key: string, value: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.setProjectGitConfig(projectPath, key, value))
  }

  async unsetProjectGitConfig(projectPath: string, key: string): Promise<void> {
    return this.writeLock.runExclusive(projectPath, () => this.repoOps.unsetProjectGitConfig(projectPath, key))
  }

  getProjectGitConfigFilePath(projectPath: string): string { return this.repoOps.getProjectGitConfigFilePath(projectPath) }

  async scanForGitRepos(dirPath: string): Promise<ScannedGitRepo[]> { return this.repoOps.scanForGitRepos(dirPath) }

  // ── AI 配置（统一入口 @/utils/aiApi，供卡片级 AI 分析弹窗读取超级面板设置）──

  getAiConfig(): AiApiConfig {
    return getApiConfigFromPlugin(this.plugin)
  }

  // ── AI 提交信息（CommitMsgGenerator）──

  async generateCommitMessage(projectPath: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    return this.commitMsgGen.generateCommitMessage(projectPath)
  }

  /** 深度生成提交信息：读取暂存区完整 diff 让 AI 生成「标题行 + 改动要点」多行信息 */
  async generateCommitMessageDeep(projectPath: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    return this.commitMsgGen.generateCommitMessageDeep(projectPath)
  }

  async generateCommitFix(projectPath: string, hash: string, currentMessage: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    return this.commitMsgGen.generateCommitFix(projectPath, hash, currentMessage)
  }

  /** 深度分析修正：基于完整 diff 让 AI 生成贴合实际改动的修正提交信息 */
  async deepAnalyzeCommitFix(projectPath: string, hash: string, currentMessage: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    return this.commitMsgGen.deepAnalyzeCommitFix(projectPath, hash, currentMessage)
  }

  /** 获取某次提交的完整原始提交信息（多行 body 原文，修正弹窗展示用） */
  async getCommitFullMessage(projectPath: string, hash: string): Promise<string> {
    return this.worktreeOps.getCommitFullMessage(projectPath, hash)
  }

  async generateStashDescription(projectPath: string): Promise<string> {
    return this.commitMsgGen.generateStashDescription(projectPath)
  }

  async getCommitTemplates(): Promise<CommitTemplate[]> { return this.commitMsgGen.getCommitTemplates() }

  async saveCommitTemplates(templates: CommitTemplate[]): Promise<void> {
    return this.commitMsgGen.saveCommitTemplates(templates)
  }

  // ── 代码统计报告（ReportOps：numstat 提交日志 + 首提交日期）──

  /** 获取 numstat 提交日志（供代码统计报告聚合；行数统计改用 getCommitStatsLog 单命令抓取；git 失败抛出错误） */
  async getNumstatLog(projectPath: string, since?: string, maxCount?: number): Promise<NumstatCommit[]> {
    return this.reportOps.getNumstatLog(projectPath, since, maxCount)
  }

  /** 获取带提交摘要的 numstat 日志（行数统计专用单命令抓取：hash/message/author/date + 每文件增删行；git 失败抛出错误） */
  async getCommitStatsLog(projectPath: string, maxCount?: number): Promise<NumstatCommit[]> {
    return this.reportOps.getCommitStatsLog(projectPath, maxCount)
  }

  /** 获取仓库已跟踪文件列表（git ls-files；行数统计「当前总行数」用；git 失败抛出错误） */
  async getTrackedFiles(projectPath: string): Promise<string[]> {
    return this.reportOps.getTrackedFiles(projectPath)
  }

  /** 获取文件最近 5 条提交的补丁内容（文件详情弹窗打开时按需懒取；since 限定统计范围；git 失败抛出错误） */
  async getFileHistoryPatch(projectPath: string, file: string, since?: string): Promise<string> {
    return this.reportOps.getFileHistoryPatch(projectPath, file, since)
  }

  // ── 索引驱动的统计抓取（本地提交索引：命中即零 git 扫描，未命中则增量补抓后落盘）──

  /**
   * 抓取项目的提交 numstat 数据（本地索引优先）。
   *
   * 三类结果（调用方据 `source` 区分数据新鲜度）：
   * - `index`   索引已覆盖请求范围 → 零 git 调用，直接返回
   * - `incremental` 本次增量补抓并已落盘 → 数据是最新的
   * - `git`     索引不可用/初始化失败 → 回退直接跑 git（行为与改造前一致）
   *
   * 每次调用都打印一行 `[gitPush][索引]` 日志（耗时 + 来源 + 扫描/复用条数），
   * 用于直接确认索引是否生效（不必靠手感判断快慢）；见 README「如何确认索引生效」。
   *
   * @param maxCount 仅取最近 N 条（与 git log -n 语义一致；0/undefined = 全部）
   * @param sinceDays 时间范围下界（相对天数，0 = 全部历史）
   * @param forceRebuild 忽略已有索引重新全量扫描（「重建索引」用）
   */
  async getIndexedCommitLog(
    project: GitProject,
    opts?: { maxCount?: number, sinceDays?: number, forceRebuild?: boolean },
  ): Promise<{ commits: NumstatCommit[], source: "index" | "incremental" | "git", complete: boolean }> {
    const startedAt = Date.now()
    const maxCount = opts?.maxCount ?? 0
    const sinceDays = opts?.sinceDays ?? 0
    const projectPath = resolveValidPath(project)
    const index = await this.getIndex()
    if (!index) {
      const commits = await this.reportOps.getCommitStatsLog(projectPath, maxCount || undefined)
      this.logIndexCall(project, "git", startedAt, commits.length, 0, 0)
      return {
        commits: this.sliceByDays(commits, sinceDays),
        source: "git",
        complete: true,
      }
    }

    const projectId = project.id
    // 相对天数 → 绝对毫秒下界（与索引侧同口径；0 = 不过滤）
    const sinceMs = sinceDays > 0 ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : 0
    try {
      const snapshot = await this.reportOps.getHeadSnapshot(projectPath)
      // 空仓库（无 HEAD）：索引无意义，直接返回空
      if (!snapshot.head) {
        this.logIndexCall(project, "index", startedAt, 0, 0, 0)
        return {
          commits: [],
          source: "index",
          complete: true,
        }
      }
      const rootHash = buildRootHash(snapshot.head, snapshot.gitDir)

      if (opts?.forceRebuild) await index.invalidate(projectId)
      await index.ensureLoaded(projectId)

      // 覆盖判定：rootHash 一致（HEAD 与仓库身份都没变）且索引深度满足本范围要求
      const meta = index.getProjectMeta(projectId)
      if (!opts?.forceRebuild && canSkipScan({
        rootHash,
        meta,
        sinceDays,
      })) {
        const hits = index.getLog(projectId, {
          maxCount,
          sinceMs,
        })
        this.logIndexCall(project, "index", startedAt, hits.length, 0, index.getCommitCount(projectId))
        return {
          commits: hits,
          source: "index",
          complete: true,
        }
      }

      // 增量补抓：knownHashes 仅在「仓库身份一致」时可用，否则必须全量重扫
      // （换机器/换仓库指向同一路径时 gitdir 不同，复用他仓库的 hash 集会导致漏抓）
      const sameRepo = !!meta && rootHashGitDir(meta.rootHash) === snapshot.gitDir
      const knownHashes = sameRepo && index.getCommitCount(projectId) > 0 ? index.getKnownHashes(projectId) : null
      const indexedBefore = index.getCommitCount(projectId)

      const scan = await this.reportOps.fetchIncremental(projectPath, knownHashes)
      const maxCommits = await this.getIndexMaxCommits()
      const coverageInput = {
        scanComplete: scan.complete,
        scannedCommits: scan.commits.length,
        indexedBefore,
        maxCommits,
        notIncremental: knownHashes === null,
      }
      const complete = isIndexComplete(coverageInput)

      await index.append(projectId, scan.commits, {
        rootHash,
        analyzedAt: new Date().toISOString(),
        complete,
        lastCommit: `${snapshot.lastAuthor}|${snapshot.lastDate}`,
        // 截断项目沿用既有覆盖范围，避免每次刷新都从历史根重扫（详见 indexCoverage.ts）
        sinceCoveredDays: nextCoveredDays(coverageInput, sameRepo, meta?.sinceCoveredDays),
      })
      await this.persistIndexMeta()
      const result = index.getLog(projectId, {
        maxCount,
        sinceMs,
      })
      this.logIndexCall(project, "incremental", startedAt, result.length, scan.commits.length, index.getCommitCount(projectId))
      return {
        commits: result,
        source: "incremental",
        complete,
      }
    } catch (e) {
      // 索引任何环节失败都不得影响功能：降级直接跑 git
      console.warn("[gitPush] 索引路径失败，本次回退直接扫描 git", e)
      const commits = await this.reportOps.getCommitStatsLog(projectPath, maxCount || undefined)
      const sliced = this.sliceByDays(commits, sinceDays)
      this.logIndexCall(project, "git(fallback)", startedAt, sliced.length, 0, 0)
      return {
        commits: sliced,
        source: "git",
        complete: true,
      }
    }
  }

  /**
   * 打印一次索引调用的来源与耗时。
   *
   * `source=index` 且 `新扫描=0` 即表示「完全复用了本地索引、没有跑 git log」——
   * 这是确认索引生效最直接的证据。耗时含 HEAD 快照（rev-parse）与索引读盘，
   * 与改造前「全量 git log --numstat」的耗时对比即收益。
   *
   * 用 console.warn 而非 console.info：仓库 lint 规则只允许 warn/error（no-console）。
   */
  private logIndexCall(
    project: GitProject,
    source: string,
    startedAt: number,
    returned: number,
    scanned: number,
    indexedTotal: number,
  ): void {
    console.warn(
      `[gitPush][索引] ${project.name} source=${source} 耗时=${Date.now() - startedAt}ms 返回=${returned} 条 新扫描=${scanned} 条 索引总量=${indexedTotal} 条`,
    )
  }

  /** 按「相对天数」过滤提交（与索引侧口径一致；0 = 不过滤） */
  private sliceByDays(commits: NumstatCommit[], sinceDays: number): NumstatCommit[] {
    if (sinceDays <= 0) return commits
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000
    return commits.filter((c) => {
      const t = Date.parse(c.date)
      return Number.isNaN(t) ? true : t >= cutoff
    })
  }

  // ── 仓库清理（RepoCleanOps：体检扫描 + BFG 六步工作流）──

  /** 仓库体检：.git 体积汇总 + 可达大文件 Top N（纯 git，只读） */
  async scanRepoObjects(projectPath: string, thresholdMb: number): Promise<RepoScanResult> {
    return this.repoCleanOps.scan(projectPath, thresholdMb)
  }

  /** BFG 运行时探测（Java + jar 就绪状态，供清理向导检查清单） */
  async getBfgRuntime(): Promise<BfgRuntimeState> {
    const java = await this.bfgOps.detectJava()
    const jar = await this.bfgOps.getJarState()
    return {
      javaOk: java.ok,
      javaVersion: java.version,
      javaPath: java.path,
      jarOk: jar.jarOk,
      jarPath: jar.jarPath,
    }
  }

  /** 下载 bfg.jar 到插件数据目录（主源失败切备源；进度回调 0~100） */
  async downloadBfgJar(onProgress?: (pct: number) => void): Promise<string> {
    return this.bfgOps.downloadJar(onProgress)
  }

  /** 创建项目 bundle 全量备份（BFG 清理/删除历史提交等破坏性操作前调用；复用 BFG 备份目录与 3 份轮换） */
  async createProjectBackup(projectPath: string): Promise<string> {
    return this.repoCleanOps.createBackup(projectPath)
  }

  /** 清空项目备份目录下全部 bundle 备份（删除历史提交弹窗内用户主动清理；返回清理份数） */
  async deleteProjectBackups(projectPath: string): Promise<number> {
    return this.repoCleanOps.deleteBackups(projectPath)
  }

  /** 获取项目备份目录路径（删除历史提交弹窗常驻操作条展示用） */
  async getProjectBackupDir(projectPath: string): Promise<string> {
    return this.repoCleanOps.backupDirOf(projectPath)
  }

  /**
   * BFG 清理执行（六步：备份→镜像→重写→压缩→回写）。
   * 写锁串行 + 完成后失效推送状态缓存（与 rewriteCommitMessage 同模式）。
   */
  async runBfgClean(
    projectPath: string,
    plan: BfgCleanPlan,
    callbacks: {
      onStep?: (step: RepoCleanStep, current: number, total: number) => void
      onOutput?: (chunk: string) => void
    } = {},
  ): Promise<BfgCleanResult> {
    const result = await this.writeLock.runExclusive(projectPath, () =>
      this.repoCleanOps.cleanRepo(projectPath, plan, callbacks))
    // 历史重写后失效推送状态缓存（D6：与 rewriteCommitMessage 语义一致）
    void this.invalidatePushStatusCacheByPath(projectPath)
    return result
  }

  /**
   * BFG 强推后收尾：fetch --prune 全部远程 + reflog 过期 + gc 物理清除本地残留
   * （远端仍存在的未重写分支不会被 prune，体检将以「远程引用」标注）
   */
  async finalizeBfgClean(
    projectPath: string,
    onOutput?: (chunk: string) => void,
  ): Promise<{ fetchErrors: { remote: string, error: string }[] }> {
    const result = await this.writeLock.runExclusive(projectPath, () =>
      this.repoCleanOps.finalizeBfgClean(projectPath, onOutput))
    // 远程跟踪引用已同步，推送状态缓存随之过期
    void this.invalidatePushStatusCacheByPath(projectPath)
    return result
  }
}
