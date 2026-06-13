import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { getNodeProcessModules } from "@/utils/nodeModules"
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi"
import type { GitProject, GitRemoteInfo, PushStatusInfo, RemotePushStatus, FileChange, WorkingTreeInfo, ProjectCategory, CommitLogEntry, BranchInfo } from "./storage"
import { GitPushStorage, COMMIT_TYPE_VALUES } from "./storage"
import GitPushPanel from "../index.vue"

export type { GitProject, GitRemoteInfo, PushStatusInfo, RemotePushStatus, FileChange, WorkingTreeInfo, ProjectCategory, CommitLogEntry, BranchInfo }
export { GitPushStorage, COMMIT_TYPE_VALUES }

export class GitPushManager {
  private plugin: Plugin
  storage: GitPushStorage

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GitPushStorage(plugin)
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
    for (const r of remotes) {
      if (r.isGithub) project.githubRemote = r.name
      if (r.isGitee) project.giteeRemote = r.name
      if (r.isGitea) project.giteaRemote = r.name
    }
  }

  async init() {
    await this.storage.init()
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
  async addProject(name: string, path: string, categoryId = "__ungrouped__"): Promise<GitProject> {
    const projects = await this.getProjects()
    const project: GitProject = {
      id: Date.now().toString(),
      name,
      path,
      categoryId,
      addedAt: Date.now(),
    }
    // 自动检测远程仓库
    this.applyRemotesToProject(project, await this.detectRemotes(path))
    projects.push(project)
    await this.storage.projects.save(projects)
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
    }
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
            result.push({
              name,
              url,
              isGithub: lower.includes("github.com"),
              isGitee: lower.includes("gitee.com") || lower.includes("gitcode.com"),
              isGitea: lower.includes("gitea"),
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
   */
  async checkPushStatus(id: string): Promise<PushStatusInfo> {
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
      // 获取当前分支
      status.branch = await this.execGit(project.path, ["rev-parse", "--abbrev-ref", "HEAD"])
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

    for (const { key, remoteName } of remotesToCheck) {
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

        status.remotes[key] = { ahead, behind, noUpstream: false }
        if (ahead > 0) status.needsPush = true
      } catch {
        // 远程分支不存在 → 意味着从未推送过，全部本地提交都需要推送
        const totalCommits = await this.execGit(project.path, [
          "rev-list",
          "--count",
          "HEAD",
        ]).catch(() => "0")
        const ahead = parseInt(totalCommits, 10) || 0

        status.remotes[key] = { ahead, behind: 0, noUpstream: true }
        if (ahead > 0) status.needsPush = true
      }
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

      const entries: CommitLogEntry[] = []
      const records = raw.split("\n\n").filter(Boolean)
      for (const record of records) {
        const lines = record.split("\n")
        if (lines.length >= 5) {
          entries.push({
            hash: lines[0],
            message: lines[1],
            author: lines[2],
            relativeDate: lines[3],
            date: lines[4],
          })
        }
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
   * 执行 git 命令
   * 自动对含空格/特殊字符的非标志参数加双引号，解决文件名和提交信息含空格的问题
   */
  private execGit(
    cwd: string,
    args: string[],
  ): Promise<string> {
    const cp = this.getProcess()
    if (!cp) throw new Error("Node 环境不可用")
    const escaped = args.map(a => {
      // 子命令（第一个参数，如 add/commit/status）不需要引号
      // 标志参数（以 - 开头）和 -- 不需要引号
      // 其余参数若含空格则加双引号
      if (a.startsWith("-") || a === "--") return a
      if (/[\s"'$`\\]/.test(a)) return `"${a.replace(/"/g, '\\"')}"`
      return a
    })
    const cmd = `git ${escaped.join(" ")}`
    // 诊断日志：stage/unstage/status 操作
    const isStageOp = /^(add|reset|status)/.test(args[0] || "")
    if (isStageOp) console.log(`[gitPush:execGit] cwd=${cwd} cmd=${cmd}`)

    return new Promise((resolve, reject) => {
      cp.exec(
        cmd,
        { cwd, timeout: 30000, encoding: "utf8" },
        (error: any, stdout: string, stderr: string) => {
          if (isStageOp) console.log(`[gitPush:execGit] stdout=${stdout?.substring(0, 200)} stderr=${stderr?.substring(0, 200)}`)
          if (error) {
            if (isStageOp) console.error(`[gitPush:execGit] ERROR:`, error.message, stderr)
            reject(new Error(stderr || error.message))
          } else {
            // 只移除末尾换行符，保留前导空格/缩进
            // 否则 git status --porcelain 首行 " M file" 会被 trim 成 "M file"，误判为已暂存
            resolve(stdout.replace(/[\r\n]+$/, ""))
          }
        },
      )
    })
  }

  /**
   * 获取工作区变更状态（git status --porcelain -b）
   */
  async getWorkingTreeStatus(projectPath: string): Promise<WorkingTreeInfo> {
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
      // 先获取分支名
      branch = await this.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return empty
    }

    try {
      // Windows 上 child_process.exec 修改 .git/index 后 OS 文件缓存可能未刷盘，
      // 先执行 update-index --refresh 强制 git 重新 stat index 中的所有条目，
      // 确保后续 status 读到最新的暂存区状态
      await this.execGit(projectPath, ["update-index", "--refresh", "-q"]).catch(() => {})
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
