<!-- gitPush 提交分析热力图/日历区块（按 viewSettings 切换视图；点击日格展开当日明细） -->
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
      :selected-date="selectedDate"
      @select-day="onSelectDay"
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
      :selected-date="selectedDate"
      @select-day="onSelectDay"
    />

    <!-- 当日明细（就地展开；未选中格子时不占版面） -->
    <DayCommitDetail
      v-if="selectedDate"
      :i18n="i18n"
      :date="selectedDate"
      :entries="selectedEntries"
      @close="selectedDate = ''"
      @view-project="emit('viewProject', $event)"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析热力图/日历区块（viewSettings 控制 heatmap/calendar 切换 + 指标口径 + 自适应/固定分档 + 当日明细选中态）
// 选中态、分档阈值与摘要都放在本层：两个视图共用同一份，切换视图时同一天的着色与选中不跳变。
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import { computed, ref, watch } from "vue"
import { buildDayMetricMap, computeHeatThresholds, formatLocalDate, resolveAnalysisRange, summarizeHeatRange } from "../../utils"
import { HEAT_LEVEL_THRESHOLDS } from "../../types"
import CommitCalendar from "./CommitCalendar.vue"
import CommitHeatmap from "./CommitHeatmap.vue"
import DayCommitDetail from "./DayCommitDetail.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 entries 构建日计数与当日明细） */
  stats: CommitAnalysisStats
  viewSettings: CommitAnalysisViewSettings
}>()

const emit = defineEmits<{
  /** 当日明细行点击：跳转该项目的列表视图 */
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

/** 选中日期（空串 = 未选中；再次点击同日取消） */
const selectedDate = ref("")
/** 范围切换到不含该日的区间时清空选中，避免面板显示「范围外的一天」 */
watch(range, ({ start, end }) => {
  if (selectedDate.value && (selectedDate.value < start || selectedDate.value > end)) selectedDate.value = ""
})

function onSelectDay(date: string) {
  selectedDate.value = selectedDate.value === date ? "" : date
}

/** 选中日的提交条目（按本地日期比对，与日计数同一口径） */
const selectedEntries = computed(() => {
  if (!selectedDate.value) return []
  return props.stats.entries.filter((e) => formatLocalDate(new Date(e.date)) === selectedDate.value)
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
