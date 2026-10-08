// Git 推送任务管理门面：组合各领域协作者（managers/），对外暴露统一 API
import type { Plugin } from "siyuan"
import type { App } from "vue"
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
import { ProjectStore } from "./managers/ProjectStore"
import { ProjectWriteLock } from "./managers/ProjectWriteLock"
import { RemoteOps } from "./managers/RemoteOps"
import { RepoCleanOps } from "./managers/RepoCleanOps"
import { RepoOps } from "./managers/RepoOps"
import { ReportOps } from "./managers/ReportOps"
import { WorktreeOps } from "./managers/WorktreeOps"
import {
  clampIndexMaxCommits,
  INDEX_META_VERSION,
} from "./types/indexCache"
import { GitPushStorage } from "./types/storage"
import {
  DEFAULT_LOG_LIMIT,
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
   * 本地提交索引（延迟构造：目录解析需 await 工作空间路径，而构造函数不能是 async）。
   * null = 尚未初始化或索引不可用（此时全部统计路径回退到直接跑 git）。
   */
  private commitIndex: CommitIndex | null = null
  /** 索引初始化 Promise（并发调用共享同一次初始化，失败只告警一次） */
  private indexInit: Promise<CommitIndex | null> | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GitPushStorage(plugin)
    this.executor = new GitExecutor(this.storage)
    this.store = new ProjectStore(this.storage, this.executor)
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
    // 初始化失败（null）不保留缓存，允许后续调用重新尝试；成功则保持缓存复用
    if (!index && this.indexInit === init) this.indexInit = null
    this.commitIndex = index
    return index
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
    await this.storage.init()
    await this.executor.loadGitConcurrency()
    await this.executor.loadNetworkTimeout()
    await this.remoteOps.loadPushBranchMode()
    const i18n = this.getPanelI18n()

    createVueDockApp(this.plugin, GitPushPanel, {
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

  destroy() {
    this.writeLock.destroy()
    this.executor.destroy()
    this.unmountTabPanel()
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

  async removeProject(id: string): Promise<void> { return this.store.removeProject(id) }

  async updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "path" | "tags" | "starred" | "archived" | "note" | "name" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths" | "pathDevices">>): Promise<GitProject | null> {
    return this.store.updateProjectMeta(id, patch)
  }

  async toggleStar(id: string): Promise<GitProject | null> { return this.store.toggleStar(id) }

  async appendTag(id: string, tag: string): Promise<GitProject | null> { return this.store.appendTag(id, tag) }

  async removeTag(id: string, tag: string): Promise<GitProject | null> { return this.store.removeTag(id, tag) }

  async recordLastActivity(id: string, isoTime: string): Promise<void> { return this.store.recordLastActivity(id, isoTime) }

  async getAllTags(): Promise<string[]> { return this.store.getAllTags() }

  async refreshRemotes(id: string, path?: string): Promise<GitProject | null> { return this.store.refreshRemotes(id, path) }

  async applyRemotes(id: string, remotes: GitRemoteInfo[]): Promise<GitProject | null> { return this.store.applyRemotes(id, remotes) }

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

  async fetchAllForProject(id: string): Promise<{ fetched: string[], errors: string[] }> {
    return this.remoteOps.fetchAllForProject(id)
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

  async checkCanPushToCloud(id: string): Promise<{
    canPush: boolean
    github: boolean
    gitee: boolean
    gitea: boolean
    cnb: boolean
    remotes: GitRemoteInfo[]
  }> {
    return this.remoteOps.checkCanPushToCloud(id)
  }

  // ── 工作区本地操作（WorktreeOps；写操作经项目级写锁串行，防 index.lock 竞争）──

  async getWorkingTreeStatus(projectPath: string, opts?: { branch?: string, fastWhenClean?: boolean }): Promise<WorkingTreeInfo> {
    return this.worktreeOps.getWorkingTreeStatus(projectPath, opts)
  }

  async getFileDiff(projectPath: string, file: string, staged = false): Promise<string> {
    return this.worktreeOps.getFileDiff(projectPath, file, staged)
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

  /** 获取仓库首个提交日期（ISO，无提交/失败返回空串） */
  async getFirstCommitDate(projectPath: string): Promise<string> {
    return this.reportOps.getFirstCommitDate(projectPath)
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

  /**
   * 抓取项目的已跟踪文件存量行数（索引优先：HEAD 未变时零 IO）。
   * 命中时不跑 `git ls-files`、也不逐文件读盘——行数统计里最贵的一环。
   * 打印 `[gitPush][索引] ... filelines=hit|scan` 日志便于确认。
   */
  async getIndexedFileLines(
    project: GitProject,
  ): Promise<{ rootHash: string, lines: Map<string, number | null> } | null> {
    const startedAt = Date.now()
    const projectPath = resolveValidPath(project)
    const index = await this.getIndex()
    if (!index) return null
    try {
      const snapshot = await this.reportOps.getHeadSnapshot(projectPath)
      if (!snapshot.head) { return {
        rootHash: "",
        lines: new Map(),
      }
      }
      const rootHash = buildRootHash(snapshot.head, snapshot.gitDir)
      const cached = await index.loadFileLines(project.id, rootHash)
      if (cached) {
        console.warn(
          `[gitPush][索引] ${project.name} filelines=hit 耗时=${Date.now() - startedAt}ms 文件数=${cached.size}`,
        )
        return {
          rootHash,
          lines: cached,
        }
      }
      const rows = await this.reportOps.getTrackedFileLines(projectPath, rootHash)
      const lines = new Map<string, number | null>()
      for (const row of rows) lines.set(row.f, row.n)
      await index.setFileLines(project.id, rootHash, lines)
      console.warn(
        `[gitPush][索引] ${project.name} filelines=scan 耗时=${Date.now() - startedAt}ms 文件数=${lines.size}`,
      )
      return {
        rootHash,
        lines,
      }
    } catch (e) {
      console.warn("[gitPush] 文件存量行数索引读写失败，回退直接扫描", e)
      return null
    }
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
