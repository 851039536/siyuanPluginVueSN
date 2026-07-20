<!-- 横条柱状行 - 标签/轨道/计数，用于平台分布/字数/书签/深度 -->
<template>
  <div class="bar-row" :class="{ clickable: !!clickable }" @click="clickable && $emit('click')">
    <span class="bar-label">{{ label }}</span>
    <div class="bar-track">
      <div
        class="bar-fill"
        :class="fillClass"
        :style="{ width: `${pct}%` }"
      />
    </div>
    <span class="bar-count">{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  count: number
  pct: number
  fillClass?: string
  clickable?: boolean
}

defineProps<Props>()

defineEmits<{
  (e: "click"): void
}>()
</script>

<style lang="scss" scoped>
@use "../styles/BarRow.scss";
</style>
