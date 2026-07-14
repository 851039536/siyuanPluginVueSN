/**
 * PeriodPicker — 期间选择器子组件
 * 用于选择年份和月份，通过 v-model 双向绑定值。
 * 被 ComparisonView 复用（A/B 两个期间选择）。
 */
<template>
  <div class="period-picker">
    <span class="period-label">{{ label }}</span>
    <select
      v-model="yearModel"
      class="period-select"
    >
      <option
        v-for="y in yearOptions"
        :key="y"
        :value="y"
      >
        {{ y }}年
      </option>
    </select>
    <select
      v-model="monthModel"
      class="period-select"
    >
      <option :value="0">
        全年
      </option>
      <option
        v-for="m in 12"
        :key="m"
        :value="m"
      >
        {{ m }}月
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  label: string
  yearOptions: number[]
  year: number
  month: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  "update:year": [value: number]
  "update:month": [value: number]
}>()

const yearModel = computed({
  get: () => props.year,
  set: (val: number) => emit("update:year", val),
})

const monthModel = computed({
  get: () => props.month,
  set: (val: number) => emit("update:month", val),
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.period-picker {
  display: flex;
  gap: 4px;
  align-items: center;
}

.period-label {
  font-family: stats.$font-mono;
  font-size: 11px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  width: 14px;
}

.period-select {
  padding: 4px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: stats.$radius-sm;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 12px;
  outline: none;

  @include stats.codex-focus-glow;
}
</style>
