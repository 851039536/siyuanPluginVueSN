// Git 推送任务管理门面：组合各领域协作者（managers/），对外暴露统一 API
import type { Plugin } from "siyuan"
import type {
  BranchInfo,
  CommitLogEntry,
  CommitTemplate,
  ConflictFile,
  GitProject,
  GitRemoteInfo,
  ProjectCategory,
  ProjectStatus,
  PushStatusInfo,
  ScannedGitRepo,
  StashEntry,
  TagInfo,
  WorkingTreeInfo,
} from "./types/storage"
import type { PlatformKey } from "./types/meta"
import { GitPushStorage } from "./types/storage"
import { createVueDockApp } from "@/utils/vueAppHelper"
import GitPushPanel from "./index.vue"
import { GitExecutor } from "./managers/GitExecutor"
import { ProjectStore } from "./managers/ProjectStore"
import { RemoteOps } from "./managers/RemoteOps"
import type { AllPlatformResult } from "./managers/RemoteOps"
import { WorktreeOps } from "./managers/WorktreeOps"
import { RepoOps } from "./managers/RepoOps"
import { CommitMsgGenerator } from "./managers/CommitMsgGenerator"

export class GitPushManager {
  private plugin: Plugin
  storage: GitPushStorage
  private executor: GitExecutor
  private store: ProjectStore
  private remoteOps: RemoteOps
  private worktreeOps: WorktreeOps
  private repoOps: RepoOps
  private commitMsgGen: CommitMsgGenerator

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GitPushStorage(plugin)
    this.executor = new GitExecutor(this.storage)
    this.store = new ProjectStore(this.storage, this.executor)
    this.remoteOps = new RemoteOps(this.executor, this.store, this.storage)
    this.worktreeOps = new WorktreeOps(this.executor)
    this.repoOps = new RepoOps(this.executor)
    this.commitMsgGen = new CommitMsgGenerator(plugin, this.executor, this.worktreeOps, this.storage)
  }

  async init() {
    await this.storage.init()
    await this.executor.loadGitConcurrency()
    await this.remoteOps.loadPushBranchMode()
    const pluginI18n = (this.plugin.i18n as Record<string, any>) || {}
    const i18n = pluginI18n.gitPush || pluginI18n

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
    this.executor.destroy()
  }

  // ── 执行器（并发上限 / 取消）──

  /** 外部只读：当前活跃 git 操作数 */
  get activeGitOps(): number { return this.executor.activeGitOps }

  getGitConcurrency(): number { return this.executor.getGitConcurrency() }

  async setGitConcurrency(n: number): Promise<void> { return this.executor.setGitConcurrency(n) }

  cancelOp(id: string, action?: "push" | "pull"): void { return this.executor.cancelOp(id, action) }

  // ── 项目 / 分类 / 标签 CRUD（ProjectStore）──

  async getProjects(): Promise<GitProject[]> { return this.store.getProjects() }

  async getProjectById(id: string): Promise<GitProject | undefined> { return this.store.getProjectById(id) }

  invalidateProjectCache(): void { return this.store.invalidateProjectCache() }

  async addProject(name: string, path: string, categoryId?: string, tags?: string[]): Promise<GitProject> {
    return this.store.addProject(name, path, categoryId, tags)
  }

  async removeProject(id: string): Promise<void> { return this.store.removeProject(id) }

  async updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "path" | "tags" | "starred" | "status" | "archived" | "note" | "name" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths">>): Promise<GitProject | null> {
    return this.store.updateProjectMeta(id, patch)
  }

  async toggleStar(id: string): Promise<GitProject | null> { return this.store.toggleStar(id) }

  async setProjectStatus(id: string, status: ProjectStatus): Promise<GitProject | null> {
    return this.store.setProjectStatus(id, status)
  }

  async appendTag(id: string, tag: string): Promise<GitProject | null> { return this.store.appendTag(id, tag) }

  async removeTag(id: string, tag: string): Promise<GitProject | null> { return this.store.removeTag(id, tag) }

  async recordLastActivity(id: string, isoTime: string): Promise<void> { return this.store.recordLastActivity(id, isoTime) }

  async getAllTags(): Promise<string[]> { return this.store.getAllTags() }

  async refreshRemotes(id: string): Promise<GitProject | null> { return this.store.refreshRemotes(id) }

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

  async checkPushStatus(id: string, opts?: { branch?: string, fetchFirst?: boolean }): Promise<PushStatusInfo> {
    return this.remoteOps.checkPushStatus(id, opts)
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

  // ── 工作区本地操作（WorktreeOps）──

  async getWorkingTreeStatus(projectPath: string, opts?: { skipRefresh?: boolean, branch?: string }): Promise<WorkingTreeInfo> {
    return this.worktreeOps.getWorkingTreeStatus(projectPath, opts)
  }

  async getFileDiff(projectPath: string, file: string, staged = false): Promise<string> {
    return this.worktreeOps.getFileDiff(projectPath, file, staged)
  }

  async stageFile(projectPath: string, file: string): Promise<void> { return this.worktreeOps.stageFile(projectPath, file) }

  async stageAll(projectPath: string): Promise<void> { return this.worktreeOps.stageAll(projectPath) }

  async unstageFile(projectPath: string, file: string): Promise<void> { return this.worktreeOps.unstageFile(projectPath, file) }

  async unstageAll(projectPath: string): Promise<void> { return this.worktreeOps.unstageAll(projectPath) }

  async discardFile(projectPath: string, file: string, staged: boolean, status: string): Promise<void> {
    return this.worktreeOps.discardFile(projectPath, file, staged, status)
  }

  async commit(projectPath: string, message: string): Promise<string> { return this.worktreeOps.commit(projectPath, message) }

  async switchBranch(projectPath: string, branch: string): Promise<string> { return this.worktreeOps.switchBranch(projectPath, branch) }

  async stashSave(projectPath: string, message?: string): Promise<void> { return this.worktreeOps.stashSave(projectPath, message) }

  async stashList(projectPath: string): Promise<StashEntry[]> { return this.worktreeOps.stashList(projectPath) }

  async stashPop(projectPath: string, index = 0): Promise<void> { return this.worktreeOps.stashPop(projectPath, index) }

  async stashApply(projectPath: string, index = 0): Promise<void> { return this.worktreeOps.stashApply(projectPath, index) }

  async stashDrop(projectPath: string, index = 0): Promise<void> { return this.worktreeOps.stashDrop(projectPath, index) }

  async getCommitLog(projectPath: string, count = 30): Promise<CommitLogEntry[]> {
    return this.worktreeOps.getCommitLog(projectPath, count)
  }

  async getBranches(projectPath: string): Promise<BranchInfo[]> { return this.worktreeOps.getBranches(projectPath) }

  async getBranch(projectPath: string): Promise<string> { return this.worktreeOps.getBranch(projectPath) }

  async getHeadHash(projectPath: string): Promise<string> { return this.worktreeOps.getHeadHash(projectPath) }

  async checkIsGitRepo(projectPath: string): Promise<boolean> { return this.worktreeOps.checkIsGitRepo(projectPath) }

  // ── 仓库元操作（RepoOps）──

  async getTags(projectPath: string, limit = 10): Promise<TagInfo[]> { return this.repoOps.getTags(projectPath, limit) }

  async createTag(projectPath: string, name: string, message?: string): Promise<void> {
    return this.repoOps.createTag(projectPath, name, message)
  }

  async deleteTag(projectPath: string, name: string): Promise<void> { return this.repoOps.deleteTag(projectPath, name) }

  async pushTag(projectPath: string, remoteName: string, tag: string): Promise<string> {
    return this.repoOps.pushTag(projectPath, remoteName, tag)
  }

  async hasConflict(projectPath: string): Promise<boolean> { return this.repoOps.hasConflict(projectPath) }

  async getConflictFiles(projectPath: string): Promise<ConflictFile[]> { return this.repoOps.getConflictFiles(projectPath) }

  async abortMerge(projectPath: string): Promise<void> { return this.repoOps.abortMerge(projectPath) }

  async resolveConflictFile(projectPath: string, file: string, strategy: "theirs" | "ours"): Promise<void> {
    return this.repoOps.resolveConflictFile(projectPath, file, strategy)
  }

  async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    return this.repoOps.addRemote(projectPath, name, url)
  }

  async removeRemote(projectPath: string, name: string): Promise<void> { return this.repoOps.removeRemote(projectPath, name) }

  async renameRemote(projectPath: string, oldName: string, newName: string): Promise<void> {
    return this.repoOps.renameRemote(projectPath, oldName, newName)
  }

  async getRemoteUrl(projectPath: string, name: string): Promise<string> { return this.repoOps.getRemoteUrl(projectPath, name) }

  async setRemoteUrl(projectPath: string, name: string, url: string): Promise<void> {
    return this.repoOps.setRemoteUrl(projectPath, name, url)
  }

  async getGitGlobalConfig(): Promise<string> { return this.repoOps.getGitGlobalConfig() }

  getGitConfigFilePath(): string { return this.repoOps.getGitConfigFilePath() }

  async getProjectGitConfig(projectPath: string): Promise<string> { return this.repoOps.getProjectGitConfig(projectPath) }

  getProjectGitConfigFilePath(projectPath: string): string { return this.repoOps.getProjectGitConfigFilePath(projectPath) }

  async openGitConfigFile(): Promise<boolean> { return this.repoOps.openGitConfigFile() }

  async scanForGitRepos(dirPath: string): Promise<ScannedGitRepo[]> { return this.repoOps.scanForGitRepos(dirPath) }

  // ── AI 提交信息（CommitMsgGenerator）──

  async generateCommitMessage(projectPath: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    return this.commitMsgGen.generateCommitMessage(projectPath)
  }

  async generateStashDescription(projectPath: string): Promise<string> {
    return this.commitMsgGen.generateStashDescription(projectPath)
  }

  async getCommitTemplates(): Promise<CommitTemplate[]> { return this.commitMsgGen.getCommitTemplates() }

  async saveCommitTemplates(templates: CommitTemplate[]): Promise<void> {
    return this.commitMsgGen.saveCommitTemplates(templates)
  }
}
