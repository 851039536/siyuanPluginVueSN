<!-- 视图模式切换区：日/周/月/年 Tab + 范围选择 + 时段统计卡 -->
<template>
  <div class="view-mode-section">
    <!-- 视图模式切换 -->
    <div class="mode-row">
      <div class="mode-tabs">
        <button
          v-for="mode in periodModes"
          :key="mode.value"
          class="mode-tab"
          :class="{ active: modelValue === mode.value }"
          @click="$emit('update:modelValue', mode.value)"
        >
          <IconWrapper
            v-if="mode.icon"
            :name="mode.icon"
            :size="12"
          />
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 时段统计卡片 -->
    <div
      v-if="periodAvgWords > 0 || periodTotalWords > 0"
      class="period-stats-cards"
    >
      <div
        v-if="periodAvgWords > 0"
        class="period-stat-card"
      >
        <!-- 日均字数值 + 单位："字" -->
        <span class="stat-value">{{ formatNumber(periodAvgWords) }} {{ i18n.wordsUnit }}</span>
        <span class="stat-label">{{ periodAvgLabel }}</span>
      </div>
      <div
        v-if="periodTotalWords > 0"
        class="period-stat-card"
      >
        <span class="stat-value">{{ formatNumber(periodTotalWords) }} {{ i18n.wordsUnit }}</span>
        <!-- 统计卡标签："总字数" -->
        <span class="stat-label">{{ i18n.totalLabel }}</span>
      </div>
    </div>


    <!-- 日/月视图范围选择 -->
    <div
      v-if="modelValue === 'day' || modelValue === 'month'"
      class="range-selector"
    >
      <button
        v-for="range in currentRanges"
        :key="range.value"
        class="range-btn"
        :class="{ active: currentRangeValue === range.value }"
        @click="onRangeChange(range.value)"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 年视图选择 -->
    <div
      v-if="modelValue === 'year'"
      class="year-selector"
    >
      <select
        :value="selectedYear"
        class="year-select"
        @change="$emit('update:selectedYear', Number(($event.target as HTMLSelectElement).value))"
      >
        <option
          v-for="year in availableYears"
          :key="year"
          :value="year"
        >
          {{ year }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatNumber } from "../../utils"

interface Props {
  modelValue?: "day" | "week" | "month" | "year"
  dayRange?: 7 | 15 | 30 | 90 | 180 | 365
  monthYearRange?: 1 | 2 | 3
  selectedYear?: number
  periodAvgWords?: number
  periodTotalWords?: number
  i18n?: Record<string, any>
}

interface Emits {
  (
    e: "update:modelValue",
    value: "day" | "week" | "month" | "year",
  ): void
  (e: "update:dayRange", value: 7 | 15 | 30 | 90 | 180 | 365): void
  (e: "update:monthYearRange", value: 1 | 2 | 3): void
  (e: "update:selectedYear", value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "day",
  dayRange: 7,
  monthYearRange: 1,
  selectedYear: new Date().getFullYear(),
  periodAvgWords: 0,
  periodTotalWords: 0,
  i18n: () => ({
    day: "日",
    week: "周",
    month: "月",
    year: "年",
    avgLabel: "日均字数",
    totalLabel: "总字数",
    wordsUnit: "字",
    days7: "7天",
    days15: "15天",
    days30: "30天",
    quarter: "季度",
    halfYear: "半年",
    fullYear: "整年",
    last1Year: "最近一年",
    last2Years: "最近两年",
    last3Years: "最近三年",
    weekAvg: "周均字数",
    monthAvg: "月均字数",
    yearAvg: "年均字数",
  }),
})

const emit = defineEmits<Emits>()

function onRangeChange(value: number): void {
  if (props.modelValue === "month") {
    emit("update:monthYearRange", value as 1 | 2 | 3)
  } else {
    emit("update:dayRange", value as 7 | 15 | 30 | 90 | 180 | 365)
  }
}

// 视图模式选项（日/周/月/年）
const periodModes = computed(() => [
  {
    value: "day" as const,
    label: props.i18n.day,
    icon: "list" as const,
  },
  {
    value: "week" as const,
    label: props.i18n.week,
    icon: "format" as const,
  },
  {
    value: "month" as const,
    label: props.i18n.month,
    icon: "list" as const,
  },
  {
    value: "year" as const,
    label: props.i18n.year,
    icon: "calendar" as const,
  },
])

// 日视图范围选项（7天/15天/30天/季度/半年/整年）
const dayRanges = computed(() => [
  {
    value: 7 as const,
    label: props.i18n.days7,
  },
  {
    value: 15 as const,
    label: props.i18n.days15,
  },
  {
    value: 30 as const,
    label: props.i18n.days30,
  },
  {
    value: 90 as const,
    label: props.i18n.quarter,
  },
  {
    value: 180 as const,
    label: props.i18n.halfYear,
  },
  {
    value: 365 as const,
    label: props.i18n.fullYear,
  },
])

// 月视图范围选项（最近一年/两年/三年）
const monthRanges = computed(() => [
  {
    value: 1 as const,
    label: props.i18n.last1Year,
  },
  {
    value: 2 as const,
    label: props.i18n.last2Years,
  },
  {
    value: 3 as const,
    label: props.i18n.last3Years,
  },
])

// 当前视图的范围选项与激活值（日/月共用 range-selector 模板）
const currentRanges = computed(() =>
  props.modelValue === "month" ? monthRanges.value : dayRanges.value,
)

const currentRangeValue = computed(() =>
  props.modelValue === "month" ? props.monthYearRange : props.dayRange,
)

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear; year >= 2020; year--) {
    years.push(year)
  }
  return years
})

// 时段均值标签：随视图模式切换（日均/周均/月均/年均字数）
const periodAvgLabel = computed(() => {
  const labels: Record<string, string> = {
    day: props.i18n.avgLabel,
    week: props.i18n.weekAvg,
    month: props.i18n.monthAvg,
    year: props.i18n.yearAvg,
  }
  return labels[props.modelValue] || props.i18n.avgLabel
})


</script>

<style scoped lang="scss">
@use "../../styles/ViewModeSection.scss";
@use '../../styles/index.scss' as stats;
</style>
