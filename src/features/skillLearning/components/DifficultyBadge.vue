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
import { DIFFICULTY_I18N_KEYS } from "../types"
import { computed } from "vue"

const props = defineProps<{
  difficulty: Difficulty
  i18n: Required<SkillI18n>
}>()

const label = computed(() => props.i18n[DIFFICULTY_I18N_KEYS[props.difficulty]])
</script>

<style lang="scss" scoped>
@use "../styles/DifficultyBadge.scss";
</style>
