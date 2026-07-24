<!-- PeriodPicker — 期间选择器：选择年份/月份，v-model 双向绑定，被 ComparisonView 复用 -->
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
@use "../styles/PeriodPicker.scss";
</style>
