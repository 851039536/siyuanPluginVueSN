<!-- gitPush 提交分析项目提交排行区块（徽章式排行行：名次 + 项目名 + 提交次数 + 占比，行可点击跳转） -->
<template>
  <div class="gpa-section gpa-section--scroll">
    <!-- 区块标题："项目提交排行" -->
    <div class="gpa-section-title">
      {{ i18n.analysisProjectRanking }}
    </div>
    <div class="gpa-rank-list">
      <Button
        v-for="(row, i) in rows"
        :key="row.id"
        class="gpa-rank-row"
        variant="ghost"
        size="xsmall"
        dense
        :title="row.title"
        @click="emit('viewProject', row.id)"
      >
        <!-- 名次（前三名主题色强调，其余弱化） -->
        <span
          class="gpa-rank-no"
          :class="{ 'gpa-rank-no--top': i < 3 }"
        >{{ i + 1 }}</span>
        <!-- 项目名（自适应列宽，超长省略；完整名称与路径见 hover） -->
        <span class="gpa-rank-name">{{ row.name }}</span>
        <!-- 提交次数徽章（走共享 Tag，与全站徽章同观感） -->
        <Tag
          class="gpa-rank-count"
          variant="primary"
          size="xsmall"
          shape="square"
        >{{ row.count }}</Tag>
        <!-- 占比（等宽右对齐，纵向可比；tooltip 保留原始次数） -->
        <span class="gpa-rank-share">{{ row.shareText }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析项目提交排行区块（徽章式排行行，点击跳转列表视图）。
// 原「细长条形 + 百分比」方案需用 calc 按比例推算轨道宽度，CSS calc 不支持百分比作为乘法因子，
// 连续三轮出现宽度塌陷/右侧留空；改徽章式布局后宽度全部交给 grid 列模板，零宽度计算。
import type { CommitAnalysisStats } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Tag from "@/components/Tag.vue"

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

/** 排行行视图：提交次数 + 占总提交百分比（tooltip 保留"次数 + 占比"完整口径） */
const rows = computed(() => {
  const total = props.stats.totalCommits || 1
  return props.stats.projectRanking.map((r) => {
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
