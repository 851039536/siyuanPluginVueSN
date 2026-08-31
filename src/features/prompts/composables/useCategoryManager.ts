/**
 * 分类数据管理 composable
 * 负责 categories 列表的加载与增删（含"默认/全部"内置分类）
 */
import type {
  ComputedRef,
  Ref,
  ShallowRef,
} from "vue"
import type { PromptCategory } from "../types"
import type { PromptsStorage } from "../types/storage"
import {
  computed,
  ref,
} from "vue"
import { DEFAULT_CATEGORY_COLOR } from "../types"

/** 分类管理器对外接口（供弹窗组件以 manager 实例形式消费） */
export type CategoryManager = {
  categories: Ref<PromptCategory[]>
  allCategories: ComputedRef<PromptCategory[]>
  load: () => Promise<void>
  add: (category: PromptCategory) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useCategoryManager(
  storageRef: ShallowRef<PromptsStorage | null>,
  i18n?: Record<string, string>,
): CategoryManager {
  const defName = (i18n || {}).defaultCategory!
  const allName = (i18n || {}).allCategory!

  const DEFAULT_CATEGORY: PromptCategory = {
    id: "default",
    name: defName,
    color: DEFAULT_CATEGORY_COLOR,
  }

  const ALL_CATEGORY: PromptCategory = {
    id: "all",
    name: allName,
    color: DEFAULT_CATEGORY_COLOR,
  }

  const categories = ref<PromptCategory[]>([{ ...DEFAULT_CATEGORY }])

  const allCategories = computed(() => [ALL_CATEGORY, ...categories.value])

  async function load(): Promise<void> {
    const s = storageRef.value
    if (!s) return

    try {
      const loaded = await s.categories.loadOrDefault()
      if (Array.isArray(loaded) && loaded.length > 0) {
        categories.value = loaded.map((cat) => ({
          ...cat,
          color: cat.color || DEFAULT_CATEGORY_COLOR,
        }))
      }
    } catch (error) {
      console.error("加载分类失败:", error)
    }
  }

  async function add(category: PromptCategory): Promise<void> {
    const s = storageRef.value
    if (!s) return

    const previous = categories.value
    categories.value = [...categories.value, category]
    try {
      await s.categories.save(categories.value)
    } catch (error) {
      categories.value = previous
      console.error("添加分类失败:", error)
      throw error
    }
  }

  async function remove(id: string): Promise<void> {
    const s = storageRef.value
    if (!s) return

    const previous = categories.value
    categories.value = categories.value.filter((c) => c.id !== id)
    try {
      await s.categories.save(categories.value)
    } catch (error) {
      categories.value = previous
      console.error("删除分类失败:", error)
      throw error
    }
  }

  return {
    categories,
    allCategories,
    load,
    add,
    remove,
  }
}
