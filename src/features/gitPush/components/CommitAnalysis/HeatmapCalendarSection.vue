<!-- gitPush 提交分析热力图/日历区块（按 viewSettings 切换视图） -->
<template>
  <div class="gpa-section">
    <!-- 区块标题："提交热力图"/"提交日历" -->
    <div class="gpa-section-title">
      {{ viewSettings.view === "heatmap" ? i18n.analysisHeatTitle : i18n.analysisCalendarTitle }}
    </div>
    <CommitHeatmap
      v-if="viewSettings.view === 'heatmap'"
      :i18n="i18n"
      :day-counts="dayCounts"
      :start="range.start"
      :end="range.end"
      :week-start="viewSettings.weekStart"
      :color="viewSettings.color"
    />
    <CommitCalendar
      v-else
      :i18n="i18n"
      :day-counts="dayCounts"
      :start="range.start"
      :end="range.end"
      :week-start="viewSettings.weekStart"
      :color="viewSettings.color"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析热力图/日历区块（viewSettings 控制 heatmap/calendar 切换）
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import { computed } from "vue"
import { buildDayCountMap, formatLocalDate, resolveAnalysisRange } from "../../utils"
import CommitCalendar from "./CommitCalendar.vue"
import CommitHeatmap from "./CommitHeatmap.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 entries 构建日计数） */
  stats: CommitAnalysisStats
  viewSettings: CommitAnalysisViewSettings
}>()

/** 日计数映射（YYYY-MM-DD → 提交数） */
const dayCounts = computed(() => buildDayCountMap(props.stats.entries))

/** 当前显示范围起止（YYYY-MM-DD） */
const range = computed(() => {
  const { start, end } = resolveAnalysisRange(props.viewSettings.range)
  return { start: formatLocalDate(start), end: formatLocalDate(end) }
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
