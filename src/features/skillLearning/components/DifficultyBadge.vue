<template>
  <span class="difficulty-badge" :class="`difficulty-badge--${difficulty}`">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { Difficulty, SkillI18n } from "../types"

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
.difficulty-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &--beginner {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  &--intermediate {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  &--advanced {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }
}
</style>
