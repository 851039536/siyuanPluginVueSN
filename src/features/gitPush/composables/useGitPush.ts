import type { GitProject, PushStatusInfo } from "../types"
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
    loadProjects,
    loadPushStatus,
    addProject,
    removeProject,
    refreshRemotes,
    pushToBoth,
    pushSingle,
    checkCanPush,
    checkIsGitRepo,
  }
}
