/**
 * 速记功能 — 项目跟进 composable
 * 承载项目条目的响应式列表与 CRUD、关联待办进度计算（已完成数/总数）、卡住项目筛选
 */
import type { Ref } from "vue"
import type { AppData, ProjectItem, TodoItem } from "../types"
import type { QuickNoteStorage } from "../types/storage"
import { computed, ref } from "vue"
import { createPersistLock, generateId } from "../utils"

export function useProjects(storage: QuickNoteStorage, todosRef?: Ref<TodoItem[]>) {
  const projects: Ref<ProjectItem[]> = ref([])

  /** 从存储加载全部项目 */
  const load = async () => {
    const data = await storage.data.loadOrDefault()
    projects.value = data.projects
  }

  /**
   * 持久化当前项目列表（串行锁防止快速连续操作时 read-modify-write 读到旧数据）
   * todos 参数用于跨槽写入：删除项目时需同时落盘待办的 projectId 置空，缺省仅写 projects
   */
  const persist = createPersistLock(storage.data, (data, todos?: TodoItem[]) => {
    const payload: AppData = { ...data, projects: projects.value }
    if (todos !== undefined) {
      payload.todos = todos
    }
    return payload
  })

  /** 新增项目 */
  const add = async (partial: Omit<ProjectItem, "id" | "createdAt" | "updatedAt">) => {
    const name = partial.name.trim()
    if (!name) return
    const now = Date.now()
    const item: ProjectItem = {
      ...partial,
      name,
      currentStep: partial.currentStep.trim(),
      nextStep: partial.nextStep.trim(),
      blockers: partial.blockers.trim(),
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    projects.value = [item, ...projects.value]
    await persist()
  }

  /** 更新项目（文本字段与新增模式一致做 trim） */
  const update = async (id: string, patch: Partial<Omit<ProjectItem, "id" | "createdAt">>) => {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    const { name, currentStep, nextStep, blockers, ...rest } = patch
    const normalized = {
      ...rest,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(currentStep !== undefined ? { currentStep: currentStep.trim() } : {}),
      ...(nextStep !== undefined ? { nextStep: nextStep.trim() } : {}),
      ...(blockers !== undefined ? { blockers: blockers.trim() } : {}),
    }
    Object.assign(project, normalized, { updatedAt: Date.now() })
    await persist()
  }

  /** 删除项目（同时解除该项目下待办的 projectId 关联，避免悬空引用） */
  const remove = async (id: string) => {
    projects.value = projects.value.filter((p) => p.id !== id)
    // 解除关联：待办仍保留但 projectId 置空（同步更新内存 ref 与存储）
    if (todosRef) {
      todosRef.value = todosRef.value.map((t) =>
        t.projectId === id ? { ...t, projectId: null, updatedAt: Date.now() } : t,
      )
    }
    // 跨槽持久化：projects 与待办两个槽位同时落盘，与 add/update 共用同一把串行锁
    await persist(todosRef?.value)
  }

  /** 某项目关联的待办列表 */
  const todosOf = (projectId: string): TodoItem[] =>
    (todosRef?.value ?? []).filter((t) => t.projectId === projectId)

  /** 某项目关联待办的完成进度（已完成数 / 总数） */
  const progressOf = (projectId: string): { done: number, total: number } => {
    const list = todosOf(projectId)
    return {
      done: list.filter((t) => t.done).length,
      total: list.length,
    }
  }

  /** 卡住的项目（顶部「今天要处理的」聚焦区用） */
  const blockedProjects = computed(() => projects.value.filter((p) => p.status === "blocked"))

  /** 可见项目列表（全部显示）：未完成在前、已完成排后，组内按更新时间倒序 */
  const visibleProjects = computed(() =>
    [...projects.value].sort((a, b) => {
      if ((a.status === "completed") !== (b.status === "completed")) {
        return a.status === "completed" ? 1 : -1
      }
      return b.updatedAt - a.updatedAt
    }),
  )

  return {
    projects,
    blockedProjects,
    visibleProjects,
    load,
    add,
    update,
    remove,
    todosOf,
    progressOf,
  }
}
