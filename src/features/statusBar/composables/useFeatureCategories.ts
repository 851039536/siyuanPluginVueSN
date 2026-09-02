/**
 * 功能抽屉自定义分类：分类增删改、功能归属分配与持久化
 * 存储槽位：statusBar-categories（分类列表）/ statusBar-feature-category（单一归属映射）
 */
import type { Ref } from "vue"
import type { StatusBarCategory } from "../types/index"
import { ref } from "vue"
import type { PluginStorage } from "@/utils/pluginStorage"

const CATEGORIES_KEY = "statusBar-categories"
const ASSIGNMENT_KEY = "statusBar-feature-category"

type AssignmentMap = Record<string, string>

/** 重名/空名校验：返回错误提示，合法返回空串 */
function validateName(name: string, categories: StatusBarCategory[], excludeId?: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "分类名称不能为空"
  if (categories.some((c) => c.id !== excludeId && c.name === trimmed)) return "分类名称已存在"
  return ""
}

export function useFeatureCategories(storage: PluginStorage) {
  const categories = ref<StatusBarCategory[]>([])
  const assignment = ref<AssignmentMap>({})

  // 启动时异步加载（与 shortcuts/monitors 加载模式一致）
  // 先加载分类列表，再加载归属映射并按有效分类过滤悬挂引用
  // （存储损坏/外部篡改可能残留指向已不存在分类的 id，导致 badge 常亮但无对应 Tab）
  storage.load<StatusBarCategory[]>(CATEGORIES_KEY).then((data) => {
    categories.value = Array.isArray(data) ? data : []
    return storage.load<AssignmentMap>(ASSIGNMENT_KEY)
  }).then((data) => {
    if (!data || typeof data !== "object") return
    assignment.value = Object.fromEntries(
      Object.entries(data).filter(([, cid]) =>
        categories.value.some((c) => c.id === cid)),
    )
  })

  const categoryOf = (featureId: string): string | null =>
    assignment.value[featureId] ?? null

  const saveCategories = () => storage.save(CATEGORIES_KEY, categories.value)
  const saveAssignment = () => storage.save(ASSIGNMENT_KEY, assignment.value)

  /** 新建分类，返回错误提示（成功返回空串） */
  const addCategory = (name: string): string => {
    const error = validateName(name, categories.value)
    if (error) return error
    categories.value = [
      ...categories.value,
      { id: crypto.randomUUID(), name: name.trim() },
    ]
    saveCategories()
    return ""
  }

  /** 重命名分类，返回错误提示（成功返回空串） */
  const renameCategory = (id: string, name: string): string => {
    const error = validateName(name, categories.value, id)
    if (error) return error
    categories.value = categories.value.map((c) =>
      c.id === id ? { ...c, name: name.trim() } : c,
    )
    saveCategories()
    return ""
  }

  /** 删除分类，成员自动回到「未分类」 */
  const removeCategory = (id: string) => {
    categories.value = categories.value.filter((c) => c.id !== id)
    assignment.value = Object.fromEntries(
      Object.entries(assignment.value).filter(([, cid]) => cid !== id),
    )
    saveCategories()
    saveAssignment()
  }

  /** 分配功能归属，categoryId 为 null 表示移出分类 */
  const assignFeature = (featureId: string, categoryId: string | null) => {
    const next = { ...assignment.value }
    if (categoryId) {
      next[featureId] = categoryId
    } else {
      delete next[featureId]
    }
    assignment.value = next
    saveAssignment()
  }

  return {
    categories: categories as Ref<StatusBarCategory[]>,
    assignment,
    categoryOf,
    addCategory,
    renameCategory,
    removeCategory,
    assignFeature,
  }
}
