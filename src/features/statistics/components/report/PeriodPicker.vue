<!-- PeriodPicker — 期间选择器：选择年份/月份，v-model 双向绑定，被 ComparisonView 复用 -->
<template>
  <div class="period-picker">
    <span class="period-label">{{ label }}</span>
    <!-- 年份/月份：共享 Select（纯受控 ⇒ 经 defineModel 回写；载荷为 number） -->
    <Select
      class="period-select-field"
      :model-value="yearModel"
      :options="yearSelectOptions"
      size="xsmall"
      :aria-label="label"
      @update:model-value="(v) => yearModel = Number(v)"
    />
    <Select
      class="period-select-field"
      :model-value="monthModel"
      :options="monthSelectOptions"
      size="xsmall"
      :aria-label="label"
      @update:model-value="(v) => monthModel = Number(v)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Select from "@/components/Select.vue"

interface Props {
  label: string
  yearOptions: number[]
}

const props = defineProps<Props>()

/** 月份取 0 表示整年（全年统计） */
const MONTH_ALL = 0

const yearModel = defineModel<number>("year", { required: true })
const monthModel = defineModel<number>("month", { required: true })

/** 年份选项（数值载荷，与 yearModel 的 number 契约一致） */
const yearSelectOptions = computed(() =>
  props.yearOptions.map((y) => ({
    value: y,
    label: `${y}年`,
  })),
)

/** 月份选项（0 = 全年，与 MONTH_ALL 语义一致） */
const monthSelectOptions = computed(() => [
  {
    value: MONTH_ALL,
    label: "全年",
  },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}月`,
  })),
])
</script>

<style scoped lang="scss">
@use "../../styles/PeriodPicker.scss";
@use '../../styles/index.scss' as stats;
</style>
