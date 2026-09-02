// 项目/分类/标签的持久化 CRUD 与内存缓存
import type {
  GitProject,
  GitPushStorage,
  GitRemoteInfo,
  ProjectCategory,
  ProjectPathExtras,
} from "../types/storage"
import type { GitExecutor } from "./GitExecutor"
import { ProjectWriteLock } from "./ProjectWriteLock"
import { PLATFORM_META } from "../types/meta"
import { UNGROUPED_ID } from "../types/storage"
import {
  getCurrentDeviceName,
  PLATFORM_FLAG_BY_KEY,
  resolveValidPath,
} from "../utils"

/** 递增计数器（与时间戳组合成唯一 ID，避免同毫秒碰撞） */
let idCounter = 0

export class ProjectStore {
  private storage: GitPushStorage
  private executor: GitExecutor
  /** 项目内存缓存：id → GitProject（避免每次全量反序列化） */
  private projectCache: Map<string, GitProject> = new Map()
  /** 全量项目列表缓存（null 表示未初始化） */
  private projectsCache: GitProject[] | null = null
  /** 项目写操作串行链（防止并发 mutate 的 lost update：后写覆盖先写） */
  private writeLock = new ProjectWriteLock()

  constructor(storage: GitPushStorage, executor: GitExecutor) {
    this.storage = storage
    this.executor = executor
  }

  /** 项目写操作串行化：读改写全程（mutateProject → saveProjects）在单一 Promise 链上排队 */
  private serializeWrite<T>(fn: () => Promise<T>): Promise<T> {
    return this.writeLock.runExclusive("projects", fn)
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

  /** 获取项目列表的可写浅克隆副本（写操作基于此，避免污染缓存 + save 失败时缓存不变脏） */
  private async getProjectsForWrite(): Promise<GitProject[]> {
    const projects = await this.getProjects()
    return projects.map((p) => ({ ...p }))
  }

  /**
   * 统一「找项目 → mutate → 决定是否保存」流程，消除各写方法的 find/save/invalidate 重复。
   * mutate 返回是否实际修改（false 表示无需持久化，如 appendTag 去重后无变化）
   */
  private async mutateProject(id: string, mutate: (p: GitProject) => boolean): Promise<{ projects: GitProject[], project: GitProject, changed: boolean } | null> {
    const projects = await this.getProjectsForWrite()
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    const changed = mutate(project)
    return {
      projects,
      project,
      changed,
    }
  }

  /** 持久化并失效缓存（mutateProject 后统一调用） */
  private async saveProjects(projects: GitProject[]): Promise<void> {
    await this.storage.projects.save(projects)
    this.invalidateProjectCache()
  }

  /** 清空全部项目缓存（写操作后调用以保证一致性） */
  invalidateProjectCache(): void {
    this.projectsCache = null
    this.projectCache.clear()
  }

  /**
   * 添加项目映射
   */
  async addProject(name: string, path: string, categoryId = UNGROUPED_ID, tags?: string[], extras?: ProjectPathExtras): Promise<GitProject> {
    return this.serializeWrite(async () => {
      const projects = await this.getProjectsForWrite()
      idCounter++
      // 主路径无设备标注时自动补当前电脑名（与编辑弹窗新增路径行为对称）
      const pathDevices = { ...(extras?.pathDevices || {}) }
      if (!pathDevices[path]) {
        const device = getCurrentDeviceName()
        if (device) { pathDevices[path] = device }
      }
      const project: GitProject = {
        id: `${Date.now().toString(36)}-${idCounter}`,
        name,
        path,
        categoryId,
        addedAt: Date.now(),
        tags: tags && tags.length > 0 ? tags : undefined,
        archived: false,
        starred: false,
        localPaths: extras?.localPaths?.length ? extras.localPaths : undefined,
        pathDevices: Object.keys(pathDevices).length > 0 ? pathDevices : undefined,
      }
      this.applyRemotesToProject(project, await this.detectRemotes(path))
      projects.push(project)
      await this.storage.projects.save(projects)
      this.invalidateProjectCache()
      if (tags && tags.length > 0) await this.syncGlobalTags()
      return project
    })
  }

  /**
   * 删除项目映射
   */
  async removeProject(id: string): Promise<void> {
    await this.serializeWrite(async () => {
      const projects = await this.getProjectsForWrite()
      const idx = projects.findIndex((p) => p.id === id)
      if (idx !== -1) {
        projects.splice(idx, 1)
        await this.storage.projects.save(projects)
        this.invalidateProjectCache()
        await this.syncGlobalTags()
      }
    })
  }

  /**
   * 更新项目元信息
   */
  async updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "path" | "tags" | "starred" | "archived" | "note" | "name" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths" | "pathDevices">>): Promise<GitProject | null> {
    return this.serializeWrite(async () => {
      // patch 中的数组/对象先浅拷贝：避免 Object.assign 后项目与调用方 patch 共享引用，外部改动穿透污染缓存
      const normalized: typeof patch = { ...patch }
      if (patch.tags) normalized.tags = [...patch.tags]
      if (patch.localPaths) normalized.localPaths = [...patch.localPaths]
      if (patch.pathDevices) normalized.pathDevices = { ...patch.pathDevices }
      const r = await this.mutateProject(id, (project) => {
        Object.assign(project, normalized)
        return true
      })
      if (!r) return null
      await this.saveProjects(r.projects)
      if (patch.tags !== undefined) await this.syncGlobalTags()
      return r.project
    })
  }

  /** 切换收藏状态 */
  async toggleStar(id: string): Promise<GitProject | null> {
    return this.serializeWrite(async () => {
      const r = await this.mutateProject(id, (project) => {
        project.starred = !project.starred
        return true
      })
      if (!r) return null
      await this.saveProjects(r.projects)
      return r.project
    })
  }

  /** 添加标签（去重） */
  async appendTag(id: string, tag: string): Promise<GitProject | null> {
    const t = tag.trim()
    if (!t) return null
    return this.serializeWrite(async () => {
      const r = await this.mutateProject(id, (project) => {
        const tags = project.tags || []
        if (tags.includes(t)) return false
        project.tags = [...tags, t]
        return true
      })
      if (!r) return null
      if (r.changed) {
        await this.saveProjects(r.projects)
        await this.syncGlobalTags()
      }
      return r.project
    })
  }

  /** 移除标签 */
  async removeTag(id: string, tag: string): Promise<GitProject | null> {
    return this.serializeWrite(async () => {
      const r = await this.mutateProject(id, (project) => {
        if (!project.tags) return false
        project.tags = project.tags.filter((t) => t !== tag)
        if (project.tags.length === 0) project.tags = undefined
        return true
      })
      if (!r) return null
      if (r.changed) {
        await this.saveProjects(r.projects)
        await this.syncGlobalTags()
      }
      return r.project
    })
  }

  /** 记录最后活动时间 */
  async recordLastActivity(id: string, isoTime: string): Promise<void> {
    await this.serializeWrite(async () => {
      const r = await this.mutateProject(id, (project) => {
        project.lastActivity = isoTime
        return true
      })
      if (!r) return
      await this.saveProjects(r.projects)
    })
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

  /** 重新检测项目远程仓库并更新（path 缺省时按项目持久化路径检测） */
  async refreshRemotes(id: string, path?: string): Promise<GitProject | null> {
    return this.serializeWrite(async () => {
      const r = await this.mutateProject(id, () => true)
      if (!r) return null
      this.applyRemotesToProject(r.project, await this.detectRemotes(path || resolveValidPath(r.project)))
      await this.saveProjects(r.projects)
      return r.project
    })
  }

  /** 将已检测的远程列表写入项目（避免调用方为"按指定路径刷新"重复执行 git remote -v） */
  async applyRemotes(id: string, remotes: GitRemoteInfo[]): Promise<GitProject | null> {
    return this.serializeWrite(async () => {
      const r = await this.mutateProject(id, () => true)
      if (!r) return null
      this.applyRemotesToProject(r.project, remotes)
      await this.saveProjects(r.projects)
      return r.project
    })
  }

  /** 将检测到的远程仓库信息应用到项目对象（仅管理远程名称，不触碰用户手动输入的仓库链接） */
  private applyRemotesToProject(project: GitProject, remotes: GitRemoteInfo[]) {
    // 只清空远程名称字段（git 操作依赖），仓库链接 xxxUrl 由用户手动管理，不受检测覆盖
    for (const pm of PLATFORM_META) {
      project[pm.remoteProp] = undefined
    }
    // 由 PLATFORM_META 驱动：每个平台取首个检测标志命中的远程名（消除 4 连 if 重复）
    for (const pm of PLATFORM_META) {
      const flagProp = PLATFORM_FLAG_BY_KEY[pm.key]
      const remote = remotes.find((r) => r[flagProp])
      if (remote) {
        project[pm.remoteProp] = remote.name
      }
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
    idCounter++
    const cat: ProjectCategory = {
      id: `${Date.now().toString(36)}-${idCounter}`,
      name,
      color,
      order: cats.length,
    }
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
    await this.serializeWrite(async () => {
      const cats = await this.getCategories()
      const idx = cats.findIndex((c) => c.id === id)
      if (idx === -1) return
      cats.splice(idx, 1)
      await this.storage.categories.save(cats)

      const projs = await this.getProjectsForWrite()
      let changed = false
      for (const p of projs) {
        if (p.categoryId === id) { p.categoryId = UNGROUPED_ID; changed = true }
      }
      if (changed) {
        await this.storage.projects.save(projs)
        this.invalidateProjectCache()
      }
    })
  }

  async moveProject(projectId: string, categoryId: string): Promise<void> {
    // 目标分类不存在时不移动（UNGROUPED_ID 恒有效），维持"项目分类始终指向有效分类或未分组"不变式
    if (categoryId !== UNGROUPED_ID) {
      const cats = await this.getCategories()
      if (!cats.some((c) => c.id === categoryId)) return
    }
    await this.serializeWrite(async () => {
      const projs = await this.getProjectsForWrite()
      const p = projs.find((x) => x.id === projectId)
      if (!p || p.categoryId === categoryId) return
      p.categoryId = categoryId
      await this.storage.projects.save(projs)
      this.invalidateProjectCache()
    })
  }
}
