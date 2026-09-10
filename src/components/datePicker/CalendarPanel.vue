<!-- DatePicker 日视图面板：7 列星期表头 + 6 行日期网格 + 方向键导航 -->
<template>
  <div
    ref="gridRef"
    class="si-datepicker__calendar"
    role="grid"
    :aria-label="ariaLabel"
    @keydown="handleGridKeydown"
    @mouseleave="handleGridLeave"
  >
    <!-- 星期表头 -->
    <div
      class="si-datepicker__weekdays"
      role="row"
    >
      <div
        v-for="(label, index) in orderedWeekdayLabels"
        :key="`${index}-${label}`"
        class="si-datepicker__weekday"
        role="columnheader"
        :abbr="orderedWeekdayFullLabels[index]"
      >
        {{ label }}
      </div>
    </div>

    <!-- 日期网格（固定 6 周 × 7 天） -->
    <div
      v-for="(week, weekIndex) in weeks"
      :key="weekIndex"
      class="si-datepicker__week"
      role="row"
    >
      <div
        v-for="cell in week"
        :key="cell.date.getTime()"
        class="si-datepicker__cell"
        role="gridcell"
        :aria-selected="cell.selected"
      >
        <button
          type="button"
          class="si-datepicker__day"
          :class="dayClasses(cell)"
          :data-date="cell.date.getTime()"
          :tabindex="isFocused(cell.date) ? 0 : -1"
          :disabled="cell.disabled"
          :aria-label="cellAriaLabel(cell)"
          :aria-current="cell.today ? 'date' : undefined"
          @click="handleSelect(cell)"
          @mouseenter="handleCellHover(cell)"
          @focus="focusedDate = cell.date"
        >
          <!-- date 插槽：默认渲染日序，scope 为完整日历单元格元数据 -->
          <slot
            name="date"
            v-bind="cell"
          >{{ cell.date.getDate() }}</slot>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarCell, DisabledOptions } from "./types"
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue"
import {
  addMonths,
  buildCalendarCells,
  isSameDay,
  isSameMonth,
  startOfDay,
} from "./utils"
import { formatDate } from "./formatUtils"
import { CALENDAR_COLS } from "./types"

interface Props {
  /** 面板当前显示的年份 */
  year: number
  /** 面板当前显示的月份（0-11） */
  month: number
  /** 已选日期（0/1/2 个；仅 1 个时为区间选择中的起点） */
  selected: Date[]
  /** 一周起始日（0=周日 … 6=周六） */
  firstDayOfWeek: number
  /** 表头星期短名（索引 0 = 周日，内部按 firstDayOfWeek 轮转） */
  weekdayLabels: string[]
  /** 星期全名（用于 columnheader 的 abbr 与无障碍播报） */
  weekdayFullLabels: string[]
  /** 今日（由入口组件传入，避免子部件读系统时钟） */
  today: Date
  /** 禁用约束（四类已收敛） */
  disabled: DisabledOptions
  /** 是否区间模式（决定是否启用悬停预览） */
  range: boolean
  /** 网格的无障碍名称 */
  ariaLabel: string
}

interface Emits {
  (e: "select", date: Date): void
  (e: "navigate", date: Date): void
}

const props = withDefaults(defineProps<Props>(), {
  selected: () => [],
})

const emit = defineEmits<Emits>()

const gridRef = ref<HTMLElement>()
/** 键盘漫游焦点所在日期（roving tabindex） */
const focusedDate = ref<Date>()
/** 区间模式下的悬停预览日期 */
const hoverDate = ref<Date | null>(null)

/** 表头按一周起始日轮转 */
const rotateLabels = (labels: string[]) =>
  Array.from({ length: CALENDAR_COLS }, (_, index) => labels[(props.firstDayOfWeek + index) % CALENDAR_COLS] ?? "")

const orderedWeekdayLabels = computed(() => rotateLabels(props.weekdayLabels))
const orderedWeekdayFullLabels = computed(() => rotateLabels(props.weekdayFullLabels))

/** 42 格单元格元数据（一次性预计算，模板只读 + date 插槽同一份数据） */
const cells = computed(() => buildCalendarCells({
  year: props.year,
  month: props.month,
  firstDayOfWeek: props.firstDayOfWeek,
  selected: props.selected,
  // 仅「已选起点 + 尚未完成区间」时才做悬停预览
  hoverDate: props.range ? hoverDate.value : null,
  today: props.today,
  disabled: props.disabled,
}))

/** 按周切分为 6 行（role=row 需要显式行容器） */
const weeks = computed(() => {
  const rows: CalendarCell[][] = []
  for (let index = 0; index < cells.value.length; index += CALENDAR_COLS) {
    rows.push(cells.value.slice(index, index + CALENDAR_COLS))
  }
  return rows
})

const dayClasses = (cell: CalendarCell) => ({
  "si-datepicker__day--outside": !cell.inCurrentMonth,
  "si-datepicker__day--today": cell.today,
  "si-datepicker__day--selected": cell.selected,
  "si-datepicker__day--in-range": cell.inRange,
  "si-datepicker__day--range-start": cell.rangeStart,
  "si-datepicker__day--range-end": cell.rangeEnd,
})

const isFocused = (date: Date) => !!focusedDate.value && isSameDay(focusedDate.value, date)

const cellAriaLabel = (cell: CalendarCell) =>
  `${formatDate(cell.date, "yy-mm-dd")} ${formatDate(cell.date, "DD")}`

const handleSelect = (cell: CalendarCell) => {
  if (cell.disabled) {
    return
  }
  focusedDate.value = cell.date
  emit("select", cell.date)
}

const handleCellHover = (cell: CalendarCell) => {
  if (props.range) {
    hoverDate.value = cell.date
  }
}

const handleGridLeave = () => {
  hoverDate.value = null
}

/** 把键盘焦点移动（并同步 DOM 焦点）到指定日期，必要时请求切换显示月份 */
const moveFocus = (date: Date) => {
  const target = startOfDay(date)
  focusedDate.value = target

  if (target.getFullYear() !== props.year || target.getMonth() !== props.month) {
    // 跨出当前显示月份：请求入口组件切换月份（不改变选中值），面板重建后焦点由 watch 保留
    hoverDate.value = null
    emit("navigate", target)
    return
  }

  nextTick(() => {
    gridRef.value
      ?.querySelector<HTMLElement>(`[data-date="${target.getTime()}"]`)
      ?.focus()
  })
}

const shiftFocus = (offsetDays: number) => {
  const base = focusedDate.value ?? props.today
  moveFocus(new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays))
}

const focusWeekEdge = (weekday: number) => {
  const base = focusedDate.value ?? props.today
  const current = (base.getDay() - props.firstDayOfWeek + 7) % 7
  shiftFocus(weekday - current)
}

const shiftFocusMonths = (offsetMonths: number) => {
  const base = focusedDate.value ?? props.today
  moveFocus(addMonths(base, offsetMonths))
}

const handleGridKeydown = (event: KeyboardEvent) => {
  const handlers: Record<string, () => void> = {
    ArrowLeft: () => shiftFocus(-1),
    ArrowRight: () => shiftFocus(1),
    ArrowUp: () => shiftFocus(-CALENDAR_COLS),
    ArrowDown: () => shiftFocus(CALENDAR_COLS),
    Home: () => focusWeekEdge(0),
    End: () => focusWeekEdge(CALENDAR_COLS - 1),
    PageUp: () => shiftFocusMonths(event.shiftKey ? -12 : -1),
    PageDown: () => shiftFocusMonths(event.shiftKey ? 12 : 1),
  }

  const handler = handlers[event.key]
  if (!handler) {
    return
  }
  event.preventDefault()
  handler()
}

/** 显示月份变化时，把漫游焦点拉回可视月份 */
watch(
  () => [props.year, props.month],
  () => {
    const base = focusedDate.value
    if (base && base.getFullYear() === props.year && base.getMonth() === props.month) {
      return
    }
    focusedDate.value = new Date(props.year, props.month, 1)
  },
)

onMounted(() => {
  const inViewMonth = new Date(props.year, props.month, 1)
  const base = props.selected[0] ?? props.today
  focusedDate.value = isSameMonth(base, inViewMonth) ? startOfDay(base) : inViewMonth
})

defineExpose({
  /** 把键盘焦点交给当前漫游日期（入口组件打开面板时调用） */
  focusGrid: () => {
    const target = focusedDate.value ?? new Date(props.year, props.month, 1)
    gridRef.value
      ?.querySelector<HTMLElement>(`[data-date="${target.getTime()}"]`)
      ?.focus()
  },
})
</script>

<style scoped lang="scss">
@use '../styles/DatePickerCalendar.scss';
</style>
