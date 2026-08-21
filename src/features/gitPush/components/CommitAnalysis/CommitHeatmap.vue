<!-- 提交热力图：GitHub 风格贡献图，周为列 × 7 天为行，格子按日提交数分级着色（配色/周起始/范围由设置驱动） -->
<template>
  <div
    class="gpa-heat"
    :style="{ '--gpa-heat-weeks': String(totalWeeks) }"
  >
    <div class="gpa-heat-scroll">
      <!-- 月份标签行（gridColumn 对齐到对应周列首格） -->
      <div class="gpa-heat-months">
        <span
          v-for="m in monthLabels"
          :key="m.key"
          class="gpa-heat-month"
          :style="{ gridColumn: m.col }"
        >{{ m.text }}</span>
      </div>

      <div class="gpa-heat-body">
        <!-- 星期标签列（按 weekStart 显示第 1/3/5 行） -->
        <div class="gpa-heat-weekdays">
          <span
            v-for="w in weekdayLabels"
            :key="w"
            class="gpa-heat-weekday"
          >{{ w }}</span>
        </div>

        <!-- 周列 × 7 行网格（grid-auto-flow: column，末尾补齐完整周） -->
        <div class="gpa-heat-grid">
          <div
            v-for="(cell, idx) in cells"
            :key="idx"
            class="gpa-heat-cell"
            :class="{ 'is-empty': !cell.date }"
            :style="cell.date ? { background: heatCellColor(cell.level, color) } : undefined"
            :title="cell.date ? cell.tooltip : ''"
          />
        </div>
      </div>

      <!-- 图例：少 [0~4 级] 多 -->
      <div class="gpa-heat-legend">
        <!-- 图例文案："少" -->
        <span class="gpa-heat-legend-text">{{ i18n.analysisLess }}</span>
        <span
          v-for="lvl in 5"
          :key="lvl"
          class="gpa-heat-legend-cell"
          :style="{ background: heatCellColor(lvl - 1, color) }"
        />
        <!-- 图例文案："多" -->
        <span class="gpa-heat-legend-text">{{ i18n.analysisMore }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { formatLocalDate, heatCellColor, heatLevel } from "../../utils"

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

/** 星期短名 i18n 键（数组下标 = Date.getDay） */
const WEEKDAY_KEYS = [
  "analysisWdSun", "analysisWdMon", "analysisWdTue", "analysisWdWed",
  "analysisWdThu", "analysisWdFri", "analysisWdSat",
]

/** 月份短名 i18n 键（数组下标 = 月份 0~11） */
const MONTH_KEYS = [
  "analysisMonthJan", "analysisMonthFeb", "analysisMonthMar", "analysisMonthApr",
  "analysisMonthMay", "analysisMonthJun", "analysisMonthJul", "analysisMonthAug",
  "analysisMonthSep", "analysisMonthOct", "analysisMonthNov", "analysisMonthDec",
]

/** 单元格 tooltip："2026-08-01（周六）：3 次提交" */
function cellTooltip(date: string, count: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return String(props.i18n.analysisHeatTooltip || "")
    .replace("{0}", date)
    .replace("{1}", props.i18n[WEEKDAY_KEYS[dow]] || "")
    .replace("{2}", String(count))
}

/** 周列 × 7 行单元格：起点回退到 weekStart 对齐，范围末尾补齐完整周（空单元格隐藏） */
const cells = computed(() => {
  const [sy, sm, sd] = props.start.split("-").map(Number)
  const [ey, em, ed] = props.end.split("-").map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  while (start.getDay() !== props.weekStart) start.setDate(start.getDate() - 1)
  const list: { date: string, level: number, tooltip: string }[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const date = formatLocalDate(cursor)
    const count = props.dayCounts.get(date) || 0
    list.push({ date, level: heatLevel(count), tooltip: cellTooltip(date, count) })
    cursor.setDate(cursor.getDate() + 1)
  }
  const remainder = list.length % 7
  for (let i = 0; i < (7 - remainder) % 7; i++) list.push({ date: "", level: 0, tooltip: "" })
  return list
})

const totalWeeks = computed(() => Math.ceil(cells.value.length / 7))

/** 月份标签：周首格月份变化处落标签（key 含年月保证跨年范围去重） */
const monthLabels = computed(() => {
  const labels: { key: string, text: string, col: number }[] = []
  let lastMonth = -1
  for (let week = 0; week < totalWeeks.value; week++) {
    const cell = cells.value[week * 7]
    if (!cell || !cell.date) continue
    // 直接按 YYYY-MM-DD 文本取月份，避免 new Date 按 UTC 解析在西半球时区月初回退一月
    const m = Number(cell.date.slice(5, 7)) - 1
    if (m !== lastMonth) {
      labels.push({
        key: `${cell.date.slice(0, 7)}-${week}`,
        text: props.i18n[MONTH_KEYS[m]] || "",
        col: week + 1,
      })
      lastMonth = m
    }
  }
  return labels
})

/** 左侧星期标签：weekStart 起的第 1/3/5 行（如 周一/周三/周五 或 周日/周二/周四） */
const weekdayLabels = computed(() => {
  const rows = [props.weekStart, (props.weekStart + 2) % 7, (props.weekStart + 4) % 7]
  return rows.map((d) => props.i18n[WEEKDAY_KEYS[d]] || "")
})
</script>

<style lang="scss">
@use "../../styles/CommitHeatmap.scss";
@use "../../styles/index.scss";
</style>
