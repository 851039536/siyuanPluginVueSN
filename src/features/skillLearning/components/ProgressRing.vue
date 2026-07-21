<!-- 技能学习 - 环形进度图组件（练习覆盖 / 正确率） -->
<template>
  <div class="stats-view__section stats-view__section--ring">
    <div class="stats-view__section-title">
      {{ title }}
    </div>
    <div class="stats-view__progress-ring">
      <svg
        viewBox="0 0 100 100"
        class="stats-view__ring-svg"
      >
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--b3-border-color)"
          stroke-width="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          :stroke="strokeColor"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="ringCircumference"
          :stroke-dashoffset="ringOffset"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div class="stats-view__ring-text">
        <span
          class="stats-view__ring-pct"
          :style="{ color: strokeColor }"
        >{{ pct }}%</span>
        <span class="stats-view__ring-sub">{{ current }}/{{ total }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  title: string
  pct: number
  current: number
  total: number
  strokeColor: string
}>()

const RING_R = 42
const ringCircumference = 2 * Math.PI * RING_R
const ringOffset = computed(() =>
  ringCircumference - (props.pct / 100) * ringCircumference,
)
</script>

<style lang="scss" scoped>
@use "../styles/ProgressRing.scss";
</style>
