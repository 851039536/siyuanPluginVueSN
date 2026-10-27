<!-- gitPush 提交分析热力图/日历区块（按 viewSettings 切换视图；单击看当日、拖拽/Shift+点击框选区间看统计） -->
<template>
  <div class="gpa-section">
    <!-- 区块标题："提交热力图"/"提交日历" + 范围摘要（连续 / 最长连续 / 合计，口径随当前指标） -->
    <div class="gpa-section-title">
      {{ viewSettings.view === "heatmap" ? i18n.analysisHeatTitle : i18n.analysisCalendarTitle }}
      <span class="gpa-heat-stats">
        <span
          v-for="(item, i) in summaryItems"
          :key="i"
        >{{ item }}</span>
      </span>
    </div>
    <CommitHeatmap
      v-if="viewSettings.view === 'heatmap'"
      :i18n="i18n"
      :day-counts="dayCounts"
      :start="range.start"
      :end="range.end"
      :week-start="viewSettings.weekStart"
      :color="viewSettings.color"
      :thresholds="thresholds"
      :scale-mode="viewSettings.heatScale"
      :metric="viewSettings.heatMetric"
      :density="viewSettings.heatDensity"
      :sel-start="selStart"
      :sel-end="selEnd"
      @pick="onPick"
      @drag-start="onDragStart"
      @drag-to="onDragTo"
    />
    <CommitCalendar
      v-else
      :i18n="i18n"
      :day-counts="dayCounts"
      :start="range.start"
      :end="range.end"
      :week-start="viewSettings.weekStart"
      :color="viewSettings.color"
      :thresholds="thresholds"
      :metric="viewSettings.heatMetric"
      :sel-start="selStart"
      :sel-end="selEnd"
      @pick="onPick"
      @drag-start="onDragStart"
      @drag-to="onDragTo"
    />

    <!-- 区间统计（跨多天时就地展开；端点重合时退回当日明细） -->
    <RangeCommitDetail
      v-if="isRange"
      :i18n="i18n"
      :sel-start="selStart"
      :sel-end="selEnd"
      :summary="rangeSummary"
      :entries="rangeEntries"
      @close="clearSelection"
      @pick-day="selectSingleDay"
    />

    <!-- 当日明细（未选中格子时不占版面） -->
    <DayCommitDetail
      v-else-if="selectedDate"
      :i18n="i18n"
      :date="selectedDate"
      :entries="selectedEntries"
      @close="clearSelection"
      @view-project="emit('viewProject', $event)"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析热力图/日历区块（viewSettings 控制 heatmap/calendar 切换 + 指标口径 + 自适应/固定分档 + 选中/框选）
// 选中态、分档阈值与摘要都放在本层：两个视图共用同一份，切换视图时同一天的着色与选中不跳变。
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import { computed, ref, watch } from "vue"
import {
  buildDayMetricMap,
  computeHeatThresholds,
  formatLocalDate,
  resolveAnalysisRange,
  summarizeCommitRange,
  summarizeHeatRange,
} from "../../utils"
import { HEAT_LEVEL_THRESHOLDS } from "../../types"
import CommitCalendar from "./CommitCalendar.vue"
import CommitHeatmap from "./CommitHeatmap.vue"
import DayCommitDetail from "./DayCommitDetail.vue"
import RangeCommitDetail from "./RangeCommitDetail.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 entries 构建日计数与明细） */
  stats: CommitAnalysisStats
  viewSettings: CommitAnalysisViewSettings
}>()

const emit = defineEmits<{
  /** 明细行点击：跳转该项目的列表视图 */
  viewProject: [projectId: string]
}>()

/** 日值映射（YYYY-MM-DD → 当日指标值；指标可为提交数 / 去重项目数 / 去重作者数） */
const dayCounts = computed(() => buildDayMetricMap(props.stats.entries, props.viewSettings.heatMetric))

/** 当前显示范围起止（YYYY-MM-DD） */
const range = computed(() => {
  const { start, end } = resolveAnalysisRange(props.viewSettings.range)
  return { start: formatLocalDate(start), end: formatLocalDate(end) }
})

/**
 * 热力档位阈值：
 * - fixed：直接沿用固定档 1/3/6/12；
 * - auto：只取**当前范围内**的日计数做分位数（范围外的条目不应影响本视图的深浅）。
 */
const thresholds = computed(() => {
  if (props.viewSettings.heatScale === "fixed") return [...HEAT_LEVEL_THRESHOLDS]
  const { start, end } = range.value
  const counts: number[] = []
  for (const [date, count] of dayCounts.value) {
    if (date >= start && date <= end) counts.push(count)
  }
  return computeHeatThresholds(counts)
})

/** 范围摘要（连续 / 最长连续 / 合计）：口径跟随当前指标，随 dayCounts 与范围一起重算 */
const summary = computed(() => summarizeHeatRange(dayCounts.value, range.value.start, range.value.end))

/** 标题行摘要文案（三个数字；total 走千分位，避免长范围下数字过长） */
const summaryItems = computed(() => {
  const { currentStreak, longestStreak, total } = summary.value
  return [
    String(props.i18n.analysisHeatStatCurrent || "").replace("{0}", String(currentStreak)),
    String(props.i18n.analysisHeatStatLongest || "").replace("{0}", String(longestStreak)),
    String(props.i18n.analysisHeatStatTotal || "").replace("{0}", total.toLocaleString()),
  ]
})

// ── 选区：anchor 是锚点（单击点下的那天 / 拖拽起点），cursor 是另一端 ──
// 只存这两个原始值，区间起止由它们归一化得出——避免「start/end 双向维护」时出现 start > end 的中间态。

/** 区间锚点（空串 = 未选中） */
const anchor = ref("")
/** 区间另一端 */
const cursor = ref("")

/** 归一化后的区间起（start ≤ end） */
const selStart = computed(() => (!anchor.value ? "" : anchor.value < cursor.value ? anchor.value : cursor.value))
/** 归一化后的区间止 */
const selEnd = computed(() => (!anchor.value ? "" : anchor.value < cursor.value ? cursor.value : anchor.value))
/** 是否跨多天（端点重合即单选一天，走当日明细） */
const isRange = computed(() => !!anchor.value && anchor.value !== cursor.value)
/** 单选的具体日期（跨天时为空，避免同时渲染两个面板） */
const selectedDate = computed(() => (!anchor.value || isRange.value ? "" : anchor.value))

/**
 * 单击 / Shift+单击。
 * - 无 Shift：整块重置为这一天；再次单击同一天则取消选中。
 * - Shift：保留锚点，把另一端移到该日（连续按 Shift+点击可反复调整右端）。
 */
function onPick(date: string, extend: boolean) {
  if (extend && anchor.value) {
    cursor.value = date
    return
  }
  if (anchor.value === date && cursor.value === date) {
    clearSelection()
    return
  }
  anchor.value = date
  cursor.value = date
}

/** 拖拽起锚：整块重置到起点 */
function onDragStart(date: string) {
  anchor.value = date
  cursor.value = date
}

/** 拖拽掠过：只动另一端 */
function onDragTo(date: string) {
  if (anchor.value) cursor.value = date
}

/** 收缩为单日（区间面板「最活跃一天」点击后，直接切到该日明细） */
function selectSingleDay(date: string) {
  anchor.value = date
  cursor.value = date
}

function clearSelection() {
  anchor.value = ""
  cursor.value = ""
}

/** 范围切换到不含该日的区间时清空选中，避免面板显示「范围外的一天」 */
watch(range, ({ start, end }) => {
  if (selStart.value && (selStart.value > end || selEnd.value < start)) clearSelection()
})

// ── 明细数据 ──

/** 选中日的提交条目（按本地日期比对，与日计数同一口径） */
const selectedEntries = computed(() => {
  if (!selectedDate.value) return []
  return props.stats.entries.filter((e) => formatLocalDate(new Date(e.date)) === selectedDate.value)
})

/** 区间内的条目（供区间面板解析项目名；条目数受提交日志上限约束，重复过滤的代价可忽略） */
const rangeEntries = computed(() => {
  if (!isRange.value) return []
  const start = selStart.value
  const end = selEnd.value
  return props.stats.entries.filter((e) => {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) return false
    const key = formatLocalDate(d)
    return key >= start && key <= end
  })
})

/** 区间聚合（提交数口径，与标题行的「指标合计」有意区分；非区间态返回全零，模板由 v-if 拦住不渲染） */
const rangeSummary = computed(() =>
  isRange.value
    ? summarizeCommitRange(props.stats.entries, selStart.value, selEnd.value)
    : { total: 0, activeDays: 0, daySpan: 0, projectCount: 0, authorCount: 0, busiest: null, topProjects: [], topAuthors: [] },
)
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
