import type { GitProject, PushStatusInfo, WorkingTreeInfo, ProjectCategory } from "../types"
import type { GitPushManager } from "../types"
import { ref, computed } from "vue"

export function useGitPush(manager: GitPushManager) {
  const projects = ref<GitProject[]>([])
  const categories = ref<ProjectCategory[]>([])
  const loading = ref(false)
  /** 正在推送的项目 id → "github"|"gitee"|"both" */
  const pushingRemote = ref<Record<string, string>>({})
  const pushOutputs = ref<Record<string, string>>({})
  /** 项目推送状态缓存 id → PushStatusInfo */
  const pushStatuses = ref<Record<string, PushStatusInfo>>({})
  /** 工作区状态缓存 id → WorkingTreeInfo */
  const workingTrees = ref<Record<string, WorkingTreeInfo>>({})
  /** 文件差异缓存 key="${id}::${staged}::${path}" → diff 文本 */
  const fileDiffs = ref<Record<string, string>>({})
  /** 正在提交的项目 id → true */
  const committing = ref<Record<string, boolean>>({})

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => {
    const map = new Map<string, { category: ProjectCategory; projects: GitProject[] }>()
    // 初始化所有分类
    for (const cat of categories.value) {
      map.set(cat.id, { category: cat, projects: [] })
    }
    // 分配项目
    for (const p of projects.value) {
      const group = map.get(p.categoryId)
      if (group) {
        group.projects.push(p)
      } else {
        // 分类不存在，回退到未分组
        const ungrouped = map.get("__ungrouped__")
        if (ungrouped) ungrouped.projects.push(p)
      }
    }
    // 排序并过滤空分组
    return [...map.values()]
      .filter(g => g.projects.length > 0)
      .sort((a, b) => a.category.order - b.category.order)
  })

  function isPushing(projectId: string, target?: string): boolean {
    const v = pushingRemote.value[projectId]
    if (!v) return false
    if (target) return v === target
    return true
  }

  async function loadProjects() {
    loading.value = true
    try {
      categories.value = await manager.getCategories()
      projects.value = await manager.getProjects()
      // 自动检测所有项目的推送状态
      for (const p of projects.value) {
        loadPushStatus(p.id)
      }
    } finally {
      loading.value = false
    }
  }

  async function addProject(name: string, path: string, categoryId = "__ungrouped__") {
    const project = await manager.addProject(name, path, categoryId)
    projects.value = [...projects.value, project]
    return project
  }

  async function removeProject(id: string) {
    await manager.removeProject(id)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  async function refreshRemotes(id: string) {
    const updated = await manager.refreshRemotes(id)
    if (updated) {
      const idx = projects.value.findIndex(p => p.id === id)
      if (idx !== -1) {
        projects.value[idx] = updated
        projects.value = [...projects.value]
      }
    }
    return updated
  }

  async function pushToAll(id: string) {
    pushingRemote.value[id] = "all"
    try {
      const result = await manager.pushToAll(id)
      const lines: string[] = []
      lines.push(`[GitHub] ${result.github.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (result.github.stdout) lines.push(result.github.stdout)
      if (result.github.stderr) lines.push(`错误: ${result.github.stderr}`)
      lines.push(`[Gitee] ${result.gitee.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (result.gitee.stdout) lines.push(result.gitee.stdout)
      if (result.gitee.stderr) lines.push(`错误: ${result.gitee.stderr}`)
      lines.push(`[Gitea] ${result.gitea.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (result.gitea.stdout) lines.push(result.gitea.stdout)
      if (result.gitea.stderr) lines.push(`错误: ${result.gitea.stderr}`)
      pushOutputs.value[id] = lines.join("\n")
      // 推送后刷新状态
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pushSingle(id: string, target: "github" | "gitee" | "gitea") {
    pushingRemote.value[id] = target
    try {
      const result = await manager.pushSingle(id, target)
      const label = target === "github" ? "GitHub" : target === "gitee" ? "Gitee" : "Gitea"
      const lines: string[] = []
      lines.push(`[${label}] ${result.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (result.stdout) lines.push(result.stdout)
      if (result.stderr) lines.push(`错误: ${result.stderr}`)
      pushOutputs.value[id] = lines.join("\n")
      // 推送后刷新状态
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function loadPushStatus(id: string) {
    pushStatuses.value[id] = await manager.checkPushStatus(id)
  }

  /** 加载工作区状态 */
  async function loadWorkingTree(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    workingTrees.value[id] = await manager.getWorkingTreeStatus(project.path)
  }

  /** 加载单个文件差异 */
  async function loadFileDiff(id: string, file: string, staged: boolean) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return ""
    const key = `${id}::${staged ? "s" : "u"}::${file}`
    const diff = await manager.getFileDiff(project.path, file, staged)
    fileDiffs.value[key] = diff
    return diff
  }

  /** 暂存单个文件 */
  async function stageItem(id: string, file: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    await manager.stageFile(project.path, file)
    await loadWorkingTree(id)
  }

  /** 暂存全部 */
  async function stageAllItems(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    await manager.stageAll(project.path)
    await loadWorkingTree(id)
  }

  /** 取消暂存单个文件 */
  async function unstageItem(id: string, file: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    await manager.unstageFile(project.path, file)
    await loadWorkingTree(id)
  }

  /** 取消全部暂存 */
  async function unstageAllItems(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return
    await manager.unstageAll(project.path)
    await loadWorkingTree(id)
  }

  /** 提交 */
  async function doCommit(id: string, message: string): Promise<string> {
    const project = projects.value.find(p => p.id === id)
    if (!project) throw new Error("项目未找到")
    committing.value[id] = true
    try {
      const result = await manager.commit(project.path, message)
      // 提交后刷新工作区状态和推送状态
      await loadWorkingTree(id)
      await loadPushStatus(id)
      return result
    } finally {
      delete committing.value[id]
    }
  }

  /** 自动生成提交信息 */
  async function generateCommitMsg(id: string): Promise<{ message: string; source: "ai" | "heuristic" }> {
    const project = projects.value.find(p => p.id === id)
    if (!project) return { message: "chore: update files", source: "heuristic" }
    return manager.generateCommitMessage(project.path)
  }

  /** 分类操作 */
  async function loadCategories() {
    categories.value = await manager.getCategories()
  }

  async function addCategory(name: string, color?: string) {
    const cat = await manager.addCategory(name, color)
    categories.value = [...categories.value, cat]
    return cat
  }

  async function updateCategory(id: string, data: { name?: string; color?: string }) {
    await manager.updateCategory(id, data)
    categories.value = categories.value.map(c => c.id === id ? { ...c, ...data } : c)
  }

  async function deleteCategory(id: string) {
    await manager.deleteCategory(id)
    categories.value = categories.value.filter(c => c.id !== id)
    // 受影响的项目 categoryId 已由 Manager 更新，重载项目
    projects.value = await manager.getProjects()
  }

  async function moveProject(projectId: string, categoryId: string) {
    await manager.moveProject(projectId, categoryId)
    projects.value = projects.value.map(p => p.id === projectId ? { ...p, categoryId } : p)
  }

  async function checkCanPush(id: string) {
    return manager.checkCanPushToCloud(id)
  }

  async function checkIsGitRepo(path: string) {
    return manager.checkIsGitRepo(path)
  }

  return {
    projects,
    categories,
    groupedProjects,
    loading,
    pushingRemote,
    isPushing,
    pushOutputs,
    pushStatuses,
    workingTrees,
    fileDiffs,
    committing,
    loadProjects,
    loadPushStatus,
    loadWorkingTree,
    loadFileDiff,
    stageItem,
    stageAllItems,
    unstageItem,
    unstageAllItems,
    doCommit,
    generateCommitMsg,
    addProject,
    removeProject,
    refreshRemotes,
    pushToAll,
    pushToBoth: pushToAll,
    pushSingle,
    checkCanPush,
    checkIsGitRepo,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    moveProject,
  }
}
