/**
 * 功能抽屉自定义分类：分类增删改、功能归属分配与持久化
 * 存储槽位见 types/storage.ts（StatusBarStorage.categories / featureCategory）
 */
import type { Ref } from "vue"
import { ref } from "vue"
import type { FeatureCategoryMap, StatusBarStorage } from "../types/storage"
import type { StatusBarCategory } from "../types/index"

/** 校验结果：空串表示合法；否则为 i18n 键（由调用方翻译，避免此处硬编码文案） */
type ValidationKey = "" | "categoryNameEmpty" | "categoryNameExists"

/** 重名/空名校验：返回错误 i18n 键，合法返回空串 */
function validateName(name: string, categories: StatusBarCategory[], excludeId?: string): ValidationKey {
  const trimmed = name.trim()
  if (!trimmed) return "categoryNameEmpty"
  if (categories.some((c) => c.id !== excludeId && c.name === trimmed)) return "categoryNameExists"
  return ""
}

export function useFeatureCategories(storage: StatusBarStorage) {
  const categories = ref<StatusBarCategory[]>([])
  const assignment = ref<FeatureCategoryMap>({})

  // 启动时异步加载：先加载分类列表，再加载归属映射并按有效分类过滤悬挂引用
  // （存储损坏/外部篡改可能残留指向已不存在分类的 id，导致 badge 常亮但无对应 Tab）
  void (async () => {
    const cats = await storage.categories.loadOrDefault()
    categories.value = Array.isArray(cats) ? cats : []
    const map = await storage.featureCategory.loadOrDefault()
    if (!map || typeof map !== "object") return
    assignment.value = Object.fromEntries(
      Object.entries(map).filter(([, cid]) =>
        categories.value.some((c) => c.id === cid)),
    )
  })()

  const categoryOf = (featureId: string): string | null =>
    assignment.value[featureId] ?? null

  /** 新建分类，返回错误提示（成功返回空串） */
  const addCategory = (name: string): string => {
    const error = validateName(name, categories.value)
    if (error) return error
    categories.value = [
      ...categories.value,
      { id: crypto.randomUUID(), name: name.trim() },
    ]
    void storage.categories.save(categories.value)
    return ""
  }

  /** 重命名分类，返回错误提示（成功返回空串） */
  const renameCategory = (id: string, name: string): string => {
    const error = validateName(name, categories.value, id)
    if (error) return error
    categories.value = categories.value.map((c) =>
      c.id === id ? { ...c, name: name.trim() } : c,
    )
    void storage.categories.save(categories.value)
    return ""
  }

  /** 删除分类，成员自动回到「未分类」 */
  const removeCategory = (id: string) => {
    categories.value = categories.value.filter((c) => c.id !== id)
    assignment.value = Object.fromEntries(
      Object.entries(assignment.value).filter(([, cid]) => cid !== id),
    )
    void storage.categories.save(categories.value)
    void storage.featureCategory.save(assignment.value)
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
    void storage.featureCategory.save(next)
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
