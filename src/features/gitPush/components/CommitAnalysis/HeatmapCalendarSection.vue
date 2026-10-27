<!-- gitPush 提交分析热力图/日历区块（按 viewSettings 切换视图；单击看当日、拖拽/Shift+点击框选区间看统计） -->
<template>
  <div class="gpa-section">
    <!-- 区块标题："提交热力图"/"提交日历" + 范围摘要（连续 / 最长连续 / 合计，口径与单位随粒度与指标） -->
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
      :bucket-counts="bucketCounts"
      :start="range.start"
      :end="range.end"
      :granularity="granularity"
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
// gitPush 提交分析热力图/日历区块（viewSettings 控制 heatmap/calendar 切换 + 指标口径 + 自适应/固定分档 + 粒度 + 选中/框选）
// 选中态、粒度、分档阈值与摘要都放在本层：两个视图共用同一份，切换视图时同一天的着色与选中不跳变。
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import type { HeatBucketSpan } from "../../utils"
import { computed, ref, watch } from "vue"
import {
  buildDayMetricMap,
  buildHeatBuckets,
  buildHeatMetricMap,
  computeHeatThresholds,
  fixedHeatThresholds,
  formatLocalDate,
  resolveAnalysisRange,
  resolveHeatGranularity,
  summarizeCommitRange,
  summarizeHeatStreak,
} from "../../utils"
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

/** 当前显示范围起止（YYYY-MM-DD） */
const range = computed(() => {
  const { start, end } = resolveAnalysisRange(props.viewSettings.range)
  return { start: formatLocalDate(start), end: formatLocalDate(end) }
})

/** 格子粒度：由跨度自动决定（≤1 年按日 / ≤2.5 年按周 / 更久按月） */
const granularity = computed(() => resolveHeatGranularity(range.value.start, range.value.end))

/** 日值映射（日历视图用；指标可为提交数 / 去重项目数 / 去重作者数） */
const dayCounts = computed(() => buildDayMetricMap(props.stats.entries, props.viewSettings.heatMetric))

/**
 * 桶值映射（热力图用）：按「粒度 + 指标」聚合，**不**把日值相加——
 * projects / authors 是去重计数，逐日相加会把连续活跃 10 天的人算成 10 个。
 */
const bucketCounts = computed(() => buildHeatMetricMap(
  props.stats.entries,
  granularity.value,
  props.viewSettings.heatMetric,
  props.viewSettings.weekStart,
))

/**
 * 热力档位阈值：
 * - fixed：把固定档 1/3/6/12（按日量级）折算到当前粒度，否则周/月视图几乎每格都顶到最高档；
 * - auto：只取**当前范围内**的非零桶值做分位数（范围外的条目不应影响本视图的深浅）。
 */
const thresholds = computed(() => {
  if (props.viewSettings.heatScale === "fixed") return fixedHeatThresholds(granularity.value)
  const { start, end } = range.value
  const values: number[] = []
  // 桶首日必落在范围内（首桶被 start 截断后键即为 start），故可直接用字符串区间比较
  for (const [key, value] of bucketCounts.value) {
    if (key >= start && key <= end) values.push(value)
  }
  return computeHeatThresholds(values)
})

/** 范围摘要（连续 / 最长连续 / 合计）：按桶序列统计，单位随粒度变化 */
const summary = computed(() => {
  const counts = bucketCounts.value
  return summarizeHeatStreak(buildHeatBuckets(granularity.value, range.value.start, range.value.end, props.viewSettings.weekStart)
    .map((b) => counts.get(b.start) || 0))
})

/** 摘要文案的单位（日→天 / 周→周 / 月→个月） */
const unitKey = computed(() => ({
  day: "analysisHeatUnitDay",
  week: "analysisHeatUnitWeek",
  month: "analysisHeatUnitMonth",
})[granularity.value])

/** 标题行摘要文案（三个数字；total 走千分位，避免长范围下数字过长） */
const summaryItems = computed(() => {
  const { currentStreak, longestStreak, total } = summary.value
  const unit = props.i18n[unitKey.value] || ""
  const fill = (key: string, value: string) =>
    String(props.i18n[key] || "").replace("{0}", value).replace("{1}", unit)
  return [
    fill("analysisHeatStatCurrent", String(currentStreak)),
    fill("analysisHeatStatLongest", String(longestStreak)),
    String(props.i18n.analysisHeatStatTotal || "").replace("{0}", total.toLocaleString()),
  ]
})

// ── 选区：anchor 是锚点（单击点下的那格 / 拖拽起点），cursor 是另一端 ──
// 存的是「格子区间」而非单日：周/月粒度下一格覆盖多天，只存日期会让区间统计漏掉格内其余天。
// 区间起止由两端归一化得出，避免「start/end 双向维护」时出现 start > end 的中间态。

/** 区间锚点（null = 未选中） */
const anchor = ref<HeatBucketSpan | null>(null)
/** 区间另一端 */
const cursor = ref<HeatBucketSpan | null>(null)

/** 归一化后的区间起 */
const selStart = computed(() => {
  if (!anchor.value || !cursor.value) return ""
  return anchor.value.start < cursor.value.start ? anchor.value.start : cursor.value.start
})
/** 归一化后的区间止 */
const selEnd = computed(() => {
  if (!anchor.value || !cursor.value) return ""
  return anchor.value.end > cursor.value.end ? anchor.value.end : cursor.value.end
})
/** 是否跨多天（端点重合即单日，走当日明细） */
const isRange = computed(() => !!selStart.value && selStart.value !== selEnd.value)
/** 单日选中（跨天时为空，避免同时渲染两个面板） */
const selectedDate = computed(() => (isRange.value ? "" : selStart.value))

/**
 * 单击 / Shift+单击。
 * - 无 Shift：整块重置为这一格；再次单击同一格则取消选中。
 * - Shift：保留锚点，把另一端移到该格（连续按 Shift+点击可反复调整右端）。
 */
function onPick(span: HeatBucketSpan, extend: boolean) {
  if (extend && anchor.value) {
    cursor.value = { ...span }
    return
  }
  if (selStart.value === span.start && selEnd.value === span.end) {
    clearSelection()
    return
  }
  anchor.value = { ...span }
  cursor.value = { ...span }
}

/** 拖拽起锚：整块重置到起点 */
function onDragStart(span: HeatBucketSpan) {
  anchor.value = { ...span }
  cursor.value = { ...span }
}

/** 拖拽掠过：只动另一端 */
function onDragTo(span: HeatBucketSpan) {
  if (anchor.value) cursor.value = { ...span }
}

/** 收缩为单日（区间面板「最活跃一天」点击后，直接切到该日明细） */
function selectSingleDay(date: string) {
  anchor.value = { start: date, end: date }
  cursor.value = { start: date, end: date }
}

function clearSelection() {
  anchor.value = null
  cursor.value = null
}

/** 范围/粒度切换到不含选中区间的时段时清空选中，避免面板显示「范围外的一段」 */
watch([range, granularity], ([r]) => {
  if (selStart.value && (selStart.value > r.end || selEnd.value < r.start)) clearSelection()
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
