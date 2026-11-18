/**
 * 分类数据管理 composable
 * 负责 categories 列表的加载与增删（含"默认/全部"内置分类）
 */
import type {
  CategoryManager,
  PromptCategory,
} from "../types"
import type { ShallowRef } from "vue"
import type { PromptsStorage } from "../types/storage"
import {
  DEFAULT_CATEGORY_COLOR,
  PROMPTS_ALL_CATEGORY_ID,
  PROMPTS_DEFAULT_CATEGORY_ID,
} from "../types"
import { computed, ref } from "vue"
import { resolvePromptsI18n } from "../utils"

/** 内置分类 ID 集合（禁止持久化、禁止删除） */
const BUILTIN_CATEGORY_IDS = new Set([PROMPTS_DEFAULT_CATEGORY_ID, PROMPTS_ALL_CATEGORY_ID])

export function useCategoryManager(
  storageRef: ShallowRef<PromptsStorage | null>,
  i18n?: Record<string, string>,
): CategoryManager {
  // P2-5：用完整默认值替代 `(i18n || {}).defaultCategory!`，避免 undefined 文案
  const t = resolvePromptsI18n(i18n)

  const DEFAULT_CATEGORY: PromptCategory = {
    id: PROMPTS_DEFAULT_CATEGORY_ID,
    name: t.defaultCategory,
    color: DEFAULT_CATEGORY_COLOR,
  }

  const ALL_CATEGORY: PromptCategory = {
    id: PROMPTS_ALL_CATEGORY_ID,
    name: t.allCategory,
    color: DEFAULT_CATEGORY_COLOR,
  }

  /** 用户自定义分类（内置 default/all 不在此列，避免被误删） */
  const categories = ref<PromptCategory[]>([])

  /** 完整分类视图（筛选侧边栏使用）：全部 → 默认 → 用户自定义 */
  const allCategories = computed(() => [ALL_CATEGORY, DEFAULT_CATEGORY, ...categories.value])

  async function load(): Promise<void> {
    const s = storageRef.value
    if (!s) return

    try {
      const loaded = await s.categories.loadOrDefault()
      if (Array.isArray(loaded) && loaded.length > 0) {
        // P2-6：过滤历史脏数据中混入的内置 id，防止 default 以普通分类身份被删
        categories.value = s.clampCategories(
          loaded
            .filter((cat) => !BUILTIN_CATEGORY_IDS.has(cat.id))
            .map((cat) => ({ ...cat, color: cat.color || DEFAULT_CATEGORY_COLOR })),
        )
      }
    } catch (error) {
      console.error("加载分类失败:", error)
    }
  }

  async function add(category: PromptCategory): Promise<void> {
    const s = storageRef.value
    if (!s) return
    // P2-6：内置 id 不允许作为用户分类写入
    if (BUILTIN_CATEGORY_IDS.has(category.id)) return

    await s.runExclusive(async () => {
      const previous = categories.value
      categories.value = s.clampCategories([...categories.value, category])
      try {
        await s.persistOrThrow(s.categories, categories.value)
      } catch (error) {
        categories.value = previous
        console.error("添加分类失败:", error)
        throw error
      }
    })
  }

  async function remove(id: string): Promise<void> {
    const s = storageRef.value
    if (!s) return
    // P2-6：防御性拒绝删除内置分类
    if (BUILTIN_CATEGORY_IDS.has(id)) return

    await s.runExclusive(async () => {
      const previous = categories.value
      categories.value = categories.value.filter((c) => c.id !== id)
      try {
        await s.persistOrThrow(s.categories, categories.value)
      } catch (error) {
        categories.value = previous
        console.error("删除分类失败:", error)
        throw error
      }
    })
  }

  return {
    categories,
    allCategories,
    load,
    add,
    remove,
  }
}
