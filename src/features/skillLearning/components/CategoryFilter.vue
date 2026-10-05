<!-- 技能学习 - 分类筛选栏（语言/分类/难度下拉框） -->
<template>
  <div class="category-filter">
    <div class="category-filter__row">
      <!-- 语言/分类/难度：共享 Select（纯受控 ⇒ 显式回写） -->
      <Select
        class="category-filter__select"
        :model-value="selectedLanguage"
        :options="languageOptions"
        size="xsmall"
        :aria-label="t.allLanguages"
        @update:model-value="(v) => emit('update:selectedLanguage', toStr(v))"
      />

      <Select
        class="category-filter__select"
        :model-value="selectedCategory"
        :options="categoryOptions"
        size="xsmall"
        :aria-label="t.allCategories"
        @update:model-value="(v) => emit('update:selectedCategory', toStr(v))"
      />

      <Select
        class="category-filter__select"
        :model-value="selectedDifficulty"
        :options="difficultyOptions"
        size="xsmall"
        :aria-label="t.allDifficulties"
        @update:model-value="(v) => emit('update:selectedDifficulty', toStr(v))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  Difficulty,
  SkillI18n,
} from "../types"

import { computed } from "vue"
import Select from "@/components/Select.vue"
import { langLabel } from "../composables/useLangLabel"
import { DIFFICULTY_I18N_KEYS } from "../types"

const props = defineProps<{
  i18n: Required<SkillI18n>
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

/** Select 载荷归一为字符串（组件载荷为 string | number | boolean | null） */
function toStr(value: string | number | boolean | null): string {
  return value === null ? "" : String(value)
}

/** 语言选项（首项空串 = 全部） */
const languageOptions = computed(() => [
  {
    value: "",
    label: props.i18n.allLanguages,
  },
  ...props.languages.map((lang) => ({
    value: lang,
    label: langLabel(lang),
  })),
])

/** 分类选项（首项空串 = 全部） */
const categoryOptions = computed(() => [
  {
    value: "",
    label: props.i18n.allCategories,
  },
  ...props.categories.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

/** 难度选项（首项空串 = 全部；标签复用 DIFFICULTY_I18N_KEYS 映射，与 DifficultyBadge 同源） */
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"]
const difficultyOptions = computed(() => [
  {
    value: "",
    label: props.i18n.allDifficulties,
  },
  ...DIFFICULTIES.map((d) => ({
    value: d,
    label: props.i18n[DIFFICULTY_I18N_KEYS[d]],
  })),
])
</script>

<style lang="scss" scoped>
@use "../styles/CategoryFilter.scss";
</style>
