import type {
  ComputedRef,
  Ref
} from "vue"
import type { SkillCard } from "../types"
/**
 * 技能学习 - 共用筛选逻辑 composable
 * 提取 SkillListView 和 FlashcardView 中重复的筛选/分页逻辑
 */
import {
  computed,

  ref,

  watch,
} from "vue"

export interface FilteredCardsResult {
  searchQuery: Ref<string>
  selectedLanguage: Ref<string>
  selectedCategory: Ref<string>
  selectedDifficulty: Ref<string>
  page: Ref<number>
  languageList: ComputedRef<string[]>
  categoryList: ComputedRef<string[]>
  filteredCards: ComputedRef<SkillCard[]>
  totalPages: ComputedRef<number>
  paginated: ComputedRef<boolean>
  paginatedCards: ComputedRef<SkillCard[]>
}

export function useFilteredCards(
  cardsRef: Ref<SkillCard[]> | ComputedRef<SkillCard[]>,
  options?: { pageSize?: number, enableSearch?: boolean },
): FilteredCardsResult {
  const pageSize = options?.pageSize ?? 10
  const enableSearch = options?.enableSearch ?? false

  const searchQuery = ref("")
  const selectedLanguage = ref("")
  const selectedCategory = ref("")
  const selectedDifficulty = ref("")
  const page = ref(1)

  const languageList = computed(() => [...new Set(cardsRef.value.map((c) => c.language))].sort())
  const categoryList = computed(() => [...new Set(cardsRef.value.map((c) => c.category))].sort())

  const filteredCards = computed(() => {
    let result = cardsRef.value
    const q = enableSearch ? searchQuery.value.toLowerCase() : ""
    if (q) {
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q)
          || c.answer.toLowerCase().includes(q)
          || c.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    if (selectedLanguage.value) result = result.filter((c) => c.language === selectedLanguage.value)
    if (selectedCategory.value) result = result.filter((c) => c.category === selectedCategory.value)
    if (selectedDifficulty.value) result = result.filter((c) => c.difficulty === selectedDifficulty.value)
    return result
  })

  // 筛选条件变化时重置页码
  watch(
    enableSearch ? [searchQuery, selectedLanguage, selectedCategory, selectedDifficulty] : [selectedLanguage, selectedCategory, selectedDifficulty],
    () => {
      page.value = 1
    },
  )

  const totalPages = computed(() => Math.max(1, Math.ceil(filteredCards.value.length / pageSize)))
  const paginated = computed(() => filteredCards.value.length > pageSize)
  const paginatedCards = computed(() => {
    const start = (page.value - 1) * pageSize
    return filteredCards.value.slice(start, start + pageSize)
  })

  return {
    searchQuery,
    selectedLanguage,
    selectedCategory,
    selectedDifficulty,
    page,
    languageList,
    categoryList,
    filteredCards,
    totalPages,
    paginated,
    paginatedCards,
  }
}
