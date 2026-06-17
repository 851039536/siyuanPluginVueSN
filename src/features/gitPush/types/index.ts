import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { getNodeProcessModules } from "@/utils/nodeModules"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi"
import type { GitProject, GitRemoteInfo, PushStatusInfo, RemotePushStatus, FileChange, WorkingTreeInfo, ProjectCategory, CommitLogEntry, BranchInfo, ScannedGitRepo, StashEntry, ProjectStatus } from "./storage"
import { GitPushStorage, COMMIT_TYPE_VALUES, PROJECT_STATUS_VALUES } from "./storage"
import GitPushPanel from "../index.vue"

export type { GitProject, GitRemoteInfo, PushStatusInfo, RemotePushStatus, FileChange, WorkingTreeInfo, ProjectCategory, CommitLogEntry, BranchInfo, StashEntry, ProjectStatus }
export type { ScannedGitRepo }
export { GitPushStorage, COMMIT_TYPE_VALUES, PROJECT_STATUS_VALUES }

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

  /** 获取 child_process 模块（简写） */
  private getProcess() {
    return getNodeProcessModules()?.child_process
  }

  /** 将检测到的远程仓库信息应用到项目对象 */
  private applyRemotesToProject(project: GitProject, remotes: GitRemoteInfo[]) {
    project.githubRemote = undefined
    project.giteeRemote = undefined
    project.giteaRemote = undefined
    project.githubUrl = undefined
    project.giteeUrl = undefined
    project.giteaUrl = undefined
    for (const r of remotes) {
      if (r.isGithub) { project.githubRemote = r.name; project.githubUrl = r.url }
      if (r.isGitee) { project.giteeRemote = r.name; project.giteeUrl = r.url }
      if (r.isGitea) { project.giteaRemote = r.name; project.giteaUrl = r.url }
    }
  }

  async init() {
    await this.storage.init()
    this.gitMaxConcurrent = await this.storage.gitConcurrency.loadOrDefault()
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
   * @param tags 可选初始标签
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
    // 自动检测远程仓库
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
    const idx = projects.findIndex(p => p.id === id)
    if (idx !== -1) {
      projects.splice(idx, 1)
      await this.storage.projects.save(projects)
      await this.syncGlobalTags()
    }
  }

  /**
   * 更新项目元信息（tags/starred/status/archived/note 等）并持久化
   * 返回更新后的项目，未找到返回 null
   */
  async updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "tags" | "starred" | "status" | "archived" | "note" | "name">>): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) return null
    Object.assign(project, patch)
    await this.storage.projects.save(projects)
    if (patch.tags !== undefined) await this.syncGlobalTags()
    return project
  }

  /** 切换收藏状态 */
  async toggleStar(id: string): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
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
    const project = projects.find(p => p.id === id)
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
    const project = projects.find(p => p.id === id)
    if (!project) return null
    if (project.tags) {
      project.tags = project.tags.filter(t => t !== tag)
      if (project.tags.length === 0) project.tags = undefined
      await this.storage.projects.save(projects)
      await this.syncGlobalTags()
    }
    return project
  }

  /** 记录最后活动时间（由 commitLog 更新触发，仅当变化时持久化） */
  async recordLastActivity(id: string, isoTime: string): Promise<void> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project || project.lastActivity === isoTime) return
    project.lastActivity = isoTime
    await this.storage.projects.save(projects)
  }

  /** 同步全局标签缓存（所有项目 tags 去重并集） */
  private async syncGlobalTags(): Promise<void> {
    const projects = await this.getProjects()
    const set = new Set<string>()
    for (const p of projects) {
      if (p.tags) for (const t of p.tags) if (t) set.add(t)
    }
    await this.storage.tags.save([...set].sort())
  }

  /** 读取全局标签缓存 */
  async getAllTags(): Promise<string[]> {
    return this.storage.tags.loadOrDefault()
  }

  /**
   * 重新检测项目远程仓库并更新
   */
  async refreshRemotes(id: string): Promise<GitProject | null> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) return null
    this.applyRemotesToProject(project, await this.detectRemotes(project.path))
    await this.storage.projects.save(projects)
    return project
  }

  /** 判断远程仓库是否为已知平台 */
  private isKnownRemote(remote: GitRemoteInfo, platform: "github" | "gitee" | "gitea"): boolean {
    if (platform === "github") return remote.isGithub
    if (platform === "gitee") return remote.isGitee
    return remote.isGitea
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
          // 只在 fetch 行处理（避免 push 行重复）
          if (line.includes("(fetch)")) {
            const lower = url.toLowerCase()
            // 按域名识别已知平台；自托管 Gitea/其他 git 服务（URL 不含上述域名）
            // 统一作为 Gitea 兜底，避免自建 Gitea（如 http://10.x.x.x:3000/...）无法识别
            const isGithub = lower.includes("github.com")
            const isGitee = lower.includes("gitee.com") || lower.includes("gitcode.com")
            result.push({
              name,
              url,
              isGithub,
              isGitee,
              isGitea: !isGithub && !isGitee,
            })
          }
        }
      }
      return result
    } catch {
      return []
    }
  }

  /**
   * 推送项目到全部已配置的远程（GitHub + Gitee + Gitea）
   */
  async pushToAll(id: string): Promise<{
    success: boolean
    github: { ok: boolean; stdout: string; stderr: string }
    gitee: { ok: boolean; stdout: string; stderr: string }
    gitea: { ok: boolean; stdout: string; stderr: string }
  }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    const emptyResult = { ok: false, stdout: "", stderr: "" }

    if (!project) {
      const notFound = { ...emptyResult, stderr: "项目未找到" }
      return { success: false, github: notFound, gitee: notFound, gitea: notFound }
    }

    const tryPush = async (remoteName: string | undefined) => {
      if (!remoteName) return { ...emptyResult }
      try {
        const stdout = await this.execGit(project.path, ["push", remoteName, "--all"]) || ""
        return { ok: true, stdout, stderr: "" }
      } catch (e: any) {
        return { ok: false, stdout: "", stderr: e?.message || String(e) }
      }
    }

    const github = await tryPush(project.githubRemote)
    const gitee = await tryPush(project.giteeRemote)
    const gitea = await tryPush(project.giteaRemote)
    return { success: github.ok || gitee.ok || gitea.ok, github, gitee, gitea }
  }

  /**
   * 推送项目到单个远程仓库
   */
  async pushSingle(
    id: string,
    target: "github" | "gitee" | "gitea",
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return { ok: false, stdout: "", stderr: "项目未找到" }
    }

    const remoteName =
      target === "github" ? (project.githubRemote || "github")
      : target === "gitee" ? (project.giteeRemote || "gitee")
      : (project.giteaRemote || "gitea")

    try {
      const stdout = await this.execGit(project.path, ["push", remoteName, "--all"]) || ""
      return { ok: true, stdout, stderr: "" }
    } catch (e: any) {
      return { ok: false, stdout: "", stderr: e?.message || String(e) }
    }
  }

  /**
   * 从全部已配置远程拉取更新
   */
  async pullToAll(id: string): Promise<{
    success: boolean
    github: { ok: boolean; stdout: string; stderr: string }
    gitee: { ok: boolean; stdout: string; stderr: string }
    gitea: { ok: boolean; stdout: string; stderr: string }
  }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    const emptyResult = { ok: false, stdout: "", stderr: "" }

    if (!project) {
      const notFound = { ...emptyResult, stderr: "项目未找到" }
      return { success: false, github: notFound, gitee: notFound, gitea: notFound }
    }

    const tryPull = async (remoteName: string | undefined) => {
      if (!remoteName) return { ...emptyResult }
      try {
        const stdout = await this.execGit(project.path, ["pull", remoteName, "--ff-only"]) || ""
        return { ok: true, stdout, stderr: "" }
      } catch (e: any) {
        return { ok: false, stdout: "", stderr: e?.message || String(e) }
      }
    }

    const github = await tryPull(project.githubRemote)
    const gitee = await tryPull(project.giteeRemote)
    const gitea = await tryPull(project.giteaRemote)
    return { success: github.ok || gitee.ok || gitea.ok, github, gitee, gitea }
  }

  /**
   * 从单个远程仓库拉取
   */
  async pullSingle(
    id: string,
    target: "github" | "gitee" | "gitea",
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return { ok: false, stdout: "", stderr: "项目未找到" }
    }

    const remoteName =
      target === "github" ? (project.githubRemote || "github")
      : target === "gitee" ? (project.giteeRemote || "gitee")
      : (project.giteaRemote || "gitea")

    try {
      const stdout = await this.execGit(project.path, ["pull", remoteName, "--ff-only"]) || ""
      return { ok: true, stdout, stderr: "" }
    } catch (e: any) {
      return { ok: false, stdout: "", stderr: e?.message || String(e) }
    }
  }

  /**
   * 检查项目各远程的推送状态（ahead/behind/noUpstream）
   * 用于判断是否需要进行 git push
   * @param opts.branch 当前分支名，传入后跳过 rev-parse（批量统计场景节省一次 git 调用）
   */
  async checkPushStatus(id: string, opts?: { branch?: string }): Promise<PushStatusInfo> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    const emptyResult: PushStatusInfo = { branch: "", remotes: {}, needsPush: false }

    if (!project) return emptyResult

    const status: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    try {
      // 获取当前分支（外部已提供时跳过 rev-parse）
      status.branch = opts?.branch ?? await this.execGit(project.path, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return emptyResult
    }

    // 检查每个已知的远程
    const remotesToCheck: { key: string; remoteName: string }[] = []
    if (project.githubRemote) {
      remotesToCheck.push({ key: "github", remoteName: project.githubRemote })
    }
    if (project.giteeRemote) {
      remotesToCheck.push({ key: "gitee", remoteName: project.giteeRemote })
    }
    if (project.giteaRemote) {
      remotesToCheck.push({ key: "gitea", remoteName: project.giteaRemote })
    }

    // 并行检查每个远程
    const remoteChecks = remotesToCheck.map(async ({ key, remoteName }) => {
      try {
        // 尝试检查远程分支是否存在
        await this.execGit(project.path, [
          "rev-parse",
          "--verify",
          `${remoteName}/${status.branch}`,
        ])

        // 远程分支存在，比较 ahead/behind
        const counts = await this.execGit(project.path, [
          "rev-list",
          "--left-right",
          "--count",
          `${remoteName}/${status.branch}...HEAD`,
        ])
        const parts = counts.split("\t")
        const behind = parseInt(parts[0] || "0", 10) // 左侧 = 远程有而本地没有
        const ahead = parseInt(parts[1] || "0", 10)  // 右侧 = 本地有而远程没有

        return { key, result: { ahead, behind, noUpstream: false }, ahead }
      } catch {
        // 远程分支不存在 → 意味着从未推送过，全部本地提交都需要推送
        const totalCommits = await this.execGit(project.path, [
          "rev-list",
          "--count",
          "HEAD",
        ]).catch(() => "0")
        const ahead = parseInt(totalCommits, 10) || 0

        return { key, result: { ahead, behind: 0, noUpstream: true }, ahead }
      }
    })

    const results = await Promise.all(remoteChecks)
    for (const { key, result, ahead } of results) {
      status.remotes[key] = result
      if (ahead > 0) status.needsPush = true
    }

    return status
  }

  /**
   * 获取当前分支最近 N 条提交记录
   */
  async getCommitLog(projectPath: string, count = 5): Promise<CommitLogEntry[]> {
    try {
      const format = "%h%n%s%n%an%n%ar%n%aI"
      const raw = await this.execGit(projectPath, [
        "log", `-${count}`, `--format=${format}`,
      ])
      if (!raw) return []

      // %s 只输出提交标题（单行），每 5 行 = 1 条记录
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
      const raw = await this.execGit(projectPath, [
        "branch", "--format=%(refname:short)%00%(HEAD)",
      ])
      if (!raw) return []
      return raw.split("\n").filter(Boolean).map(line => {
        const [name, head] = line.split("\0")
        return { name, current: head === "*" }
      })
    } catch {
      return []
    }
  }

  /**
   * 切换分支（切换前检测未提交变更）
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
      // 默认格式: "stash@{0}: WIP on master: abc1234 feat: some message"
      const raw = await this.execGit(projectPath, ["stash", "list"])
      if (!raw) return []
      const entries: StashEntry[] = []
      const lines = raw.split("\n").filter(Boolean)
      for (const line of lines) {
        const match = line.match(/^stash@\{(\d+)\}:\s*(.+)$/)
        if (match) {
          entries.push({
            index: parseInt(match[1], 10),
            message: match[2],
          })
        }
      }
      return entries
    } catch {
      return []
    }
  }

  /** 恢复最近一次 stash（pop = 恢复并删除） */
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

  /** AI 生成 stash 描述（基于工作区变更文件列表） */
  async generateStashDescription(projectPath: string): Promise<string> {
    const wt = await this.getWorkingTreeStatus(projectPath)
    if (!wt.hasChanges) return ""
    const names = wt.files.slice(0, 8).map(f => f.path.split("/").pop() || f.path).join("、")
    const more = wt.files.length > 8 ? `等${wt.files.length}个文件` : ""

    const aiConfig = getApiConfigFromPlugin(this.plugin)
    if (!aiConfig.apiKey) {
      return `${wt.files.length}个文件: ${names}${more}`
    }

    try {
      const result = await callAI(
        `根据以下 git 工作区变更的文件，推断改动意图，生成一条不超过 12 个字的简短描述。只返回描述本身，不要解释。
示例：README.md → "更新README文档"；index.ts+types.ts → "重构类型定义"；App.vue+style.css → "调整页面布局和样式"；package.json → "更新依赖配置"
变更文件：${names}${more}`,
        aiConfig,
        { temperature: 0.5, maxTokens: 40 },
      )
      const t = result?.trim()
      return t && t.length > 0 ? t : `${wt.files.length}个文件`
    } catch {
      return `${wt.files.length}个文件: ${names}${more}`
    }
  }

  /** 添加远程仓库 */
  async addRemote(projectPath: string, name: string, url: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "add", name, url])
  }

  /** 删除远程仓库 */
  async removeRemote(projectPath: string, name: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "remove", name])
  }

  /** 重命名远程仓库 */
  async renameRemote(projectPath: string, oldName: string, newName: string): Promise<void> {
    await this.execGit(projectPath, ["remote", "rename", oldName, newName])
  }

  /** 获取远程仓库 URL */
  async getRemoteUrl(projectPath: string, name: string): Promise<string> {
    try {
      return (await this.execGit(projectPath, ["remote", "get-url", name])).trim()
    } catch {
      return ""
    }
  }

  /**
   * 获取当前分支名（轻量 rev-parse，批量统计场景复用避免重复调用）
   */
  async getBranch(projectPath: string): Promise<string> {
    try {
      return await this.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return ""
    }
  }

  /**
   * 获取当前 HEAD 的 commit hash（用于检测项目是否变动）
   */
  async getHeadHash(projectPath: string): Promise<string> {
    try {
      return (await this.execGit(projectPath, ["rev-parse", "HEAD"])).trim()
    } catch {
      return ""
    }
  }

  /**
   * 检查项目路径是否有效（目录存在且是 git 仓库）
   */
  async checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
      await this.execGit(projectPath, ["rev-parse", "--is-inside-work-tree"])
      return true
    } catch {
      return false
    }
  }

  /**
   * BFS 递归扫描指定目录下的所有 Git 仓库
   */
  async scanForGitRepos(dirPath: string): Promise<ScannedGitRepo[]> {
    const nodeModules = getNodeFsPathOs()
    if (!nodeModules) throw new Error("Node 环境不可用")
    const { fs, path } = nodeModules

    if (!fs.existsSync(dirPath)) {
      throw new Error("路径不存在")
    }
    if (!fs.statSync(dirPath).isDirectory()) {
      throw new Error("路径不是目录")
    }

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
          results.push({
            name: path.basename(currentDir),
            path: currentDir,
          })
        }
      } catch {
        // 跳过无权限或无法访问的目录
        continue
      }
    }

    return results
  }

  /**
   * 检查项目是否可以推送到云端（有 GitHub 或 Gitee 远程）
   */
  async checkCanPushToCloud(id: string): Promise<{
    canPush: boolean
    github: boolean
    gitee: boolean
    gitea: boolean
    remotes: GitRemoteInfo[]
  }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return { canPush: false, github: false, gitee: false, gitea: false, remotes: [] }
    }

    const remotes = await this.detectRemotes(project.path)
    const github = remotes.some(r => this.isKnownRemote(r, "github"))
    const gitee = remotes.some(r => this.isKnownRemote(r, "gitee"))
    const gitea = remotes.some(r => this.isKnownRemote(r, "gitea"))
    return { canPush: github || gitee || gitea, github, gitee, gitea, remotes }
  }

  /**
   * 执行 git 命令（execFile 直调，内部信号量限流 max 3 并发）
   */
  private execGit(cwd: string, args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const run = () => {
        const cp = this.getProcess()
        if (!cp) { reject(new Error("Node 环境不可用")); return }
        this.gitRunning++
        const isStageOp = /^(add|reset|status)/.test(args[0] || "")
        if (isStageOp) console.log(`[gitPush:execGit] cwd=${cwd} args=${args.join(" ")} running=${this.gitRunning}`)

        cp.execFile(
          "git",
          args,
          { cwd, timeout: 30000, encoding: "utf8", windowsHide: true },
          (error: any, stdout: string, stderr: string) => {
            if (isStageOp) console.log(`[gitPush:execGit] stdout=${stdout?.substring(0, 200)} stderr=${stderr?.substring(0, 200)}`)
            this.gitRunning--
            // 唤醒队列中的下一个
            const next = this.gitWaitQueue.shift()
            if (next) next()

            if (error) {
              if (isStageOp) console.error(`[gitPush:execGit] ERROR:`, error.message, stderr)
              reject(new Error(stderr || error.message))
            } else {
              resolve(stdout.replace(/[\r\n]+$/, ""))
            }
          },
        )
      }

      if (this.gitRunning < this.gitMaxConcurrent) {
        run()
      } else {
        this.gitWaitQueue.push(run)
      }
    })
  }

  /**
   * 获取工作区变更状态（git status --porcelain -b）
   * @param opts.skipRefresh 跳过 `update-index --refresh`（首屏/批量探测时设为 true，避免遍历 index 的重命令）
   */
  async getWorkingTreeStatus(projectPath: string, opts?: { skipRefresh?: boolean; branch?: string }): Promise<WorkingTreeInfo> {
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
      // 获取分支名（外部已提供时跳过 rev-parse）
      branch = opts?.branch ?? await this.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return empty
    }

    try {
      // Windows 上 child_process.exec 修改 .git/index 后 OS 文件缓存可能未刷盘，
      // 先执行 update-index --refresh 强制 git 重新 stat index 中的所有条目，
      // 确保后续 status 读到最新的暂存区状态。
      // 首屏/批量探测场景下 index 未被本进程改动，跳过此重命令以大幅提速；
      // stage/commit 等改写了 index 的操作后仍需执行。
      if (!opts?.skipRefresh) {
        await this.execGit(projectPath, ["update-index", "--refresh", "-q"]).catch(() => {})
      }
      // -c core.quotepath=false 禁用中文路径八进制转义，避免 git add 时找不到文件
      const raw = await this.execGit(projectPath, [
        "-c", "core.quotepath=false", "status", "--porcelain",
      ])
      if (!raw) return { ...empty, branch }

      const lines = raw.split("\n").filter(Boolean)
      for (const line of lines) {
        // 格式: XY PATH（2 字符状态码 + 1 空格 + 路径）
        const statusCode = line.substring(0, 2)
        // 剥离 git 对含特殊字符路径添加的双引号
        let filePath = line.substring(2).trim()
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1)
        }
        if (!filePath) continue

        const xy = statusCode.trim()
        // 用原始 statusCode 判断，避免 trim 丢失位置信息
        const staged = statusCode[0] !== " " && statusCode[0] !== "?"
        const unstaged = statusCode[1] !== " "

        // 解析 git status --porcelain 的状态码
        // 格式：XY path，where X=staging area status, Y=working tree status
        let status: FileChange["status"] = "modified"

        if (xy === "??") {
          status = "untracked"
          untrackedCount++
        } else if (xy.includes("M")) {
          status = "modified"
        } else if (xy.includes("A")) {
          status = "added"
        } else if (xy.includes("D")) {
          status = "deleted"
        } else if (xy.includes("R")) {
          status = "renamed"
        } else if (xy.includes("C")) {
          status = "copied"
        } else if (xy.includes("U")) {
          status = "unmerged"
        }

        if (staged && status !== "untracked") stagedCount++
        if (unstaged && status !== "untracked") unstagedCount++

        // 处理重命名（R  old -> new）
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
      // git status 失败，返回空
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
   * @param staged true=暂存区差异（git diff --cached），false=工作区差异（git diff）
   */
  async getFileDiff(projectPath: string, file: string, staged = false): Promise<string> {
    try {
      const args = ["-c", "core.quotepath=false", "diff", "--text"] // --text 强制文本模式，-c 禁用路径转义
      if (staged) args.push("--cached")
      args.push("--", file)
      return await this.execGit(projectPath, args) || "（无差异）"
    } catch {
      return "（无法获取差异）"
    }
  }

  /** 暂存单个文件 */
  async stageFile(projectPath: string, file: string): Promise<void> {
    await this.execGit(projectPath, ["add", "--", file])
  }

  /** 暂存全部文件 */
  async stageAll(projectPath: string): Promise<void> {
    await this.execGit(projectPath, ["add", "-A"])
  }

  /** 取消暂存单个文件 */
  async unstageFile(projectPath: string, file: string): Promise<void> {
    await this.execGit(projectPath, ["reset", "HEAD", "--", file])
  }

  /** 取消全部暂存 */
  async unstageAll(projectPath: string): Promise<void> {
    await this.execGit(projectPath, ["reset", "HEAD"])
  }

  /** 丢弃单个文件的更改 */
  async discardFile(projectPath: string, file: string, staged: boolean, status: string): Promise<void> {
    if (staged) {
      // 先取消暂存，再丢弃工作区修改
      await this.execGit(projectPath, ["reset", "HEAD", "--", file]).catch(() => {})
      await this.execGit(projectPath, ["checkout", "--", file]).catch(() => {})
    } else if (status === "untracked") {
      await this.execGit(projectPath, ["clean", "-f", "--", file])
    } else {
      await this.execGit(projectPath, ["checkout", "--", file])
    }
  }

  /** 提交暂存的内容 */
  async commit(projectPath: string, message: string): Promise<string> {
    // -c core.quotepath=false 禁用中文路径八进制转义，让输出显示可读文件名
    return await this.execGit(projectPath, ["-c", "core.quotepath=false", "commit", "-m", message])
  }

  /**
   * 根据暂存区差异自动生成提交信息
   * 优先使用配置的 AI 模型分析 diff 内容；无 API Key 则降级为启发式
   */
  async generateCommitMessage(projectPath: string): Promise<{ message: string; source: "ai" | "heuristic" }> {
    try {
      // 获取暂存区差异文本
      const diffText = await this.execGit(projectPath, [
        "-c", "core.quotepath=false", "diff", "--text", "--cached", "--stat",
      ])
      if (!diffText) return { message: "chore: update files", source: "heuristic" }

      // 截取用于 AI 的 diff（最多 3000 字符，避免 token 超限）
      const fullDiff = await this.execGit(projectPath, [
        "-c", "core.quotepath=false", "diff", "--text", "--cached",
      ])
      const diffSnippet = (fullDiff || diffText).substring(0, 3000)

      // 尝试 AI 生成（参照 wordQuery 使用 callAI 非流式调用）
      const aiConfig = getApiConfigFromPlugin(this.plugin)
      if (!aiConfig.apiKey) {
        return { message: this.heuristicCommitMessage(diffText), source: "heuristic" }
      }

      try {
        const result = await callAI(
          `根据以下 git diff，生成一条中文 conventional commit 信息（格式：type(scope): 中文描述）。
只返回提交信息本身，不解释。type 为 ${COMMIT_TYPE_VALUES.join("/")} 之一。
Diff:
${diffSnippet}`,
          aiConfig,
          {
            systemPrompt: "你是一个 git commit 信息生成器。分析代码 diff，只输出一条中文 conventional commit 信息，不要任何解释。",
            temperature: 0.3,
            maxTokens: 200,
          },
        )
        const trimmed = result?.trim()
        if (trimmed && trimmed.length > 2) return { message: trimmed, source: "ai" }
        // AI 返回过短，降级
        console.warn("[gitPush] AI 返回过短，降级启发式:", trimmed)
      } catch (e: any) {
        console.error("[gitPush] AI 调用失败:", e?.message || e)
      }

      // 降级：启发式生成
      return { message: this.heuristicCommitMessage(diffText), source: "heuristic" }
    } catch {
      return { message: "chore: update files", source: "heuristic" }
    }
  }

  /**
   * 启发式生成提交信息（AI 不可用时的降级方案）
   */
  private heuristicCommitMessage(statText: string): string {
    const lines = statText.split("\n").filter(Boolean)
    // 统计行如: "3 files changed, 15 insertions(+), 2 deletions(-)"
    const files = lines.slice(0, -1).map(l => l.split("|")[0]?.trim()).filter(Boolean)

    let type = "chore"
    const allPaths = files.join(" ").toLowerCase()

    if (files.some(f => f.match(/\.(test|spec)\./))) type = "test"
    else if (files.some(f => f.match(/\.(css|scss|less|style)/))) type = "style"
    else if (allPaths.includes("fix") || allPaths.includes("bug")) type = "fix"
    else if (allPaths.includes("readme") || allPaths.includes("doc")) type = "docs"
    else if (allPaths.includes("refactor") || allPaths.includes("rename")) type = "refactor"
    else if (allPaths.includes(".d.ts") || allPaths.includes("types/")) type = "types"
    else if (files.length >= 5) type = "feat"

    const fileList = files.slice(0, 3).map(f => f.split("/").pop() || f).join(", ")
    const more = files.length > 3 ? ` 等 ${files.length} 个文件` : ""

    return `${type}: ${fileList}${more}`
  }

  /** 获取所有分类 */
  async getCategories(): Promise<ProjectCategory[]> {
    return this.storage.categories.loadOrDefault()
  }

  /** 新增分类 */
  async addCategory(name: string, color = "#4a9eff"): Promise<ProjectCategory> {
    const cats = await this.getCategories()
    const cat: ProjectCategory = {
      id: Date.now().toString(),
      name,
      color,
      order: cats.length,
    }
    cats.push(cat)
    await this.storage.categories.save(cats)
    return cat
  }

  /** 更新分类 */
  async updateCategory(id: string, data: Partial<Pick<ProjectCategory, "name" | "color">>): Promise<void> {
    const cats = await this.getCategories()
    const cat = cats.find(c => c.id === id)
    if (!cat || id === "__ungrouped__") return
    if (data.name !== undefined) cat.name = data.name
    if (data.color !== undefined) cat.color = data.color
    await this.storage.categories.save(cats)
  }

  /** 删除分类（项目回退到未分组） */
  async deleteCategory(id: string): Promise<void> {
    if (id === "__ungrouped__") return
    const cats = await this.getCategories()
    const idx = cats.findIndex(c => c.id === id)
    if (idx === -1) return
    cats.splice(idx, 1)
    await this.storage.categories.save(cats)

    // 将该分类下的项目移到未分组
    const projs = await this.getProjects()
    let changed = false
    for (const p of projs) {
      if (p.categoryId === id) {
        p.categoryId = "__ungrouped__"
        changed = true
      }
    }
    if (changed) await this.storage.projects.save(projs)
  }

  /** 移动项目到指定分类 */
  async moveProject(projectId: string, categoryId: string): Promise<void> {
    const projs = await this.getProjects()
    const p = projs.find(x => x.id === projectId)
    if (!p) return
    p.categoryId = categoryId
    await this.storage.projects.save(projs)
  }

  destroy() {
    // 清理资源
  }
}
