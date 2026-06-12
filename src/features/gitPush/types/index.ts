import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { getNodeProcessModules } from "@/utils/nodeModules"
import type { GitProject, GitRemoteInfo, PushStatusInfo, RemotePushStatus } from "./storage"
import { GitPushStorage } from "./storage"
import GitPushPanel from "../index.vue"

export type { GitProject, GitRemoteInfo, PushStatusInfo, RemotePushStatus }

export class GitPushManager {
  private plugin: Plugin
  storage: GitPushStorage

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new GitPushStorage(plugin)
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
  async addProject(name: string, path: string): Promise<GitProject> {
    const projects = await this.getProjects()
    const project: GitProject = {
      id: Date.now().toString(),
      name,
      path,
      addedAt: Date.now(),
    }
    // 自动检测远程仓库
    const remotes = await this.detectRemotes(path)
    for (const r of remotes) {
      if (r.isGithub) project.githubRemote = r.name
      if (r.isGitee) project.giteeRemote = r.name
    }
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
    const remotes = await this.detectRemotes(project.path)
    project.githubRemote = undefined
    project.giteeRemote = undefined
    for (const r of remotes) {
      if (r.isGithub) project.githubRemote = r.name
      if (r.isGitee) project.giteeRemote = r.name
    }
    await this.storage.projects.save(projects)
    return project
  }

  /**
   * 检测项目目录下所有 git 远程仓库
   */
  async detectRemotes(projectPath: string): Promise<GitRemoteInfo[]> {
    const proc = getNodeProcessModules()
    if (!proc) return []

    try {
      const { child_process } = proc
      const remotes = await this.execGit(child_process, projectPath, ["remote", "-v"])
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
   * 推送项目到所有已配置的远程仓库
   * @returns {{ success: boolean, outputs: { remote: string, stdout: string, stderr: string, ok: boolean }[] }}
   */
  async pushProject(id: string): Promise<{
    success: boolean
    outputs: { remote: string; stdout: string; stderr: string; ok: boolean }[]
  }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return { success: false, outputs: [] }
    }

    const proc = getNodeProcessModules()
    if (!proc) {
      return { success: false, outputs: [] }
    }

    const { child_process } = proc
    const outputs: { remote: string; stdout: string; stderr: string; ok: boolean }[] = []
    const remotesToPush: string[] = []

    const remotes = await this.detectRemotes(project.path)
    for (const r of remotes) {
      if (r.isGithub || r.isGitee) {
        remotesToPush.push(r.name)
      }
    }

    // 如果没有明确检测到，使用本地分支的默认远程
    if (remotesToPush.length === 0) {
      try {
        const branch = await this.execGit(child_process, project.path, ["rev-parse", "--abbrev-ref", "HEAD"])
        if (branch) {
          remotesToPush.push("origin")
        }
      } catch {
        // 忽略
      }
    }

    for (const remote of remotesToPush) {
      try {
        const stdout = await this.execGit(child_process, project.path, ["push", remote, "--all"])
        outputs.push({ remote, stdout: stdout || "", stderr: "", ok: true })
      } catch (e: any) {
        outputs.push({
          remote,
          stdout: "",
          stderr: e?.message || String(e),
          ok: false,
        })
      }
    }

    const allOk = outputs.every(o => o.ok) && outputs.length > 0
    return { success: allOk, outputs }
  }

  /**
   * 推送项目到指定远程（同时推送 GitHub 和 Gitee）
   */
  async pushToBoth(id: string): Promise<{
    success: boolean
    github: { ok: boolean; stdout: string; stderr: string }
    gitee: { ok: boolean; stdout: string; stderr: string }
  }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return {
        success: false,
        github: { ok: false, stdout: "", stderr: "项目未找到" },
        gitee: { ok: false, stdout: "", stderr: "项目未找到" },
      }
    }

    const proc = getNodeProcessModules()
    if (!proc) {
      return {
        success: false,
        github: { ok: false, stdout: "", stderr: "Node 环境不可用" },
        gitee: { ok: false, stdout: "", stderr: "Node 环境不可用" },
      }
    }

    const { child_process } = proc
    const github: { ok: boolean; stdout: string; stderr: string } = { ok: false, stdout: "", stderr: "" }
    const gitee: { ok: boolean; stdout: string; stderr: string } = { ok: false, stdout: "", stderr: "" }

    const remote = project.githubRemote || "github"
    try {
      github.stdout = await this.execGit(child_process, project.path, ["push", remote, "--all"]) || ""
      github.ok = true
    } catch (e: any) {
      github.stderr = e?.message || String(e)
    }

    const remote2 = project.giteeRemote || "gitee"
    try {
      gitee.stdout = await this.execGit(child_process, project.path, ["push", remote2, "--all"]) || ""
      gitee.ok = true
    } catch (e: any) {
      gitee.stderr = e?.message || String(e)
    }

    return { success: github.ok || gitee.ok, github, gitee }
  }

  /**
   * 推送项目到单个远程仓库
   */
  async pushSingle(
    id: string,
    target: "github" | "gitee",
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return { ok: false, stdout: "", stderr: "项目未找到" }
    }

    const proc = getNodeProcessModules()
    if (!proc) {
      return { ok: false, stdout: "", stderr: "Node 环境不可用" }
    }

    const remoteName = target === "github" ? (project.githubRemote || "github") : (project.giteeRemote || "gitee")
    const { child_process } = proc

    try {
      const stdout = await this.execGit(child_process, project.path, ["push", remoteName, "--all"]) || ""
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

    const proc = getNodeProcessModules()
    if (!proc) return emptyResult

    const { child_process } = proc
    const status: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    try {
      // 获取当前分支
      status.branch = await this.execGit(child_process, project.path, ["rev-parse", "--abbrev-ref", "HEAD"])
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

    for (const { key, remoteName } of remotesToCheck) {
      try {
        // 尝试检查远程分支是否存在
        await this.execGit(child_process, project.path, [
          "rev-parse",
          "--verify",
          `${remoteName}/${status.branch}`,
        ])

        // 远程分支存在，比较 ahead/behind
        const counts = await this.execGit(child_process, project.path, [
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
        const totalCommits = await this.execGit(child_process, project.path, [
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
   * 检查项目路径是否有效（目录存在且是 git 仓库）
   */
  async checkIsGitRepo(projectPath: string): Promise<boolean> {
    const proc = getNodeProcessModules()
    if (!proc) return false
    try {
      const { child_process } = proc
      await this.execGit(child_process, projectPath, ["rev-parse", "--is-inside-work-tree"])
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
    remotes: GitRemoteInfo[]
  }> {
    const projects = await this.getProjects()
    const project = projects.find(p => p.id === id)
    if (!project) {
      return { canPush: false, github: false, gitee: false, remotes: [] }
    }

    const remotes = await this.detectRemotes(project.path)
    const github = remotes.some(r => r.isGithub)
    const gitee = remotes.some(r => r.isGitee)
    return { canPush: github || gitee, github, gitee, remotes }
  }

  /**
   * 执行 git 命令
   */
  private execGit(
    child_process: any,
    cwd: string,
    args: string[],
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.exec(
        `git ${args.join(" ")}`,
        { cwd, timeout: 30000 },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(stderr || error.message))
          } else {
            resolve(stdout.trim())
          }
        },
      )
    })
  }

  destroy() {
    // 清理资源
  }
}
