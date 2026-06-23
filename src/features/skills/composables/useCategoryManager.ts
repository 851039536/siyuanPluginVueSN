import type { Ref } from "vue"
import type { PromptCategory } from "../types"
import type { SkillsStorage } from "../types/storage"
import {
  computed,
  ref,
} from "vue"

const DEFAULT_CATEGORY: PromptCategory = {
  id: "default",
  name: "默认",
  color: "#d97757",
}

/**
 * 分类数据管理 composable
 * 负责 categories 列表的加载与增删
 */
export function useCategoryManager(storageRef: Ref<SkillsStorage | null>) {
  const categories = ref<PromptCategory[]>([{ ...DEFAULT_CATEGORY }])

  const allCategories = computed(() => [
    {
      id: "all",
      name: "全部",
      color: "#d97757",
    },
    ...categories.value,
  ])

  async function load() {
    const s = storageRef.value
    if (!s) return
    const loaded = await s.categories.loadOrDefault()
    if (Array.isArray(loaded) && loaded.length > 0) {
      categories.value = loaded.map((cat) => ({
        ...cat,
        color: cat.color || "#d97757",
      }))
    }
  }

  async function save() {
    await storageRef.value?.categories.save(categories.value)
  }

  async function add(category: PromptCategory) {
    categories.value.push(category)
    await save()
  }

  async function remove(id: string) {
    categories.value = categories.value.filter((c) => c.id !== id)
    await save()
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
