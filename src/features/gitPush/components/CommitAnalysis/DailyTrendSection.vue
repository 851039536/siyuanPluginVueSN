<!-- gitPush 提交分析最近 30 天提交趋势区块（每日柱状高度） -->
<template>
  <div class="gpa-section">
    <!-- 区块标题："最近 30 天提交趋势" -->
    <div class="gpa-section-title">
      {{ i18n.analysisDailyTitle }}
    </div>
    <div class="gpa-daily">
      <!-- 每日柱 -->
      <div
        v-for="d in rows"
        :key="d.label"
        class="gpa-daily-col"
        :title="`${d.label}: ${d.count}`"
      >
        <div
          class="gpa-daily-bar"
          :style="{ height: d.pct }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析最近 30 天提交趋势区块（每日柱状高度，0 次日留空柱）
import type { CommitAnalysisStats } from "../../types"
import { computed } from "vue"
import { withBarPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 dailyCommits） */
  stats: CommitAnalysisStats
}>()

/** 每日趋势行视图：高度百分比预计算（0 次日留空柱） */
const rows = computed(() => withBarPct(props.stats.dailyCommits, { zeroAsEmpty: true }))
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
