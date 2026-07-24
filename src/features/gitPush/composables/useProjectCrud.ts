// Git 项目增删改查与持久化存储
import type {
  GitProject,
  GitPushManager,
  ProjectCategory,
} from "../types"
import { ref } from "vue"
import { showMessage } from "siyuan"
import { findProject, normalizePathForDedup } from "../utils"
import { UNGROUPED_ID } from "../types"
import { getErrorMessage } from "@/utils/stringUtils"

export function useProjectCrud(manager: GitPushManager) {
  const projects = ref<GitProject[]>([])
  const categories = ref<ProjectCategory[]>([])
  const loading = ref(false)
  const allTags = ref<string[]>([])

  async function loadProjects() {
    loading.value = true
    try {
      categories.value = await manager.getCategories()
      projects.value = await manager.getProjects()
      allTags.value = await manager.getAllTags()
    } finally {
      loading.value = false
    }
  }

  async function addProject(name: string, path: string, categoryId = UNGROUPED_ID, tags?: string[]) {
    const normalized = normalizePathForDedup(path)
    const dup = projects.value.find((p) => normalizePathForDedup(p.path) === normalized)
    if (dup) {
      throw new Error(`项目路径已存在："${dup.name}"（${dup.path}）`)
    }
    const project = await manager.addProject(name, path, categoryId, tags)
    projects.value = [...projects.value, project]
    if (tags && tags.length > 0) allTags.value = await manager.getAllTags()
    return project
  }

  async function removeProject(id: string) {
    await manager.removeProject(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    allTags.value = await manager.getAllTags()
  }

  /** 本地更新单个项目并触发响应式 */
  function patchProject(id: string, patch: Partial<GitProject>) {
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx === -1) return
    projects.value[idx] = { ...projects.value[idx], ...patch }
    projects.value = [...projects.value]
  }

  async function updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "name" | "tags" | "starred" | "status" | "archived" | "note" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths">>) {
    const updated = await manager.updateProjectMeta(id, patch)
    if (updated) {
      patchProject(id, patch)
      if (patch.tags !== undefined) allTags.value = await manager.getAllTags()
    }
    return updated
  }

  /** 切换收藏（高频操作，乐观更新 + 失败回滚） */
  async function toggleStar(id: string) {
    const project = findProject(projects, id)
    if (!project) return
    const prev = project.starred
    patchProject(id, { starred: !prev })
    try {
      await manager.toggleStar(id)
    } catch (e: unknown) {
      patchProject(id, { starred: prev })
      showMessage(`收藏操作失败: ${getErrorMessage(e) || "未知错误"}`, 3000, "error")
    }
  }

  async function setProjectStatus(id: string, status: GitProject["status"]) {
    if (!status) return
    const project = findProject(projects, id)
    const prev = project?.status
    patchProject(id, { status })
    try {
      await manager.setProjectStatus(id, status)
    } catch (e: unknown) {
      if (prev) patchProject(id, { status: prev })
      showMessage(`状态更新失败: ${getErrorMessage(e) || "未知错误"}`, 3000, "error")
    }
  }

  async function appendTag(id: string, tag: string) {
    const updated = await manager.appendTag(id, tag)
    if (updated) {
      patchProject(id, { tags: updated.tags })
      allTags.value = await manager.getAllTags()
    }
    return updated
  }

  async function removeTag(id: string, tag: string) {
    const updated = await manager.removeTag(id, tag)
    if (updated) {
      patchProject(id, { tags: updated.tags })
      allTags.value = await manager.getAllTags()
    }
    return updated
  }

  async function refreshRemotes(id: string) {
    const updated = await manager.refreshRemotes(id)
    if (updated) {
      const idx = projects.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        projects.value[idx] = updated
        projects.value = [...projects.value]
      }
    }
    return updated
  }

  // ── 分类操作 ──
  async function loadCategories() {
    categories.value = await manager.getCategories()
  }

  async function addCategory(name: string, color?: string) {
    const cat = await manager.addCategory(name, color)
    categories.value = [...categories.value, cat]
    return cat
  }

  async function updateCategory(id: string, data: { name?: string, color?: string }) {
    await manager.updateCategory(id, data)
    categories.value = categories.value.map((c) =>
      c.id === id ? { ...c, ...data } : c,
    )
  }

  async function deleteCategory(id: string) {
    await manager.deleteCategory(id)
    categories.value = categories.value.filter((c) => c.id !== id)
    projects.value = projects.value.map((p) =>
      p.categoryId === id ? { ...p, categoryId: UNGROUPED_ID } : p,
    )
  }

  async function moveProject(projectId: string, categoryId: string) {
    await manager.moveProject(projectId, categoryId)
    projects.value = projects.value.map((p) =>
      p.id === projectId ? { ...p, categoryId } : p,
    )
  }

  return {
    projects,
    categories,
    loading,
    allTags,
    loadProjects,
    addProject,
    removeProject,
    updateProjectMeta,
    toggleStar,
    setProjectStatus,
    appendTag,
    removeTag,
    refreshRemotes,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    moveProject,
  }
}
