<!-- 技能学习 - 难度徽章组件 -->
<template>
  <span
    class="difficulty-badge"
    :class="`difficulty-badge--${difficulty}`"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type {
  Difficulty,
  SkillI18n,
} from "../types"
import { DIFFICULTY_CHINESE } from "../types"
import { computed } from "vue"

const props = defineProps<{
  difficulty: Difficulty
  i18n: SkillI18n
}>()

const label = computed(() => {
  const i18nKey = props.difficulty as keyof SkillI18n
  return props.i18n[i18nKey] || DIFFICULTY_CHINESE[props.difficulty] || props.difficulty
})
</script>

<style lang="scss" scoped>
@use "../styles/DifficultyBadge.scss";
</style>
