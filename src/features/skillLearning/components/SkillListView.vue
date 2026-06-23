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
      :i18n="t"
      :languages="languageList"
      :categories="categoryList"
    />
    <div
      v-if="filteredCards.length === 0"
      class="skill-list-view__empty"
    >
      {{ t.noCards }}
    </div>
    <div
      v-else
      class="skill-list-view__grid"
    >
      <div
        v-for="card in paginatedCards"
        :key="card.id"
        class="skill-list-view__card"
        @click="$emit('select', card)"
      >
        <button
          class="skill-list-view__card-delete"
          :title="t.deleteCard || '删除卡片'"
          @click.stop="$emit('delete', card.id)"
        >×</button>
        <div class="skill-list-view__card-top">
          <span
            class="skill-list-view__lang-dot"
            :class="`lang--${card.language}`"
          />
          <span class="skill-list-view__card-title">{{ card.title }}</span>
        </div>
        <div class="skill-list-view__card-bottom">
          <DifficultyBadge
            :difficulty="card.difficulty"
            :i18n="t"
          />
          <span class="skill-list-view__card-category">{{ card.category }}</span>
          <span class="skill-list-view__card-count">{{ card.practiceCount }}{{ t.practiceTimes }}</span>
        </div>
      </div>
    </div>
    <div
      v-if="paginated"
      class="skill-list-view__pagination"
    >
      <button
        :disabled="page <= 1"
        @click="page--"
      >
        &laquo;
      </button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        @click="page++"
      >
        &raquo;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  SkillCard,
  SkillI18n,
} from "../types"
import { computed } from "vue"
import { useFilteredCards } from "../composables/useFilteredCards"
import CategoryFilter from "./CategoryFilter.vue"
import DifficultyBadge from "./DifficultyBadge.vue"

const props = defineProps<{
  cards: SkillCard[]
  i18n: SkillI18n
}>()

const emit = defineEmits<{
  select: [card: SkillCard]
  delete: [cardId: string]
}>()

const t = computed(() => props.i18n)

const cardsRef = computed(() => props.cards)
const {
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
} = useFilteredCards(cardsRef, {
  pageSize: 10,
  enableSearch: true,
})
</script>

<style lang="scss" scoped>
@use "../styles/SkillListView.scss";
</style>
