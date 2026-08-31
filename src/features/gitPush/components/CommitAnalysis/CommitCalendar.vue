<!-- 提交日历：月卡片网格视图，每日格子显示日号与提交数并按热力等级着色（周起始/配色/范围由设置驱动） -->
<template>
  <div class="gpa-cal">
    <div
      v-for="m in months"
      :key="m.key"
      class="gpa-cal-month"
    >
      <!-- 月标题：YYYY-MM + 月提交总数 -->
      <div class="gpa-cal-month-head">
        <span class="gpa-cal-month-title">{{ m.title }}</span>
        <span class="gpa-cal-month-total">{{ m.total }}</span>
      </div>

      <!-- 星期表头（按 weekStart 排序，周一开头或周日开头） -->
      <div class="gpa-cal-weekhead">
        <span
          v-for="w in m.weekhead"
          :key="w"
          class="gpa-cal-weekhead-cell"
        >{{ w }}</span>
      </div>

      <!-- 日格子：月初偏移空格 + 每日（未来日期弱化，今天描边） -->
      <div class="gpa-cal-days">
        <span
          v-for="blank in m.offset"
          :key="`b${blank}`"
          class="gpa-cal-day is-blank"
        />
        <div
          v-for="d in m.days"
          :key="d.date"
          class="gpa-cal-day"
          :class="{ 'is-future': d.future, 'is-today': d.today }"
          :style="d.style"
          :title="d.tooltip"
        >
          <span class="gpa-cal-day-num">{{ d.dayNum }}</span>
          <span
            v-if="d.count > 0"
            class="gpa-cal-day-count"
          >{{ d.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { formatLocalDate, heatCellColor, heatCellTooltip, heatLevel } from "../../utils"
import { ANALYSIS_WEEKDAY_KEYS } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 日计数映射（YYYY-MM-DD → 提交数，buildDayCountMap 产出） */
  dayCounts: Map<string, number>
  /** 范围起止（YYYY-MM-DD，resolveAnalysisRange 格式化产出） */
  start: string
  end: string
  /** 每周第一天（1=周一, 0=周日） */
  weekStart: 0 | 1
  /** 热力主色（#RRGGBB） */
  color: string
}>()

/** 按 weekStart 排序的星期表头（周一开头或周日开头） */
const weekhead = computed(() => {
  const order: number[] = []
  for (let i = 0; i < 7; i++) order.push((props.weekStart + i) % 7)
  return order.map((d) => props.i18n[ANALYSIS_WEEKDAY_KEYS[d]] || "")
})

interface DayCell {
  date: string
  dayNum: number
  count: number
  /**
   * 预计算的格子内联样式对象。
   * 存对象而非颜色串：模板绑定同一引用后，Vue 不会把每次重渲染都当成 style 变更去 patch
   * （一年 12 个月 × 31 天 ≈ 372 格，逐格 patch 是明显浪费）。
   */
  style: Record<string, string>
  future: boolean
  today: boolean
  tooltip: string
}

interface MonthCell {
  key: string
  title: string
  total: number
  offset: number
  weekhead: string[]
  days: DayCell[]
}

/** 逐月卡片：月初到 weekStart 的偏移空格 + 每日格子 + 月提交总数 */
const months = computed<MonthCell[]>(() => {
  const [sy, sm, sd] = props.start.split("-").map(Number)
  const [ey, em, ed] = props.end.split("-").map(Number)
  const end = new Date(ey, em - 1, ed)
  // 提到循环外：原先在每日分支里重复调用，12 个月 × 31 天会多算约 370 次格式化
  const endStr = formatLocalDate(end)
  const todayStr = formatLocalDate(new Date())
  const list: MonthCell[] = []
  const cursor = new Date(sy, sm - 1, 1)
  while (cursor <= end) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const offset = (new Date(year, month, 1).getDay() - props.weekStart + 7) % 7
    const days: DayCell[] = []
    let total = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const date = formatLocalDate(new Date(year, month, d))
      const count = props.dayCounts.get(date) || 0
      total += count
      days.push({
        date,
        dayNum: d,
        count,
        style: { background: heatCellColor(heatLevel(count), props.color) },
        // 当前月内超出范围末尾（今天之后）的日期弱化展示
        future: date > endStr,
        today: date === todayStr,
        tooltip: heatCellTooltip(props.i18n, date, count),
      })
    }
    list.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      title: `${year}-${String(month + 1).padStart(2, "0")}`,
      total,
      offset,
      weekhead: weekhead.value,
      days,
    })
    cursor.setMonth(month + 1)
  }
  return list
})
</script>

<style lang="scss">
@use "../../styles/CommitCalendar.scss";
@use "../../styles/index.scss";
</style>
