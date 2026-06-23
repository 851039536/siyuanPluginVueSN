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
import { computed } from "vue"

const props = defineProps<{
  difficulty: Difficulty
  i18n: SkillI18n
}>()

const label = computed(() => {
  const map: Record<Difficulty, string> = {
    beginner: props.i18n.beginner || "初级",
    intermediate: props.i18n.intermediate || "中级",
    advanced: props.i18n.advanced || "高级",
  }
  return map[props.difficulty] || props.difficulty
})
</script>

<style lang="scss" scoped>
@use "../styles/DifficultyBadge.scss";
</style>
