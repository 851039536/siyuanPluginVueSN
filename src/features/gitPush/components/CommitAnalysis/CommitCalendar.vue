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

      <!-- 日格子：月初偏移空格 + 每日（未来日期弱化，今天描边，点击查看当日明细） -->
      <div class="gpa-cal-days">
        <span
          v-for="blank in m.offset"
          :key="`b${blank}`"
          class="gpa-cal-day is-blank"
        />
        <button
          v-for="d in m.days"
          :key="d.date"
          type="button"
          class="gpa-cal-day"
          :class="{
            'is-future': d.future,
            'is-today': d.today,
            'is-selected': isEndpoint(d.date),
            'is-in-range': isInRange(d.date),
          }"
          :style="d.style"
          :title="d.tooltip"
          :aria-label="d.tooltip"
          :aria-pressed="isInRange(d.date)"
          tabindex="-1"
          @mousedown="drag.onDown(d.date, $event)"
          @click="onCellClick(d.date, $event)"
          @mouseenter="drag.onEnter(d.date)"
        >
          <span class="gpa-cal-day-num">{{ d.dayNum }}</span>
          <span
            v-if="d.count > 0"
            class="gpa-cal-day-count"
          >{{ d.count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 提交日历：月卡片网格，日格可点击钻取当日明细。
// 键盘可达性由热力图承担（那边整张网格一个 Tab 位 + 方向键），此处日格 tabindex="-1" 只做鼠标/触摸入口，
// 避免 365 个按钮各自入 Tab 序把键盘用户困在网格里。
import type { CommitHeatMetric } from "../../types"
import { computed } from "vue"
import { useDayDragSelect } from "../../composables/useDayDragSelect"
import { buildDayCell, formatLocalDate } from "../../utils"
import { ANALYSIS_WEEKDAY_KEYS, COMMIT_HEAT_METRIC_META } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 日计数映射（YYYY-MM-DD → 当日指标值，buildDayMetricMap 产出） */
  dayCounts: Map<string, number>
  /** 范围起止（YYYY-MM-DD，resolveAnalysisRange 格式化产出） */
  start: string
  end: string
  /** 每周第一天（1=周一, 0=周日） */
  weekStart: 0 | 1
  /** 热力主色（#RRGGBB） */
  color: string
  /** 热力档位阈值（与热力图共用同一份，保证切换视图后同一天颜色不变） */
  thresholds: readonly number[]
  /** 当前指标口径（决定格子 tooltip 的量词） */
  metric: CommitHeatMetric
  /** 选中区间起（YYYY-MM-DD，空串 = 未选中；已归一化为 start ≤ end） */
  selStart: string
  /** 选中区间止（与 selStart 相同即单选一天） */
  selEnd: string
}>()

const emit = defineEmits<{
  /** 单击日格：extend=true（Shift）时以当前锚点为另一端扩展成区间 */
  pick: [date: string, extend: boolean]
  /** 拖拽起锚 */
  dragStart: [date: string]
  /** 拖拽掠过另一日 */
  dragTo: [date: string]
}>()

/** 拖拽选区间：与热力图共用同一套状态机（日历日格更大，跨月卡拖动同样成立） */
const drag = useDayDragSelect({
  onStart: (date) => emit("dragStart", date),
  onExtend: (date) => emit("dragTo", date),
})

/** 是否为区间端点（单选一天时两端重合，只有一个描边） */
function isEndpoint(date: string): boolean {
  return !!props.selStart && (date === props.selStart || date === props.selEnd)
}

/** 是否落在选中区间内（闭区间，端点也算在内） */
function isInRange(date: string): boolean {
  return !!props.selStart && date >= props.selStart && date <= props.selEnd
}

/** 点击日格：拖拽收尾时浏览器会补发一次 click，必须丢掉（否则区间被取消） */
function onCellClick(date: string, e: MouseEvent) {
  if (drag.suppressClick.value) return
  emit("pick", date, e.shiftKey)
}

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
  /** 预计算的格子内联样式对象（buildDayCell 产出，与热力图同一口径） */
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
  const [sy, sm] = props.start.split("-").map(Number)
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
      // 日格样式与 tooltip 经 utils.buildDayCell 预计算（与热力图同一口径、同一份阈值与量词）
      days.push({
        ...buildDayCell(props.i18n, date, count, props.color, {
          thresholds: props.thresholds,
          unitKey: COMMIT_HEAT_METRIC_META[props.metric].unitKey,
        }),
        dayNum: d,
        // 当前月内超出范围末尾（今天之后）的日期弱化展示
        future: date > endStr,
        today: date === todayStr,
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
