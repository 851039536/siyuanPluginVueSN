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

/**
 * 分类数据管理 composable
 * 负责 categories 列表的加载与增删
 */
export function useCategoryManager(
  storageRef: ShallowRef<PromptsStorage | null>,
  i18n?: Record<string, string>,
): {
  categories: Ref<PromptCategory[]>
  allCategories: ComputedRef<PromptCategory[]>
  load: () => Promise<void>
  add: (category: PromptCategory) => Promise<void>
  remove: (id: string) => Promise<void>
  getById: (id: string) => PromptCategory
} {
  const defName = (i18n || {}).defaultCategory!
  const allName = (i18n || {}).allCategory!

  const DEFAULT_CATEGORY: PromptCategory = {
    id: "default",
    name: defName,
    color: "#d97757",
  }

  const ALL_CATEGORY: PromptCategory = {
    id: "all",
    name: allName,
    color: "#d97757",
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
          color: cat.color || "#d97757",
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

  function getById(id: string): PromptCategory {
    return categories.value.find((c) => c.id === id) || categories.value[0]
  }

  return {
    categories,
    allCategories,
    load,
    add,
    remove,
    getById,
  }
}
