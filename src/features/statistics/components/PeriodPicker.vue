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
      <option :value="MONTH_ALL">
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
interface Props {
  label: string
  yearOptions: number[]
}

defineProps<Props>()

/** 月份取 0 表示整年（全年统计） */
const MONTH_ALL = 0

const yearModel = defineModel<number>("year", { required: true })
const monthModel = defineModel<number>("month", { required: true })
</script>

<style scoped lang="scss">
@use "../styles/PeriodPicker.scss";
</style>
