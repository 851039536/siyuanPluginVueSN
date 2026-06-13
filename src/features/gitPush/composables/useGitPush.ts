import type { GitProject, PushStatusInfo, WorkingTreeInfo } from "../types"
import type { GitPushManager } from "../types"
import { ref } from "vue"

export function useGitPush(manager: GitPushManager) {
  const projects = ref<GitProject[]>([])
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

  function isPushing(projectId: string, target?: string): boolean {
    const v = pushingRemote.value[projectId]
    if (!v) return false
    if (target) return v === target
    return true
  }

  async function loadProjects() {
    loading.value = true
    try {
      projects.value = await manager.getProjects()
      // 自动检测所有项目的推送状态
      for (const p of projects.value) {
        loadPushStatus(p.id)
      }
    } finally {
      loading.value = false
    }
  }

  async function addProject(name: string, path: string) {
    const project = await manager.addProject(name, path)
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

  async function pushToBoth(id: string) {
    pushingRemote.value[id] = "both"
    try {
      const result = await manager.pushToBoth(id)
      const lines: string[] = []
      lines.push(`[GitHub] ${result.github.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (result.github.stdout) lines.push(result.github.stdout)
      if (result.github.stderr) lines.push(`错误: ${result.github.stderr}`)
      lines.push(`[Gitee] ${result.gitee.ok ? "✅ 推送成功" : "❌ 推送失败"}`)
      if (result.gitee.stdout) lines.push(result.gitee.stdout)
      if (result.gitee.stderr) lines.push(`错误: ${result.gitee.stderr}`)
      pushOutputs.value[id] = lines.join("\n")
      // 推送后刷新状态
      loadPushStatus(id)
      return result
    } finally {
      delete pushingRemote.value[id]
    }
  }

  async function pushSingle(id: string, target: "github" | "gitee") {
    pushingRemote.value[id] = target
    try {
      const result = await manager.pushSingle(id, target)
      const label = target === "github" ? "GitHub" : "Gitee"
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
  async function generateCommitMsg(id: string): Promise<string> {
    const project = projects.value.find(p => p.id === id)
    if (!project) return "chore: update files"
    return manager.generateCommitMessage(project.path)
  }

  async function checkCanPush(id: string) {
    return manager.checkCanPushToCloud(id)
  }

  async function checkIsGitRepo(path: string) {
    return manager.checkIsGitRepo(path)
  }

  return {
    projects,
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
    pushToBoth,
    pushSingle,
    checkCanPush,
    checkIsGitRepo,
  }
}
