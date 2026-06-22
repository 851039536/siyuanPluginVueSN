<template>
  <div class="category-filter">
    <div class="category-filter__row">
      <select
        :value="selectedLanguage"
        class="category-filter__select"
        @input="$emit('update:selectedLanguage', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t.allLanguages }}</option>
        <option v-for="lang in languages" :key="lang" :value="lang">
          {{ langLabel(lang) }}
        </option>
      </select>

      <select
        :value="selectedCategory"
        class="category-filter__select"
        @input="$emit('update:selectedCategory', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t.allCategories }}</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <select
        :value="selectedDifficulty"
        class="category-filter__select"
        @input="$emit('update:selectedDifficulty', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t.allDifficulties }}</option>
        <option value="beginner">{{ t.beginner }}</option>
        <option value="intermediate">{{ t.intermediate }}</option>
        <option value="advanced">{{ t.advanced }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { Language, Difficulty, SkillI18n } from "../types"

const props = defineProps<{
  i18n: SkillI18n
  languages: string[]
  categories: string[]
  selectedLanguage: string
  selectedCategory: string
  selectedDifficulty: string
}>()

const emit = defineEmits<{
  "update:selectedLanguage": [value: string]
  "update:selectedCategory": [value: string]
  "update:selectedDifficulty": [value: string]
}>()

const t = computed(() => props.i18n)

function langLabel(lang: string): string {
  const map: Record<string, string> = {
    csharp: "C#",
    javascript: "JavaScript",
    typescript: "TypeScript",
    vue: "Vue",
  }
  return map[lang] || lang
}
</script>

<style lang="scss" scoped>
@use "../styles/CategoryFilter.scss";
</style>
