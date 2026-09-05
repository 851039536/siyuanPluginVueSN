// Git 推送任务管理门面：组合各领域协作者（managers/），对外暴露统一 API
import type { Plugin } from "siyuan"
import {
  openTab,
  openWindow,
} from "siyuan"
import type { App } from "vue"
import {
  createApp,
  h,
} from "vue"
import type { AllPlatformResult } from "./managers/RemoteOps"
import type { NumstatCommit } from "./reportMetrics"
import type { BfgCleanPlan, BfgCleanResult, BfgRuntimeState, PlatformKey, RepoScanResult } from "./types/meta"
import type { RepoCleanStep } from "./managers/RepoCleanOps"
import type {
  BranchInfo,
  CommitLogEntry,
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
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { createVueDockApp } from "@/utils/vueAppHelper"
import GitPushPanel from "./index.vue"
import { CommitMsgGenerator } from "./managers/CommitMsgGenerator"
import { GitExecutor } from "./managers/GitExecutor"
import { ProjectStore } from "./managers/ProjectStore"
import { ProjectWriteLock } from "./managers/ProjectWriteLock"
import { RemoteOps } from "./managers/RemoteOps"
import { RepoOps } from "./managers/RepoOps"
import { ReportOps } from "./managers/ReportOps"
import { WorktreeOps } from "./managers/WorktreeOps"
import { GitPushStorage } from "./types/storage"
import { BfgOps } from "./managers/BfgOps"
import { RepoCleanOps } from "./managers/RepoCleanOps"

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

  async checkPushStatus(id: string, opts?: { branch?: string, fetchFirst?: boolean }): Promise<PushStatusInfo> {
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

  async getWorkingTreeStatus(projectPath: string, opts?: { branch?: string }): Promise<WorkingTreeInfo> {
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
      this.worktreeOps.rewriteCommitMessage(projectPath, hash, message, preserveDate, onProgress),
    )
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
      this.worktreeOps.dropCommit(projectPath, hash, onProgress),
    )
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

  async generateCommitFix(projectPath: string, hash: string, currentMessage: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    return this.commitMsgGen.generateCommitFix(projectPath, hash, currentMessage)
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
      this.repoCleanOps.cleanRepo(projectPath, plan, callbacks),
    )
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
      this.repoCleanOps.finalizeBfgClean(projectPath, onOutput),
    )
    // 远程跟踪引用已同步，推送状态缓存随之过期
    void this.invalidatePushStatusCacheByPath(projectPath)
    return result
  }
}
