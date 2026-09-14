/**
 * 快捷键筛选管道：搜索 / 分类 / 收藏 / 最近 / 冲突，供工具栏与列表消费
 */
import type {
  Ref,
} from "vue"
import type {
  ShortcutFilterMode,
  ShortcutInfo,
} from "../types"
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
  favoriteIds: Ref<Set<string>>
  recentIds: Ref<string[]>
  conflictIds: Ref<Set<string>>
  i18n: Record<string, string>
}

export function useShortcutFilter(options: UseShortcutFilterOptions) {
  const {
    shortcuts,
    favoriteIds,
    recentIds,
    conflictIds,
    i18n,
  } = options

  const searchKeyword = ref("")
  const activeCategory = ref("all")
  const activeFilter = ref<ShortcutFilterMode>("all")

  /** 各分类条目数（含 "all"） */
  const categoryCounts = computed(() => countByCategory(shortcuts.value))

  /** 分类下拉选项：全部 + 实际出现过的分类（按标识排序） */
  const categories = computed(() => [
    "all",
    ...Array.from(categoryCounts.value.keys()).sort(),
  ])

  /** 镜像为 Set，供纯函数 filterShortcuts 做 O(1) 判定 */
  const recentIdSet = computed(() => new Set(recentIds.value))

  const filteredShortcuts = computed(() =>
    filterShortcuts(shortcuts.value, {
      keyword: searchKeyword.value,
      category: activeCategory.value,
      filter: activeFilter.value,
      favoriteIds: favoriteIds.value,
      recentIds: recentIdSet.value,
      conflictIds: conflictIds.value,
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

  /** 筛选按钮互斥切换：再次点击当前项则回到「全部」 */
  function toggleFilter(target: ShortcutFilterMode) {
    activeFilter.value = activeFilter.value === target ? "all" : target
  }

  return {
    searchKeyword,
    activeCategory,
    activeFilter,
    categories,
    filteredShortcuts,
    totalCount,
    visibleCount,
    getCategoryLabel,
    getCategoryCount,
    toggleFilter,
  }
}
