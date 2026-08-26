// Git 项目增删改查与持久化存储
import type {
  GitProject,
  GitPushManager,
  ProjectCategory,
  ProjectPathExtras,
} from "../types"
import { ref } from "vue"
import { showMessage } from "siyuan"
import { findProject, findProjectIndex, getAllProjectPathsForDedup, normalizePathForDedup } from "../utils"
import { UNGROUPED_ID } from "../types"
import { getErrorMessage } from "@/utils/stringUtils"

export function useProjectCrud(manager: GitPushManager) {
  const projects = ref<GitProject[]>([])
  const categories = ref<ProjectCategory[]>([])
  const allTags = ref<string[]>([])

  async function loadProjects() {
    categories.value = await manager.getCategories()
    projects.value = await manager.getProjects()
    allTags.value = await manager.getAllTags()
  }

  async function addProject(name: string, path: string, categoryId = UNGROUPED_ID, tags?: string[], extras?: ProjectPathExtras) {
    // 查重覆盖新旧项目的全部路径（主路径 + localPaths），防止跨设备副本重复添加
    const newPaths = [path, ...(extras?.localPaths || [])].map(normalizePathForDedup)
    const dup = projects.value.find((p) =>
      getAllProjectPathsForDedup(p).some((ep) => newPaths.includes(ep)),
    )
    if (dup) {
      throw new Error(`项目路径已存在："${dup.name}"（${dup.path}）`)
    }
    const project = await manager.addProject(name, path, categoryId, tags, extras)
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
    const idx = findProjectIndex(projects, id)
    if (idx === -1) return
    projects.value[idx] = { ...projects.value[idx], ...patch }
    projects.value = [...projects.value]
  }

  async function updateProjectMeta(id: string, patch: Partial<Pick<GitProject, "name" | "path" | "tags" | "starred" | "archived" | "note" | "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl" | "localPaths" | "pathDevices">>) {
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

  async function refreshRemotes(id: string) {
    const updated = await manager.refreshRemotes(id)
    if (updated) {
      const idx = findProjectIndex(projects, id)
      if (idx !== -1) {
        projects.value[idx] = updated
        projects.value = [...projects.value]
      }
    }
    return updated
  }

  // ── 分类操作 ──
  async function addCategory(name: string, color?: string) {
    const cat = await manager.addCategory(name, color)
    categories.value = [...categories.value, cat]
    return cat
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
    allTags,
    loadProjects,
    addProject,
    removeProject,
    updateProjectMeta,
    toggleStar,
    refreshRemotes,
    addCategory,
    deleteCategory,
    moveProject,
  }
}
