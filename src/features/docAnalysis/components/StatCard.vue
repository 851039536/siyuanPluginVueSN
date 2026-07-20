<!-- 统计卡片子组件 - 可复用的统计指标卡 -->
<template>
  <div
    class="stat-card"
    :class="{ active: active }"
    @click="$emit('select', cardId)"
  >
    <template v-if="!iconOnly">
      <span class="card-value" :class="colorClass">{{ value.toLocaleString() }}</span>
    </template>
    <template v-else>
      <span class="card-value" :class="colorClass">
        <Icon :icon="iconOnly" />
      </span>
    </template>
    <span class="card-unit">{{ label }}</span>
    <span
      v-if="!iconOnly"
      class="card-percent"
      :style="{ width: pct }"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"

interface Props {
  value: number
  label: string
  colorClass: string
  active: boolean
  pct: string
  iconOnly?: string
  cardId: string
}

defineProps<Props>()

defineEmits<{
  (e: "select", id: string): void
}>()
</script>

<style lang="scss" scoped>
@use "../styles/StatCard.scss";
</style>
