// 项目/分类/标签的持久化 CRUD 与内存缓存
import type {
  GitProject,
  GitRemoteInfo,
  ProjectCategory,
  ProjectStatus,
} from "../types/storage"
import { UNGROUPED_ID } from "../types/storage"
import type { GitPushStorage } from "../types/storage"
import type { GitExecutor } from "./GitExecutor"
import { resolveValidPath } from "../utils"

/** 递增计数器（与时间戳组合成唯一 ID，避免同毫秒碰撞） */
let idCounter = 0

export class ProjectStore {
  private storage: GitPushStorage
  private executor: GitExecutor
  /** 项目内存缓存：id → GitProject（避免每次全量反序列化） */
  private projectCache: Map<string, GitProject> = new Map()
  /** 全量项目列表缓存（null 表示未初始化） */
  private projectsCache: GitProject[] | null = null

  constructor(storage: GitPushStorage, executor: GitExecutor) {
    this.storage = storage
    this.executor = executor
  }

  /**
   * 获取所有已保存的项目（带内存缓存）
   */
  async getProjects(): Promise<GitProject[]> {
    if (this.projectsCache !== null) { return this.projectsCache }
    const projects = await this.storage.projects.loadOrDefault()
    this.projectsCache = projects
    this.projectCache.clear()
    for (const p of projects) { this.projectCache.set(p.id, p) }
    return projects
  }

  /**
   * 按 ID 获取单个项目（优先内存缓存，避免全量反序列化 + 遍历）
   */
  async getProjectById(id: string): Promise<GitProject | undefined> {
    // 先查缓存
    if (this.projectsCache !== null) {
      return this.projectCache.get(id)
    }
    // 缓存未初始化则全量加载
    await this.getProjects()
    return this.projectCache.get(id)
  }

  /** 清空全部项目缓存（写操作后调用以保证一致性） */
  invalidateProjectCache(): void {
    this.projectsCache = null
    this.projectCache.clear()
  }

  /**
   * 添加项目映射
   */
  async addProject(name: string, path: string, categoryId = UNGROUPED_ID, tags?: string[]): Promise<GitProject> {
    const projects = await this.getProjects()
    idCounter++
    const project: GitProject = {
      id: `${Date.now().toString(36)}-${idCounter}`,
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
    this.invalidateProjectCache()
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
      this.invalidateProjectCache()
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
    this.invalidateProjectCache()
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
    this.invalidateProjectCache()
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
      this.invalidateProjectCache()
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
      this.invalidateProjectCache()
      await this.syncGlobalTags()
    }
    return project
  }

  /** 记录最后活动时间 */
  async recordLastActivity(id: string, isoTime: string): Promise<void> {
    const projects = await this.getProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) return
    project.lastActivity = isoTime
    await this.storage.projects.save(projects)
    this.invalidateProjectCache()
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
    this.invalidateProjectCache()
    return project
  }

  /** 将检测到的远程仓库信息应用到项目对象（仅管理远程名称，不触碰用户手动输入的仓库链接） */
  private applyRemotesToProject(project: GitProject, remotes: GitRemoteInfo[]) {
    // 只清空远程名称字段（git 操作依赖），仓库链接 xxxUrl 由用户手动管理，不受检测覆盖
    project.githubRemote = undefined
    project.giteeRemote = undefined
    project.giteaRemote = undefined
    project.cnbRemote = undefined
    const patch: Partial<GitProject> = {}
    for (const r of remotes) {
      if (r.isGithub && !patch.githubRemote) { patch.githubRemote = r.name }
      if (r.isGitee && !patch.giteeRemote) { patch.giteeRemote = r.name }
      if (r.isGitea && !patch.giteaRemote) { patch.giteaRemote = r.name }
      if (r.isCnb && !patch.cnbRemote) { patch.cnbRemote = r.name }
    }
    if (Object.keys(patch).length > 0) {
      Object.assign(project, patch)
    }
  }

  /**
   * 检测项目目录下所有 git 远程仓库
   */
  async detectRemotes(projectPath: string): Promise<GitRemoteInfo[]> {
    try {
      const remotes = await this.executor.execGit(projectPath, ["remote", "-v"])
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
            const isGitea = lowerUrl.includes("gitea.") || lowerName === "gitea"
            result.push({
              name,
              url,
              isGithub,
              isGitee,
              isCnb,
              isGitea: isGitea && !isGithub && !isGitee && !isCnb,
            })
          }
        }
      }
      return result
    } catch {
      return []
    }
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
    if (!cat || id === UNGROUPED_ID) return
    if (data.name !== undefined) cat.name = data.name
    if (data.color !== undefined) cat.color = data.color
    await this.storage.categories.save(cats)
  }

  async deleteCategory(id: string): Promise<void> {
    if (id === UNGROUPED_ID) return
    const cats = await this.getCategories()
    const idx = cats.findIndex((c) => c.id === id)
    if (idx === -1) return
    cats.splice(idx, 1)
    await this.storage.categories.save(cats)

    const projs = await this.getProjects()
    let changed = false
    for (const p of projs) {
      if (p.categoryId === id) { p.categoryId = UNGROUPED_ID; changed = true }
    }
    if (changed) {
      await this.storage.projects.save(projs)
      this.invalidateProjectCache()
    }
  }

  async moveProject(projectId: string, categoryId: string): Promise<void> {
    const projs = await this.getProjects()
    const p = projs.find((x) => x.id === projectId)
    if (!p) return
    p.categoryId = categoryId
    await this.storage.projects.save(projs)
    this.invalidateProjectCache()
  }
}
