/**
 * 快捷键筛选管道：搜索 / 分类，供工具栏与列表消费
 */
import type { Ref } from "vue"
import type { ShortcutInfo } from "../types"
import {
  computed,
  ref,
} from "vue"
import {
  countByCategory,
  filterShortcuts,
} from "../utils"
import { CATEGORY_LABEL_I18N_KEYS } from "../types"

interface UseShortcutFilterOptions {
  shortcuts: Ref<ShortcutInfo[]>
  i18n: Record<string, string>
}

export function useShortcutFilter(options: UseShortcutFilterOptions) {
  const {
    shortcuts,
    i18n,
  } = options

  const searchKeyword = ref("")
  const activeCategory = ref("all")

  /** 各分类条目数（含 "all"） */
  const categoryCounts = computed(() => countByCategory(shortcuts.value))

  /** 分类下拉选项：全部 + 实际出现过的分类（按标识排序） */
  const categories = computed(() => [
    "all",
    ...Array.from(categoryCounts.value.keys()).sort(),
  ])

  const filteredShortcuts = computed(() =>
    filterShortcuts(shortcuts.value, {
      keyword: searchKeyword.value,
      category: activeCategory.value,
    }),
  )

  /** 当前数据源总数（不含筛选） */
  const totalCount = computed(() => shortcuts.value.length)
  /** 筛选后条目数 */
  const visibleCount = computed(() => filteredShortcuts.value.length)

  /** 分类文案（i18n 缺失时回退为分类标识） */
  function getCategoryLabel(category: string): string {
    const key = CATEGORY_LABEL_I18N_KEYS[category as keyof typeof CATEGORY_LABEL_I18N_KEYS]
    return (key && i18n[key]) || category
  }

  /** 分类条目数（"all" 为总数） */
  function getCategoryCount(category: string): number {
    return category === "all" ? totalCount.value : categoryCounts.value.get(category) || 0
  }

  return {
    searchKeyword,
    activeCategory,
    categories,
    filteredShortcuts,
    totalCount,
    visibleCount,
    getCategoryLabel,
    getCategoryCount,
  }
}
