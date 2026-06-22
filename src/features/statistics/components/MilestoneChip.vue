<template>
  <div
    class="milestone-chip"
    :class="[`tier-${tier}`, { achieved, locked: !achieved && !isNext, next: !achieved && isNext }]"
  >
    <IconWrapper class="chip-icon" :name="(achieved ? icon : (isNext ? 'star' : 'pageLock')) as any" :size="14" />
    <span class="chip-label">{{ label }}</span>
    <span v-if="achieved" class="chip-tier">{{ tierLabel }}</span>
    <div v-if="!achieved" class="chip-progress">
      <div class="chip-progress-fill" :style="{ width: `${progress}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  icon: string
  label: string
  tier: string
  achieved: boolean
  progress: number
  isNext: boolean
  tierLabel?: string
}

withDefaults(defineProps<Props>(), {
  tierLabel: "",
})
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../styles/index.scss" as stats;

.milestone-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 10px;
  min-width: 68px;
  border-radius: 4px;
  position: relative;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.03);
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;

  &.achieved {
    @include stats.tier-chip-achieved;
  }

  &.next {
    background: rgba(var(--b3-theme-primary-rgb), 0.06);
    border: 1px dashed rgba(var(--b3-theme-primary-rgb), 0.3);
    opacity: 1;

    .chip-label {
      color: var(--b3-theme-primary);
      font-weight: 600;
    }
  }

  &.locked {
    opacity: 0.3;
    filter: grayscale(0.5);
  }
}

.chip-icon {
  font-size: 14px;
  line-height: 1;
}

.chip-label {
  font-family: stats.$font-mono;
  font-size: 10px;
  text-align: center;
  white-space: nowrap;
  line-height: 1.3;
}

.chip-tier {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 3px;
  font-weight: 700;
  line-height: 1.6;
}

.chip-progress {
  width: 100%;
  height: 2px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 2px;
}

.chip-progress-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 4px;
  transition: width 0.6s ease;
}
</style>
