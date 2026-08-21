<!-- gitPush 提交分析项目提交排行区块（条形 + 百分比，行可点击跳转列表） -->
<template>
  <div class="gpa-section gpa-section--scroll">
    <!-- 区块标题："项目提交排行" -->
    <div class="gpa-section-title">
      {{ i18n.analysisProjectRanking }}
    </div>
    <div class="gpa-bar-list">
      <div
        v-for="row in rows"
        :key="row.id"
        class="gpa-bar-row gpa-bar-row--clickable"
        @click="emit('viewProject', row.id)"
      >
        <span
          class="gpa-bar-label"
          :title="row.name"
        >{{ row.name }}</span>
        <span class="gpa-bar-track">
          <span
            class="gpa-bar-fill"
            :style="{ width: row.pct }"
          />
        </span>
        <!-- 数字列：占总提交百分比（tooltip 保留原始次数） -->
        <span
          class="gpa-bar-num"
          :title="row.title"
        >{{ row.shareText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析项目提交排行区块（条形 + 百分比，点击跳转列表视图）
import type { CommitAnalysisStats } from "../../types"
import { computed } from "vue"
import { withBarPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 projectRanking + totalCommits） */
  stats: CommitAnalysisStats
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 百分比格式化：保留 1 位小数并去掉尾零；极小占比显示 <0.1% 避免误导 */
function formatShare(share: number): string {
  if (share > 0 && share < 0.1) return "<0.1%"
  return `${share.toFixed(1).replace(/\.0$/, "")}%`
}

/** 项目排行行视图：条形宽度相对最大值；数字列显示占总提交的百分比 */
const rows = computed(() => {
  const total = props.stats.totalCommits || 1
  return withBarPct(props.stats.projectRanking).map((r) => {
    const shareText = formatShare((r.count / total) * 100)
    return {
      ...r,
      shareText,
      title: String(props.i18n.analysisShareTooltip || "")
        .replace("{0}", String(r.count))
        .replace("{1}", shareText),
    }
  })
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
