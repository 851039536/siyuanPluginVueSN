<!-- 统计卡片子组件 - 可复用的统计指标卡 -->
<template>
  <div
    class="stat-card"
    :class="{ active: active }"
    @click="$emit('select', cardId)"
  >
    <span class="card-value" :class="colorClass">{{ value.toLocaleString() }}</span>
    <span class="card-unit">{{ label }}</span>
    <span
      class="card-percent"
      :style="{ width: pct }"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  value: number
  label: string
  colorClass: string
  active: boolean
  pct: string
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
