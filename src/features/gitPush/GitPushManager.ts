// Git 推送任务管理与同步调度
import type { Plugin } from "siyuan"
import type {
  BranchInfo,
  CommitLogEntry,
  CommitTemplate,
  ConflictFile,
  FileChange,
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
import type { PlatformKey } from "./types"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import {
  getNodeFsPathOs,
  getNodeProcessModules,
} from "@/utils/nodeModules"
import { createVueDockApp } from "@/utils/vueAppHelper"
import GitPushPanel from "./index.vue"
import {
  COMMIT_TYPE_VALUES,
  GitPushStorage,
} from "./types/storage"
import { PLATFORM_META } from "./types"
import { resolveValidPath } from "./utils"

/** 远程操作结果 */
interface RemoteOpResult {
  ok: boolean
  stdout: string
  stderr: string
  skipped?: boolean
}

/** 全平台操作结果类型 */
interface AllPlatformResult {
  success: boolean
  github: RemoteOpResult
  gitee: RemoteOpResult
  gitea: RemoteOpResult
  cnb: RemoteOpResult
}

export class GitPushManager {
  private plugin: Plugin
  storage: GitPushStorage
  /** 当前正在执行的 git 子进程数 */
  private gitRunning = 0
  /** 外部只读：当前活跃 git 操作数 */
  get activeGitOps(): number { return this.gitRunning }
  /** 最大并发 git 子进程数（从存储加载，可通过 setGitConcurrency 修改） */
  private gitMaxConcurrent = 3
  /** 等待队列 */
  private gitWaitQueue: (() => void)[] = []
  /** 记录当前正在执行的子进程引用（用于取消操作时 kill） */
  private activeProcesses: Set<any> = new Set()
  /** 项目 push/pull 的 AbortController 映射 */
  private abortControllers: Map<string, AbortController> = new Map()
  /** 推送分支模式：all=全部分支, head=仅当前分支 */
  private pushBranchMode: "all" | "head" = "all"
  /** 推送状态缓存（用于智能跳过） */
  private pushStatusCache: Record<string, PushStatusInfo> = {}

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GitPushStorage(plugin)
  }

  /** 获取当前 git 并发上限 */
  getGitConcurrency(): number {
    return this.gitMaxConcurrent
  }

  /** 设置 git 并发上限并持久化 */
  async setGitConcurrency(n: number): Promise<void> {
    const clamped = Math.max(1, Math.min(10, n))
    this.gitMaxConcurrent = clamped
    await this.storage.gitConcurrency.save(clamped)
  }

  /** 获取推送分支模式 */
  getPushBranchMode(): "all" | "head" {
    return this.pushBranchMode
  }

  /** 设置推送分支模式并持久化 */
  async setPushBranchMode(mode: "all" | "head"): Promise<void> {
    this.pushBranchMode = mode
    await this.storage.pushBranchMode.save(mode)
  }

  /** 获取 child_process 模块（简写） */
  private getProcess() {
    return getNodeProcessModules()?.child_process
  }

  /** 将检测到的远程仓库信息应用到项目对象（批量赋值避免逐字段触发响应式） */
  private applyRemotesToProject(project: GitProject, remotes: GitRemoteInfo[]) {
    // 仅设置检测到的字段，不重置已有值（跨电脑场景下 git remote 未配置时已有 URL 不丢失）
    const patch: Partial<GitProject> = {}
    for (const r of remotes) {
      if (r.isGithub) { patch.githubRemote = r.name; patch.githubUrl = r.url }
      if (r.isGitee) { patch.giteeRemote = r.name; patch.giteeUrl = r.url }
      if (r.isGitea) { patch.giteaRemote = r.name; patch.giteaUrl = r.url }
      if (r.isCnb) { patch.cnbRemote = r.name; patch.cnbUrl = r.url }
    }
    if (Object.keys(patch).length > 0) {
      Object.assign(project, patch)
    }
  }

  async init() {
    await this.storage.init()
    this.gitMaxConcurrent = await this.storage.gitConcurrency.loadOrDefault()
    this.pushBranchMode = await this.storage.pushBranchMode.loadOrDefault()
    const i18n = (this.plugin.i18n as any)?.gitPush || {}

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

  /**
   * 获取所有已保存的项目
   */
  async getProjects(): Promise<GitProject[]> {
    return this.storage.projects.loadOrDefault()
  }

  /**
   * 添加项目映射
   */
  async addProject(name: string, path: string, categoryId = "__ungrouped__", tags?: string[]): Promise<GitProject> {
    const projects = await this.getProjects()
    const project: GitProject = {
      id: Date.now().toString(),
      name,
      path,
      categoryId,
      addedAt: Date.now(),
      tags: tags && tags.length > 0 ? tags : undefined,
      status: "active",
      archived: false,
      starred: false,
    }
    this.applyRemotesToProject(project, await this.detectRemotes(path))
    projects.push(project)
    await this.storage.projects.save(projects)
    if (tags && tags.length > 0) await this.syncGlobalTags()
    return project
  }

  /**
   * 删除项目映射
   */
  async removeProject(id: string): Promise<void> {
    const projects = await this.getProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx !== -1) {
      projects.splice(idx, 1)
      await this.storage.projects.save(projects)
      await this.syncGlobalTags()
    }
  }

  /**
   * 更新项目元信息
   */
  async updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "path" | "tags" | "starred" | "status" | "archived" | "note" | "name" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths">>): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    Object.assign(project, patch)
    await this.storage.projects.save(projects)
    if (patch.tags !== undefined) await this.syncGlobalTags()
    return project
  }

  /** 切换收藏状态 */
  async toggleStar(id: string): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    project.starred = !project.starred
    await this.storage.projects.save(projects)
    return project
  }

  /** 设置项目状态徽章 */
  async setProjectStatus(id: string, status: ProjectStatus): Promise<GitProject | null> {
    return this.updateProjectMeta(id, { status })
  }

  /** 添加标签（去重） */
  async appendTag(id: string, tag: string): Promise<GitProject | null> {
    const t = tag.trim()
    if (!t) return null
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    const tags = project.tags || []
    if (!tags.includes(t)) {
      project.tags = [...tags, t]
      await this.storage.projects.save(projects)
      await this.syncGlobalTags()
    }
    return project
  }

  /** 移除标签 */
  async removeTag(id: string, tag: string): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    if (project.tags) {
      project.tags = project.tags.filter((t) => t !== tag)
      if (project.tags.length === 0) project.tags = undefined
      await this.storage.projects.save(projects)
      await this.syncGlobalTags()
    }
    return project
  }

  /** 记录最后活动时间 */
  async recordLastActivity(id: string, isoTime: string): Promise<void> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project || project.lastActivity === isoTime) return
    project.lastActivity = isoTime
    await this.storage.projects.save(projects)
  }

  /** 同步全局标签缓存 */
  private async syncGlobalTags(): Promise<void> {
    const projects = await this.getProjects()
    const set = new Set<string>()
    for (const p of projects) {
      if (p.tags) { for (const t of p.tags) { if (t) set.add(t) } }
    }
    await this.storage.tags.save([...set].sort())
  }

  /** 读取全局标签缓存 */
  async getAllTags(): Promise<string[]> {
    return this.storage.tags.loadOrDefault()
  }

  /** 重新检测项目远程仓库并更新 */
  async refreshRemotes(id: string): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    this.applyRemotesToProject(project, await this.detectRemotes(resolveValidPath(project)))
    await this.storage.projects.save(projects)
    return project
  }

  /** 判断远程仓库是否为已知平台 */
  private isKnownRemote(remote: GitRemoteInfo, platform: PlatformKey): boolean {
    if (platform === "github") return remote.isGithub
    if (platform === "gitee") return remote.isGitee
    if (platform === "cnb") return remote.isCnb
    return remote.isGitea
  }

  /** 获取项目的远程名称（按平台类型） */
  private getRemoteName(project: GitProject, target: PlatformKey): string {
    switch (target) {
      case "github": return project.githubRemote || "github"
      case "gitee": return project.giteeRemote || "gitee"
      case "cnb": return project.cnbRemote || "cnb"
      default: return project.giteaRemote || "gitea"
    }
  }

  /**
   * 检测项目目录下所有 git 远程仓库
   */
  async detectRemotes(projectPath: string): Promise<GitRemoteInfo[]> {
    try {
      const remotes = await this.execGit(projectPath, ["remote", "-v"])
      if (!remotes) return []

      const result: GitRemoteInfo[] = []
      const lines = remotes.trim().split("\n").filter(Boolean)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2 && parts[1]) {
          const name = parts[0]
          const url = parts[1]
          if (line.includes("(fetch)")) {
            const lowerUrl = url.toLowerCase()
            const lowerName = name.toLowerCase()
            const isGithub = lowerUrl.includes("github.com") || lowerName === "github"
            const isGitee = lowerUrl.includes("gitee.com") || lowerUrl.includes("gitcode.com") || lowerName === "gitee"
            const isCnb = lowerUrl.includes("cnb.cool") || lowerName === "cnb"
            result.push({
              name,
              url,
              isGithub,
              isGitee,
              isCnb,
              isGitea: !isGithub && !isGitee && !isCnb,
            })
          }
        }
      }
      return result
    } catch {
      return []
    }
  }

  /** 推送操作的单个远程结果（已跳过） */
  private static readonly skippedResult: RemoteOpResult = {
    ok: false,
    stdout: "",
    stderr: "",
    skipped: true,
  }

  /** 通用远程操作辅助函数（push/pull 共用，含失败重试） */
  private async tryRemoteOp(
    projectPath: string,
    remoteName: string | undefined,
    action: "push" | "pull",
    signal?: AbortSignal,
  ): Promise<RemoteOpResult> {
    if (!remoteName) return GitPushManager.skippedResult

    let args: string[]
    if (action === "push") {
      args = this.pushBranchMode === "head"
        ? ["push", remoteName, "HEAD"]
        : ["push", remoteName, "--all"]
    } else {
      args = ["pull", remoteName, "--ff-only"]
    }

    const tryExec = async (): Promise<RemoteOpResult> => {
      try {
        const stdout = await this.execGit(projectPath, args, signal)
        return { ok: true, stdout: stdout || "", stderr: "" }
      } catch (e: any) {
        const msg = e?.message || String(e)
        // 判断是否为网络类错误（可重试）
        const isNetworkErr = /(could not resolve|timed out|connection refused|connection reset|unable to access|early EOF|RPC failed|fetch first)/i.test(msg)
        if (!isNetworkErr) {
          return { ok: false, stdout: "", stderr: msg }
        }
        // 重试 1 次（1s 延迟）
        if (signal?.aborted) {
          return { ok: false, stdout: "", stderr: "操作已取消" }
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 1000)
          const onAbort = () => {
            clearTimeout(timer)
            reject(new Error("操作已取消"))
          }
          if (signal) { signal.addEventListener("abort", onAbort, { once: true }) }
        }).catch(() => {})
        if (signal?.aborted) {
          return { ok: false, stdout: "", stderr: "操作已取消" }
        }
        try {
          const stdout = await this.execGit(projectPath, args, signal)
          return { ok: true, stdout: stdout || "", stderr: "" }
        } catch (e2: any) {
          return { ok: false, stdout: "", stderr: e2?.message || String(e2) }
        }
      }
    }

    return tryExec()
  }

  /** "项目未找到" 错误结果模板 */
  private get notFoundResult(): AllPlatformResult {
    const err: RemoteOpResult = { ok: false, stdout: "", stderr: "项目未找到" }
    return {
      success: false,
      github: err,
      gitee: err,
      gitea: err,
      cnb: err,
    }
  }

  /**
   * 推送到全部已配置的远程
   */
  async pushToAll(id: string): Promise<AllPlatformResult> {
    return this.remoteOpAll(id, "push")
  }

  /**
   * 从全部已配置远程拉取
   */
  async pullToAll(id: string): Promise<AllPlatformResult> {
    return this.remoteOpAll(id, "pull")
  }

  /** 全平台 push/pull 通用实现（并行 + 智能跳过） */
  private async remoteOpAll(id: string, action: "push" | "pull"): Promise<AllPlatformResult> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return this.notFoundResult

    const cwd = resolveValidPath(project)

    // 智能跳过：推送前检查缓存，跳过 ahead===0 的远程
    const cachedStatus = this.pushStatusCache[id]
    function shouldSkip(key: PlatformKey): boolean {
      if (action !== "push") return false
      if (!cachedStatus) return false
      const rs = cachedStatus.remotes[key]
      if (!rs) return false
      return rs.ahead === 0 && !rs.noUpstream
    }

    // 设置 AbortController
    const ac = new AbortController()
    this.abortControllers.set(id, ac)

    try {
      // 智能跳过的静态结果
      const skippedResults: Record<string, RemoteOpResult> = {}
      const entries: { key: PlatformKey, remoteName: string | undefined }[] = []
      for (const pm of PLATFORM_META) {
        const remoteName = project[pm.remoteProp]
        if (!remoteName) {
          skippedResults[pm.key] = GitPushManager.skippedResult
        } else if (shouldSkip(pm.key)) {
          skippedResults[pm.key] = { ok: true, stdout: "已同步（跳过）", stderr: "", skipped: true }
        } else {
          entries.push({ key: pm.key, remoteName: remoteName as string })
        }
      }

      const results = await Promise.allSettled(
        entries.map(({ key, remoteName }) =>
          this.tryRemoteOp(cwd, remoteName, action, ac.signal).then((r) => ({ key, ...r })),
        ),
      )

      const build = (key: PlatformKey): RemoteOpResult => {
        // 优先返回跳过结果
        if (skippedResults[key]) return skippedResults[key]
        const entry = results.find(
          (r) => r.status === "fulfilled" && r.value.key === key,
        )
        if (entry && entry.status === "fulfilled") {
          const { key: _, ...rest } = entry.value
          return rest
        }
        // 未配置 → skipped；已配置但 rejected → 错误
        const wasConfigured = entries.some((e) => e.key === key)
        if (!wasConfigured) return GitPushManager.skippedResult
        const rej = results.find(
          (r) => r.status === "rejected",
        )
        return {
          ok: false,
          stdout: "",
          stderr: rej && rej.status === "rejected" ? String(rej.reason?.message || rej.reason || "未知错误") : "未知错误",
        }
      }

      const github = build("github")
      const gitee = build("gitee")
      const gitea = build("gitea")
      const cnb = build("cnb")

      return {
        success: github.ok || gitee.ok || gitea.ok || cnb.ok,
        github,
        gitee,
        gitea,
        cnb,
      }
    } finally {
      this.abortControllers.delete(id)
    }
  }

  /**
   * 推送到单个远程仓库
   */
  async pushSingle(
    id: string,
    target: PlatformKey,
  ): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    return this.remoteOpSingle(id, target, "push")
  }

  /**
   * 从单个远程仓库拉取
   */
  async pullSingle(
    id: string,
    target: PlatformKey,
  ): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    return this.remoteOpSingle(id, target, "pull")
  }

  /** 单平台 push/pull 通用实现 */
  private async remoteOpSingle(
    id: string,
    target: PlatformKey,
    action: "push" | "pull",
  ): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) {
      return { ok: false, stdout: "", stderr: "项目未找到" }
    }

    const cwd = resolveValidPath(project)
    const remoteName = this.getRemoteName(project, target)
    const ac = new AbortController()
    this.abortControllers.set(id, ac)
    try {
      const result = await this.tryRemoteOp(cwd, remoteName, action, ac.signal)
      return {
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
      }
    } finally {
      this.abortControllers.delete(id)
    }
  }

  /**
   * 取消正在进行的推送/拉取操作
   */
  cancelOp(id: string): void {
    const ac = this.abortControllers.get(id)
    if (ac) {
      ac.abort()
      this.abortControllers.delete(id)
    }
  }

  /**
   * Fetch 单个远程（仅更新远程跟踪分支，不合并代码）
   */
  private async fetchRemote(cwd: string, remoteName: string): Promise<string> {
    return await this.execGit(cwd, ["fetch", remoteName])
  }

  /**
   * Fetch 项目所有已配置远程，仅更新跟踪分支不合并代码
   */
  async fetchAllForProject(id: string): Promise<{ fetched: string[]; errors: string[] }> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return { fetched: [], errors: [] }

    const cwd = resolveValidPath(project)
    const remotesToFetch: string[] = []
    for (const pm of PLATFORM_META) {
      const name = project[pm.remoteProp] as string | undefined
      if (name) remotesToFetch.push(name)
    }

    if (remotesToFetch.length === 0) {
      return { fetched: [], errors: [] }
    }

    const fetched: string[] = []
    const errors: string[] = []
    const results = await Promise.allSettled(
      remotesToFetch.map((name) => this.fetchRemote(cwd, name).then(() => name)),
    )

    for (const r of results) {
      if (r.status === "fulfilled") { fetched.push(r.value) }
      else { errors.push(r.reason?.message || String(r.reason)) }
    }

    return { fetched, errors }
  }

  /**
   * 检查项目各远程的推送状态
   * @param opts.fetchFirst 是否先 fetch 远程再检查（默认 false，手动刷新时传 true）
   */
  async checkPushStatus(id: string, opts?: { branch?: string; fetchFirst?: boolean }): Promise<PushStatusInfo> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    const emptyResult: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    if (!project) return emptyResult

    const cwd = resolveValidPath(project)

    const status: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    try {
      status.branch = opts?.branch ?? await this.execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return emptyResult
    }

    // 如果指定 fetchFirst，先并行 fetch 所有已配置远程以更新跟踪分支
    if (opts?.fetchFirst) {
      await this.fetchAllForProject(id)
    }

    // 由 PLATFORM_META 驱动检查
    const remotesToCheck: { key: string, remoteName: string }[] = []
    for (const pm of PLATFORM_META) {
      const name = project[pm.remoteProp]
      if (name) { remotesToCheck.push({ key: pm.key, remoteName: name as string }) }
    }

    const remoteChecks = remotesToCheck.map(async ({ key, remoteName }) => {
      try {
        await this.execGit(cwd, ["rev-parse", "--verify", `${remoteName}/${status.branch}`])

        const counts = await this.execGit(cwd, [
          "rev-list", "--left-right", "--count",
          `${remoteName}/${status.branch}...HEAD`,
        ])
        const parts = counts.split("\t")
        const behind = Number.parseInt(parts[0] || "0", 10)
        const ahead = Number.parseInt(parts[1] || "0", 10)

        return { key, result: { ahead, behind, noUpstream: false }, ahead }
      } catch {
        const totalCommits = await this.execGit(cwd, ["rev-list", "--count", "HEAD"]).catch(() => "0")
        const ahead = Number.parseInt(totalCommits, 10) || 0
        return { key, result: { ahead, behind: 0, noUpstream: true }, ahead }
      }
    })

    const results = await Promise.all(remoteChecks)
    for (const { key, result, ahead } of results) {
      status.remotes[key] = result
      if (ahead > 0) status.needsPush = true
    }

    // 缓存用于智能跳过
    this.pushStatusCache[id] = status
    return status
  }

  /**
   * 获取当前分支最近 N 条提交记录
   */
  async getCommitLog(projectPath: string, count = 5): Promise<CommitLogEntry[]> {
    try {
      const format = "%h%n%s%n%an%n%ar%n%aI"
      const raw = await this.execGit(projectPath, ["log", `-${count}`, `--format=${format}`])
      if (!raw) return []

      const allLines = raw.split("\n")
      const entries: CommitLogEntry[] = []
      for (let i = 0; i + 4 < allLines.length; i += 5) {
        entries.push({
          hash: allLines[i],
          message: allLines[i + 1],
          author: allLines[i + 2],
          relativeDate: allLines[i + 3],
          date: allLines[i + 4],
        })
      }
      return entries
    } catch {
      return []
    }
  }

  /**
   * 获取本地分支列表
   */
  async getBranches(projectPath: string): Promise<BranchInfo[]> {
    try {
      const raw = await this.execGit(projectPath, ["branch", "--format=%(refname:short)%00%(HEAD)"])
      if (!raw) return []
      return raw.split("\n").filter(Boolean).map((line) => {
        const [name, head] = line.split("\0")
        return { name, current: head === "*" }
      })
    } catch {
      return []
    }
  }

  /**
   * 切换分支
   */
  async switchBranch(projectPath: string, branch: string): Promise<string> {
    const wtInfo = await this.getWorkingTreeStatus(projectPath)
    if (wtInfo.hasChanges) {
      throw new Error(
        `工作区有 ${wtInfo.stagedCount + wtInfo.unstagedCount + wtInfo.untrackedCount} 个未提交的变更，请先提交或暂存`,
      )
    }
    return await this.execGit(projectPath, ["checkout", branch])
  }

  /** 暂存当前工作区变更 */
  async stashSave(projectPath: string, message?: string): Promise<void> {
    const args = ["stash", "push", "--include-untracked"]
    if (message) args.push("-m", message)
    await this.execGit(projectPath, args)
  }

  /** 列出所有 stash 条目 */
  async stashList(projectPath: string): Promise<StashEntry[]> {
    try {
      const raw = await this.execGit(projectPath, ["stash", "list"])
      if (!raw) return []
      const entries: StashEntry[] = []
      const lines = raw.split("\n").filter(Boolean)
      for (const line of lines) {
        const match = line.match(/^stash@\{(\d+)\}:\s*(.+)$/)
        if (match) {
          entries.push({ index: Number.parseInt(match[1], 10), message: match[2] })
        }
      }
      return entries
    } catch {
      return []
    }
  }

  /** 恢复最近一次 stash（pop） */
  async stashPop(projectPath: string, index = 0): Promise<void> {
    await this.execGit(projectPath, ["stash", "pop", `stash@{${index}}`])
  }

  /** 应用 stash 但不删除 */
  async stashApply(projectPath: string, index = 0): Promise<void> {
    await this.execGit(projectPath, ["stash", "apply", `stash@{${index}}`])
  }

  /** 删除 stash 条目 */
  async stashDrop(projectPath: string, index = 0): Promise<void> {
    await this.execGit(projectPath, ["stash", "drop", `stash@{${index}}`])
  }

  /** AI 生成 stash 描述 */
  async generateStashDescription(projectPath: string): Promise<string> {
    const wt = await this.getWorkingTreeStatus(projectPath)
    if (!wt.hasChanges) return ""
    const names = wt.files.slice(0, 8).map((f) => f.path.split("/").pop() || f.path).join("、")
    const more = wt.files.length > 8 ? `等${wt.files.length}个文件` : ""

    const aiConfig = getApiConfigFromPlugin(this.plugin)
    if (!aiConfig.apiKey) {
      return `${wt.files.length}个文件: ${names}${more}`
    }

    try {
      const result = await callAI(
        `根据以下 git 工作区变更的文件，推断改动意图，生成一条不超过 12 个字的简短描述。只返回描述本身，不要解释。\n示例：README.md → "更新README文档"；index.ts+types.ts → "重构类型定义"；App.vue+style.css → "调整页面布局和样式"；package.json → "更新依赖配置"\n变更文件：${names}${more}`,
        aiConfig,
        { temperature: 0.5, maxTokens: 40 },
      )
      const t = result?.trim()
      return t && t.length > 0 ? t : `${wt.files.length}个文件`
    } catch {
      return `${wt.files.length}个文件: ${names}${more}`
    }
  }

  // ── Tag 管理 ──

  async getTags(projectPath: string, limit = 10): Promise<TagInfo[]> {
    try {
      const raw = await this.execGit(projectPath, ["tag", "-l", `--sort=-creatordate`, `-n1`, `--format=%(refname:short)|%(subject)|%(creatordate:iso)`])
      return raw.trim().split("\n").filter(Boolean).slice(0, limit).map((line) => {
        const [name, message, date] = line.split("|")
        return { name, message: message || undefined, date: date || undefined }
      })
    } catch { return [] }
  }

  async createTag(projectPath: string, name: string, message?: string): Promise<void> {
    const args = ["tag", name]
    if (message) args.push("-m", message)
    await this.execGit(projectPath, args)
  }

  async deleteTag(projectPath: string, name: string): Promise<void> {
    await this.execGit(projectPath, ["tag", "-d", name])
  }

  async pushTag(projectPath: string, remoteName: string, tag: string): Promise<string> {
    return await this.execGit(projectPath, ["push", remoteName, tag])
  }

  // ── 冲突检测 ──

  async hasConflict(projectPath: string): Promise<boolean> {
    try {
      const r = await this.execGit(projectPath, ["diff", "--name-only", "--diff-filter=U"])
      return r.trim().length > 0
    } catch { return false }
  }

  async getConflictFiles(projectPath: string): Promise<ConflictFile[]> {
    try {
      const raw = await this.execGit(projectPath, ["diff", "--name-only", "--diff-filter=U"])
      return raw.trim().split("\n").filter(Boolean).map((path) => ({
        path: path.trim(),
        status: "both-modified",
      }))
    } catch { return [] }
  }

  async abortMerge(projectPath: string): Promise<void> {
    await this.execGit(projectPath, ["merge", "--abort"])
  }

  async resolveConflictFile(projectPath: string, file: string, strategy: "theirs" | "ours"): Promise<void> {
    await this.execGit(projectPath, ["checkout", `--${strategy}`, file])
    await this.execGit(projectPath, ["add", file])
  }

  // ── 提交信息模板 ──

  async getCommitTemplates(): Promise<CommitTemplate[]> {
    return this.storage.commitTemplates.loadOrDefault()
  }

  async saveCommitTemplates(templates: CommitTemplate[]): Promise<void> {
    await this.storage.commitTemplates.save(templates)
  }

  async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "add", name, url])
  }

  async removeRemote(projectPath: string, name: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "remove", name])
  }

  async renameRemote(projectPath: string, oldName: string, newName: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "rename", oldName, newName])
  }

  async getRemoteUrl(projectPath: string, name: string): Promise<string> {
    try {
      return (await this.execGit(projectPath, ["remote", "get-url", name])).trim()
    } catch {
      return ""
    }
  }

  async setRemoteUrl(projectPath: string, name: string, url: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "set-url", name, url])
  }

  async getBranch(projectPath: string): Promise<string> {
    try {
      return await this.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return ""
    }
  }

  async getHeadHash(projectPath: string): Promise<string> {
    try {
      return (await this.execGit(projectPath, ["rev-parse", "HEAD"])).trim()
    } catch {
      return ""
    }
  }

  async checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
      await this.execGit(projectPath, ["rev-parse", "--is-inside-work-tree"])
      return true
    } catch {
      return false
    }
  }

  async scanForGitRepos(dirPath: string): Promise<ScannedGitRepo[]> {
    const nodeModules = getNodeFsPathOs()
    if (!nodeModules) throw new Error("Node 环境不可用")
    const { fs, path } = nodeModules

    if (!fs.existsSync(dirPath)) throw new Error("路径不存在")
    if (!fs.statSync(dirPath).isDirectory()) throw new Error("路径不是目录")

    const SKIP_DIRS = new Set([
      "node_modules", ".git", "__pycache__", ".venv", "venv",
      "dist", "build", "target", "bin", "obj",
    ])

    const results: ScannedGitRepo[] = []
    const queue: string[] = [dirPath]

    while (queue.length > 0) {
      const currentDir = queue.shift()!
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        let hasGitDir = false

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name)
          if (entry.name === ".git" && entry.isDirectory()) {
            hasGitDir = true
          } else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
            queue.push(fullPath)
          }
        }

        if (hasGitDir) {
          results.push({ name: path.basename(currentDir), path: currentDir })
        }
      } catch {
        continue
      }
    }

    return results
  }

  async checkCanPushToCloud(id: string): Promise<{
    canPush: boolean
    github: boolean
    gitee: boolean
    gitea: boolean
    cnb: boolean
    remotes: GitRemoteInfo[]
  }> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) {
      return { canPush: false, github: false, gitee: false, gitea: false, cnb: false, remotes: [] }
    }

    const remotes = await this.detectRemotes(project.path)
    const github = remotes.some((r) => this.isKnownRemote(r, "github"))
    const gitee = remotes.some((r) => this.isKnownRemote(r, "gitee"))
    const gitea = remotes.some((r) => this.isKnownRemote(r, "gitea"))
    const cnb = remotes.some((r) => this.isKnownRemote(r, "cnb"))
    return { canPush: github || gitee || gitea || cnb, github, gitee, gitea, cnb, remotes }
  }

  /**
   * 执行 git 命令（信号量限流）
   * @param signal 可选 AbortSignal，触发后 kill 子进程并清等待队列
   */
  private execGit(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let killed = false

      const run = () => {
        if (signal?.aborted) {
          reject(new Error("操作已取消"))
          return
        }

        const cp = this.getProcess()
        if (!cp) { reject(new Error("Node 环境不可用")); return }
        this.gitRunning++

        const child = cp.execFile(
          "git", args,
          { cwd, timeout: 30000, encoding: "utf8", windowsHide: true },
          (error: any, stdout: string, stderr: string) => {
            this.gitRunning--
            this.activeProcesses.delete(child)
            const next = this.gitWaitQueue.shift()
            if (next) next()

            if (killed) { return }
            if (error) {
              reject(new Error(stderr || error.message))
            } else {
              resolve(stdout.replace(/[\r\n]+$/, ""))
            }
          },
        )
        this.activeProcesses.add(child)

        const onAbort = () => {
          killed = true
          try { child.kill("SIGTERM") } catch {}
          // 清空当前项目的排队操作
          this.gitWaitQueue = this.gitWaitQueue.filter(() => false)
        }
        if (signal) {
          if (signal.aborted) {
            onAbort()
            return
          }
          signal.addEventListener("abort", onAbort, { once: true })
        }
      }

      if (this.gitRunning < this.gitMaxConcurrent) {
        run()
      } else {
        this.gitWaitQueue.push(run)
      }
    })
  }

  /**
   * 获取工作区变更状态
   */
  async getWorkingTreeStatus(projectPath: string, opts?: { skipRefresh?: boolean, branch?: string }): Promise<WorkingTreeInfo> {
    const empty: WorkingTreeInfo = {
      branch: "",
      files: [],
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      hasChanges: false,
    }

    let branch = ""
    let stagedCount = 0
    let unstagedCount = 0
    let untrackedCount = 0
    const files: FileChange[] = []

    try {
      branch = opts?.branch ?? await this.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return empty
    }

    try {
      if (!opts?.skipRefresh) {
        await this.execGit(projectPath, ["update-index", "--refresh", "-q"]).catch(() => {})
      }
      const raw = await this.execGit(projectPath, ["-c", "core.quotepath=false", "status", "--porcelain"])
      if (!raw) { return { ...empty, branch } }

      const lines = raw.split("\n").filter(Boolean)
      for (const line of lines) {
        const statusCode = line.substring(0, 2)
        let filePath = line.substring(2).trim()
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1)
        }
        if (!filePath) continue

        const xy = statusCode.trim()
        const staged = statusCode[0] !== " " && statusCode[0] !== "?"
        const unstaged = statusCode[1] !== " "

        let status: FileChange["status"] = "modified"

        if (xy === "??") { status = "untracked"; untrackedCount++ }
        else if (xy.includes("M")) { status = "modified" }
        else if (xy.includes("A")) { status = "added" }
        else if (xy.includes("D")) { status = "deleted" }
        else if (xy.includes("R")) { status = "renamed" }
        else if (xy.includes("C")) { status = "copied" }
        else if (xy.includes("U")) { status = "unmerged" }

        if (staged && status !== "untracked") stagedCount++
        if (unstaged && status !== "untracked") unstagedCount++

        let actualPath = filePath
        let oldPath: string | undefined
        if (status === "renamed") {
          const arrowIdx = filePath.indexOf(" -> ")
          if (arrowIdx > 0) {
            oldPath = filePath.substring(0, arrowIdx).trim()
            actualPath = filePath.substring(arrowIdx + 4).trim()
          }
        }

        files.push({ path: actualPath, status, staged, oldPath })
      }
    } catch {
      // 忽略
    }

    return {
      branch,
      files,
      stagedCount,
      unstagedCount,
      untrackedCount,
      hasChanges: files.length > 0,
    }
  }

  /**
   * 获取文件差异
   */
  async getFileDiff(projectPath: string, file: string, staged = false): Promise<string> {
    try {
      const args = ["-c", "core.quotepath=false", "diff", "--text"]
      if (staged) args.push("--cached")
      args.push("--", file)
      return await this.execGit(projectPath, args) || "（无差异）"
    } catch {
      return "（无法获取差异）"
    }
  }

  async stageFile(projectPath: string, file: string): Promise<void> {
    await this.execGit(projectPath, ["add", "--", file])
  }

  async stageAll(projectPath: string): Promise<void> {
    await this.execGit(projectPath, ["add", "-A"])
  }

  async unstageFile(projectPath: string, file: string): Promise<void> {
    await this.execGit(projectPath, ["reset", "HEAD", "--", file])
  }

  async unstageAll(projectPath: string): Promise<void> {
    await this.execGit(projectPath, ["reset", "HEAD"])
  }

  async discardFile(projectPath: string, file: string, staged: boolean, status: string): Promise<void> {
    if (staged) {
      await this.execGit(projectPath, ["reset", "HEAD", "--", file]).catch(() => {})
      await this.execGit(projectPath, ["checkout", "--", file]).catch(() => {})
    } else if (status === "untracked") {
      await this.execGit(projectPath, ["clean", "-f", "--", file])
    } else {
      await this.execGit(projectPath, ["checkout", "--", file])
    }
  }

  async commit(projectPath: string, message: string): Promise<string> {
    return await this.execGit(projectPath, ["-c", "core.quotepath=false", "commit", "-m", message])
  }

  /**
   * 根据暂存区差异自动生成提交信息
   */
  async generateCommitMessage(projectPath: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    try {
      const diffText = await this.execGit(projectPath, [
        "-c", "core.quotepath=false", "diff", "--text", "--cached", "--stat",
      ])
      if (!diffText) { return { message: "chore: update files", source: "heuristic" } }

      const fullDiff = await this.execGit(projectPath, [
        "-c", "core.quotepath=false", "diff", "--text", "--cached",
      ])
      const diffSnippet = (fullDiff || diffText).substring(0, 3000)

      const aiConfig = getApiConfigFromPlugin(this.plugin)
      if (!aiConfig.apiKey) {
        return { message: this.heuristicCommitMessage(diffText), source: "heuristic" }
      }

      try {
        const result = await callAI(
          `根据以下 git diff，生成一条中文 conventional commit 信息。\n格式：type: 中文描述\ntype 必须为 ${COMMIT_TYPE_VALUES.join("/")} 之一。\n示例：refactor: 重构 userService 为策略模式\n示例：fix: 修复订单列表空指针异常\n示例：feat: 新增导出 PDF 功能\n重要：只输出一行提交信息，不要输出分析、解释、Markdown 或任何别的内容。\nDiff:\n${diffSnippet}`,
          aiConfig,
          {
            systemPrompt: "输出要求：只输出一行 conventional commit 格式的提交信息。禁止输出解释、分析、额外文字。",
            temperature: 0.1,
            maxTokens: 60,
            enableThinking: false,
          },
        )
        const trimmed = result?.trim() ?? ""
        const match = trimmed.match(/(feat|fix|chore|docs|style|refactor|test)(?:\([^)]+\))?\s*:\s*(.+)/i)
        if (match) {
          return { message: `${match[1]}: ${match[2].trim()}`, source: "ai" }
        }
        console.warn("[gitPush] AI 未返回有效 commit 格式，降级启发式:", trimmed.substring(0, 80))
      } catch (e: any) {
        console.error("[gitPush] AI 调用失败:", e?.message || e)
      }

      return { message: this.heuristicCommitMessage(diffText), source: "heuristic" }
    } catch {
      return { message: "chore: update files", source: "heuristic" }
    }
  }

  private heuristicCommitMessage(statText: string): string {
    const lines = statText.split("\n").filter(Boolean)
    const files = lines.slice(0, -1).map((l) => l.split("|")[0]?.trim()).filter(Boolean)

    let type = "chore"
    const allPaths = files.join(" ").toLowerCase()

    if (files.some((f) => f.match(/\.(test|spec)\./))) type = "test"
    else if (files.some((f) => f.match(/\.(css|scss|less|style)/))) type = "style"
    else if (allPaths.includes("fix") || allPaths.includes("bug")) type = "fix"
    else if (allPaths.includes("readme") || allPaths.includes("doc")) type = "docs"
    else if (allPaths.includes("refactor") || allPaths.includes("rename")) type = "refactor"
    else if (allPaths.includes(".d.ts") || allPaths.includes("types/")) type = "refactor"
    else if (files.length >= 5) type = "feat"

    const fileList = files.slice(0, 3).map((f) => f.split("/").pop() || f).join(", ")
    const more = files.length > 3 ? ` 等 ${files.length} 个文件` : ""

    return `${type}: ${fileList}${more}`
  }

  /** 获取所有分类 */
  async getCategories(): Promise<ProjectCategory[]> {
    return this.storage.categories.loadOrDefault()
  }

  async addCategory(name: string, color = "#4a9eff"): Promise<ProjectCategory> {
    const cats = await this.getCategories()
    const cat: ProjectCategory = { id: Date.now().toString(), name, color, order: cats.length }
    cats.push(cat)
    await this.storage.categories.save(cats)
    return cat
  }

  async updateCategory(id: string, data: Partial<Pick<ProjectCategory, "name" | "color">>): Promise<void> {
    const cats = await this.getCategories()
    const cat = cats.find((c) => c.id === id)
    if (!cat || id === "__ungrouped__") return
    if (data.name !== undefined) cat.name = data.name
    if (data.color !== undefined) cat.color = data.color
    await this.storage.categories.save(cats)
  }

  async deleteCategory(id: string): Promise<void> {
    if (id === "__ungrouped__") return
    const cats = await this.getCategories()
    const idx = cats.findIndex((c) => c.id === id)
    if (idx === -1) return
    cats.splice(idx, 1)
    await this.storage.categories.save(cats)

    const projs = await this.getProjects()
    let changed = false
    for (const p of projs) {
      if (p.categoryId === id) { p.categoryId = "__ungrouped__"; changed = true }
    }
    if (changed) await this.storage.projects.save(projs)
  }

  async moveProject(projectId: string, categoryId: string): Promise<void> {
    const projs = await this.getProjects()
    const p = projs.find((x) => x.id === projectId)
    if (!p) return
    p.categoryId = categoryId
    await this.storage.projects.save(projs)
  }

  destroy() {
    // 取消所有进行中的操作
    for (const ac of this.abortControllers.values()) {
      ac.abort()
    }
    this.abortControllers.clear()
    // 清理等待队列中所有闭包，防止插件卸载后僵尸 Promise 持有闭包引用导致内存泄漏
    this.gitWaitQueue.length = 0
  }
}
