<template>
  <div class="skill-list-view">
    <div class="skill-list-view__search">
      <input
        v-model="searchQuery"
        type="text"
        class="skill-list-view__input"
        :placeholder="t.searchPlaceholder || '搜索卡片...'"
      />
    </div>
    <CategoryFilter
      v-model:selectedLanguage="selectedLanguage"
      v-model:selectedCategory="selectedCategory"
      v-model:selectedDifficulty="selectedDifficulty"
      :i18n="fullI18n"
      :languages="languageList"
      :categories="categoryList"
    />
    <div v-if="filteredCards.length === 0" class="skill-list-view__empty">
      {{ t.noCards }}
    </div>
    <div v-else class="skill-list-view__grid">
      <div
        v-for="card in filteredCards"
        :key="card.id"
        class="skill-list-view__card"
        @click="$emit('select', card)"
      >
        <div class="skill-list-view__card-top">
          <span class="skill-list-view__lang-dot" :class="`lang--${card.language}`" />
          <span class="skill-list-view__card-title">{{ card.title }}</span>
        </div>
        <div class="skill-list-view__card-bottom">
          <DifficultyBadge :difficulty="card.difficulty" :i18n="fullI18n" />
          <span class="skill-list-view__card-category">{{ card.category }}</span>
          <span class="skill-list-view__card-count">{{ card.practiceCount }}次</span>
        </div>
      </div>
    </div>
    <div v-if="paginated" class="skill-list-view__pagination">
      <button :disabled="page <= 1" @click="page--">&laquo;</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="page++">&raquo;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { SkillCard, SkillI18n } from "../types"
import CategoryFilter from "./CategoryFilter.vue"
import DifficultyBadge from "./DifficultyBadge.vue"

const props = defineProps<{
  cards: SkillCard[]
  i18n: SkillI18n
}>()

defineEmits<{
  select: [card: SkillCard]
}>()

const t = computed(() => props.i18n)
const fullI18n = computed<Required<SkillI18n>>(() => ({
  ...({
    panelTitle: "技能学习",
    beginer: "初级",
    intermediate: "中级",
    advanced: "高级",
    allLanguages: "全部语言",
    allCategories: "全部分类",
    allDifficulties: "全部难度",
    noCards: "暂无卡片",
    searchPlaceholder: "搜索卡片...",
  } as Required<SkillI18n>),
  ...props.i18n,
}))

const searchQuery = ref("")
const selectedLanguage = ref("")
const selectedCategory = ref("")
const selectedDifficulty = ref("")
const page = ref(1)
const pageSize = 10

const languageList = computed(() => [...new Set(props.cards.map((c) => c.language))].sort())
const categoryList = computed(() => [...new Set(props.cards.map((c) => c.category))].sort())

const filteredCards = computed(() => {
  let result = props.cards
  const q = searchQuery.value.toLowerCase()
  if (q) {
    result = result.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
  if (selectedLanguage.value) result = result.filter((c) => c.language === selectedLanguage.value)
  if (selectedCategory.value) result = result.filter((c) => c.category === selectedCategory.value)
  if (selectedDifficulty.value) result = result.filter((c) => c.difficulty === selectedDifficulty.value)
  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredCards.value.length / pageSize)))
const paginated = computed(() => filteredCards.value.length > pageSize)
</script>

<style lang="scss" scoped>
@use "../styles/SkillListView.scss";
</style>
