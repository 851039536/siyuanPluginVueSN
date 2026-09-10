<!-- DatePicker 面板：头部导航 + 日/月/年视图主体 + 底部按钮栏 -->
<template>
  <div
    :id="panelId"
    ref="panelRef"
    class="si-datepicker__panel"
    :class="`si-datepicker__panel--${placement}`"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    :aria-label="ariaLabels.chooseDate"
  >
    <!-- 面板头部：十年 / 单步导航 + 视图标题（点击可逐级切换视图） -->
    <div class="si-datepicker__header">
      <button
        type="button"
        class="si-datepicker__nav"
        :aria-label="navLabels.jumpPrev"
        @click.stop="shiftView(-1, true)"
      >
        <IconWrapper
          :name="'chevronDoubleLeft' as IconKey"
          :size="navIconSize"
        />
      </button>
      <button
        type="button"
        class="si-datepicker__nav"
        :aria-label="navLabels.stepPrev"
        @click.stop="shiftView(-1, false)"
      >
        <IconWrapper
          :name="'chevronLeft' as IconKey"
          :size="navIconSize"
        />
      </button>
      <button
        type="button"
        class="si-datepicker__title"
        @click.stop="cycleView"
      >
        {{ panelTitle }}
      </button>
      <button
        type="button"
        class="si-datepicker__nav"
        :aria-label="navLabels.stepNext"
        @click.stop="shiftView(1, false)"
      >
        <IconWrapper
          :name="'chevronRight' as IconKey"
          :size="navIconSize"
        />
      </button>
      <button
        type="button"
        class="si-datepicker__nav"
        :aria-label="navLabels.jumpNext"
        @click.stop="shiftView(1, true)"
      >
        <IconWrapper
          :name="'chevronDoubleRight' as IconKey"
          :size="navIconSize"
        />
      </button>
    </div>

    <!-- 面板主体：日视图网格 / 月年视图宫格 -->
    <CalendarPanel
      v-if="viewMode === 'date'"
      ref="calendarRef"
      :year="viewYear"
      :month="viewMonth"
      :selected="selected"
      :first-day-of-week="firstDayOfWeek"
      :weekday-labels="weekdayLabels"
      :weekday-full-labels="weekdayFullLabels"
      :today="today"
      :disabled="disabled"
      :range="range"
      :aria-label="ariaLabels.chooseDate"
      @select="emit('select', $event)"
      @navigate="handleNavigate"
    >
      <!-- date 插槽：自定义日期单元格内容，scope 为完整日历单元格元数据 -->
      <template #date="cellScope">
        <slot
          name="date"
          v-bind="cellScope"
        >{{ cellScope.date.getDate() }}</slot>
      </template>
    </CalendarPanel>
    <MonthYearPanel
      v-else
      :view="matrixView"
      :year="viewYear"
      :month="viewMonth"
      :today="today"
      :disabled="disabled"
      :month-labels="monthLabels"
      :aria-label="ariaLabels.chooseDate"
      @select="handleMatrixSelect"
    />

    <!-- 面板底部按钮栏 -->
    <div
      v-if="showButtonBar"
      class="si-datepicker__footer"
    >
      <slot
        name="buttonbar"
        :today="today"
        :select-today="() => emit('selectToday')"
        :clear="() => emit('clear')"
      >
        <button
          type="button"
          class="si-datepicker__btn"
          @click.stop="emit('selectToday')"
        >
          {{ todayText }}
        </button>
        <button
          type="button"
          class="si-datepicker__btn"
          @click.stop="emit('clear')"
        >
          {{ clearText }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import type {
  DatePickerAriaLabels,
  DisabledOptions,
  PickerView,
} from "./types"
import {
  computed,
  nextTick,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CalendarPanel from "./CalendarPanel.vue"
import MonthYearPanel from "./MonthYearPanel.vue"
import { MONTH_LABELS } from "./types"
import {
  addMonths,
  formatPanelTitle,
} from "./utils"

interface Props {
  /** 面板唯一 id（供输入框 aria-controls 关联，由入口组件生成） */
  panelId: string
  /** 弹层展开方向（决定过渡原点与边距） */
  placement: "top" | "bottom"
  /** 已选日期（0/1/2 个） */
  selected: Date[]
  /** 是否区间模式 */
  range: boolean
  /** 打开时的初始视图 */
  initialView: PickerView
  /** 一周起始日 */
  firstDayOfWeek: number
  /** 表头星期短名 / 全名 */
  weekdayLabels: string[]
  weekdayFullLabels: string[]
  /** 今日（入口组件在打开时刷新） */
  today: Date
  /** 禁用约束（四类已收敛） */
  disabled: DisabledOptions
  /** 是否显示底部按钮栏 */
  showButtonBar: boolean
  todayText: string
  clearText: string
  /** 无障碍文案 */
  ariaLabels: DatePickerAriaLabels
  /** 月份宫格文案 */
  monthLabels: string[]
  /** 面板导航图标尺寸 */
  navIconSize: number
}

interface Emits {
  (e: "select", date: Date): void
  (e: "selectToday"): void
  (e: "clear"): void
  (e: "viewChange", view: PickerView): void
}

const props = withDefaults(defineProps<Props>(), {
  monthLabels: () => MONTH_LABELS,
})

const emit = defineEmits<Emits>()

const panelRef = ref<HTMLElement>()
const calendarRef = ref<InstanceType<typeof CalendarPanel>>()

/** 面板内视图与显示年月：面板每次打开都重新挂载，故初始值即「本次打开」的起点 */
const viewMode = ref<PickerView>(props.initialView)
const initialBase = props.selected[0] ?? props.today
const viewYear = ref(initialBase.getFullYear())
const viewMonth = ref(initialBase.getMonth())

const matrixView = computed<"month" | "year">(() => (props.initialView === "month" ? "month" : "year"))
const panelTitle = computed(() => formatPanelTitle(viewMode.value, viewYear.value, viewMonth.value))

/** 导航按钮文案随视图层级切换（日 → 月/年，月 → 年/十年，年 → 十年/世纪） */
const navLabels = computed(() => {
  const labels = props.ariaLabels
  if (viewMode.value === "date") {
    return {
      stepPrev: labels.prevMonth,
      stepNext: labels.nextMonth,
      jumpPrev: labels.prevYear,
      jumpNext: labels.nextYear,
    }
  }
  if (viewMode.value === "month") {
    return {
      stepPrev: labels.prevYear,
      stepNext: labels.nextYear,
      jumpPrev: labels.prevDecade,
      jumpNext: labels.nextDecade,
    }
  }
  return {
    stepPrev: labels.prevDecade,
    stepNext: labels.nextDecade,
    jumpPrev: labels.prevCentury,
    jumpNext: labels.nextCentury,
  }
})

/** 视图切换后把焦点交给新视图（日视图→网格单元格，月/年视图→面板容器），保证 Esc 仍可关闭 */
const focusActiveView = () => {
  nextTick(() => {
    if (viewMode.value === "date") {
      calendarRef.value?.focusGrid()
      return
    }
    panelRef.value?.focus()
  })
}

/** 键盘跨月导航（不改变选中值，仅切换面板显示月份） */
const handleNavigate = (date: Date) => {
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
}

const handleMatrixSelect = (value: number) => {
  if (viewMode.value === "month") {
    viewMonth.value = value
    viewMode.value = "date"
    emit("viewChange", "date")
    focusActiveView()
    return
  }
  viewYear.value = value
  viewMode.value = "month"
  emit("viewChange", "month")
  focusActiveView()
}

/** 标题点击逐级切换视图：日 → 月 → 年 → 日 */
const cycleView = () => {
  const next: Record<PickerView, PickerView> = {
    date: "month",
    month: "year",
    year: "date",
  }
  viewMode.value = next[viewMode.value]
  emit("viewChange", viewMode.value)
  focusActiveView()
}

/** 头部导航：单步与跨级步长随视图层级不同（日：月/年；月：年/十年；年：十年/世纪） */
const shiftView = (direction: number, jump: boolean) => {
  if (viewMode.value === "date") {
    const next = addMonths(new Date(viewYear.value, viewMonth.value, 1), direction * (jump ? 12 : 1))
    viewYear.value = next.getFullYear()
    viewMonth.value = next.getMonth()
    return
  }
  if (viewMode.value === "month") {
    viewYear.value += direction * (jump ? 10 : 1)
    return
  }
  viewYear.value += direction * (jump ? 100 : 10)
}

/** 把键盘焦点交给日历网格（入口组件在按钮打开面板时调用） */
const focusGrid = () => {
  calendarRef.value?.focusGrid()
}

defineExpose({
  focusGrid,
})
</script>

<style scoped lang="scss">
@use '../styles/DatePickerPanel.scss';
</style>
