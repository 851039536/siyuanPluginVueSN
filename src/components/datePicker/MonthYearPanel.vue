<!-- DatePicker 月/年视图面板：12 月宫格与十年跨度年份宫格 -->
<template>
  <div
    class="si-datepicker__matrix"
    :class="`si-datepicker__matrix--${view}`"
    role="grid"
    :aria-label="ariaLabel"
  >
    <div
      v-for="(row, rowIndex) in rows"
      :key="rowIndex"
      class="si-datepicker__matrix-row"
      role="row"
    >
      <div
        v-for="item in row"
        :key="item.value"
        class="si-datepicker__matrix-cell"
        role="gridcell"
        :aria-selected="item.selected"
      >
        <button
          type="button"
          class="si-datepicker__matrix-btn"
          :class="{
            'si-datepicker__matrix-btn--selected': item.selected,
            'si-datepicker__matrix-btn--current': item.current,
          }"
          :disabled="item.disabled"
          :aria-current="item.current ? 'date' : undefined"
          @click="handleSelect(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DisabledOptions } from "./types"
import { computed } from "vue"
import {
  getDecadeYears,
  isMonthDisabled,
  isYearDisabled,
} from "./utils"
import { MONTH_LABELS } from "./types"

/** 宫格列数（月视图 4 列 × 3 行 = 12；年视图 5 列 × 2 行 = 10，均无残缺行） */
const MATRIX_COLUMNS = {
  month: 4,
  year: 5,
} as const

interface MatrixItem {
  /** 月视图为月份索引（0-11），年视图为年份 */
  value: number
  label: string
  selected: boolean
  /** 是否为当前（今年 / 本月） */
  current: boolean
  disabled: boolean
}

interface Props {
  view: "month" | "year"
  year: number
  month: number
  /** 今日（由入口组件传入，用于标记当前月/年） */
  today: Date
  /** 禁用约束（四类已收敛） */
  disabled: DisabledOptions
  /** 月份宫格文案（索引 0 = 一月） */
  monthLabels: string[]
  /** 宫格的无障碍名称 */
  ariaLabel: string
}

interface Emits {
  (e: "select", value: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const items = computed<MatrixItem[]>(() => {
  if (props.view === "month") {
    return MONTH_LABELS.map((fallback, index) => ({
      value: index,
      label: props.monthLabels[index] ?? fallback,
      selected: index === props.month,
      current: index === props.today.getMonth() && props.year === props.today.getFullYear(),
      disabled: isMonthDisabled(props.year, index, props.disabled),
    }))
  }

  return getDecadeYears(props.year).map((year) => ({
    value: year,
    label: String(year),
    selected: year === props.year,
    current: year === props.today.getFullYear(),
    disabled: isYearDisabled(year, props.disabled),
  }))
})

/** 按固定列数切分为显式行（role=row 需要行容器） */
const rows = computed(() => {
  const columns = MATRIX_COLUMNS[props.view]
  const result: MatrixItem[][] = []
  for (let index = 0; index < items.value.length; index += columns) {
    result.push(items.value.slice(index, index + columns))
  }
  return result
})

const handleSelect = (item: MatrixItem) => {
  if (item.disabled) {
    return
  }
  emit("select", item.value)
}
</script>

<style scoped lang="scss">
@use '../styles/DatePickerMonthYear.scss';
</style>
