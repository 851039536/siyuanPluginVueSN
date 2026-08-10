/**
 * 速记功能 — 项目跟进 composable
 * 承载项目条目的响应式列表与 CRUD、关联待办进度计算（已完成数/总数）、卡住项目筛选
 */
import type { Ref } from "vue"
import type { ProjectItem, TodoItem } from "../types"
import type { QuickNoteStorage } from "../types/storage"
import { computed, ref } from "vue"
import { generateId } from "../utils"

export function useProjects(storage: QuickNoteStorage) {
  const projects: Ref<ProjectItem[]> = ref([])
  /** 关联待办列表 ref 引用（由 useTodoList 注入，直接持有引用以响应待办变化） */
  let todosRef: Ref<TodoItem[]> | null = null

  /** 从存储加载全部项目 */
  const load = async () => {
    const data = await storage.data.loadOrDefault()
    projects.value = data.projects
  }

  /** 写入串行锁：防止快速连续操作时 read-modify-write 读到旧数据 */
  let _saveLock: Promise<void> = Promise.resolve()

  /** 持久化当前项目列表（动作级保存，串行化写操作） */
  const persist = async () => {
    _saveLock = _saveLock
      .catch(() => undefined)
      .then(async () => {
        const data = await storage.data.loadOrDefault()
        await storage.data.save({ ...data, projects: projects.value })
      })
    await _saveLock
  }

  /** 注入关联待办列表 ref（壳层在待办加载后调用，保存引用而非拷贝以保持响应式） */
  const setTodos = (todosSource: Ref<TodoItem[]>) => {
    todosRef = todosSource
  }

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

  /** 更新项目 */
  const update = async (id: string, patch: Partial<Omit<ProjectItem, "id" | "createdAt">>) => {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    Object.assign(project, patch, { updatedAt: Date.now() })
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
    // 全量持久化：projects 与待办两个槽位需同时落盘，通用 persist() 只写 projects 会造成关联置空丢失
    const data = await storage.data.loadOrDefault()
    await storage.data.save({
      ...data,
      projects: projects.value,
      todos: todosRef ? todosRef.value : data.todos,
    })
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

  /** 进行中/卡住项目列表（排除已完成，按更新时间倒序） */
  const activeProjects = computed(() =>
    projects.value
      .filter((p) => p.status !== "completed")
      .sort((a, b) => b.updatedAt - a.updatedAt),
  )

  return {
    projects,
    blockedProjects,
    activeProjects,
    load,
    add,
    update,
    remove,
    setTodos,
    todosOf,
    progressOf,
  }
}
