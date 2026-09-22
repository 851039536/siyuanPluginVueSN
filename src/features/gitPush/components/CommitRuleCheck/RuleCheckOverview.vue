<!-- gitPush 提交规则检查总览区块（检查数/不合规/合规率卡片 + 规则提示） -->
<template>
  <div>
    <!-- 总览卡片（共享 KPI 卡片网格，三列等分） -->
    <StatCardGrid
      :min-width="90"
      :cards="overviewCards"
    />

    <!-- 规则提示 -->
    <div class="grc-hint">
      {{ i18n.ruleCheckHint.replace("{0}", COMMIT_TYPE_VALUES.join(" / ")) }}
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查总览区块（检查数/不合规/合规率卡片 + 规则提示）
import type { CommitRuleCheckStats } from "../../types"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed } from "vue"
import { COMMIT_TYPE_VALUES } from "../../types"
import StatCardGrid from "../common/StatCardGrid.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 totalCommits/violationCount/compliantCount） */
  stats: CommitRuleCheckStats
}>()

/** 合规率（保留 1 位小数；本组件仅在 totalCommits > 0 时由父级渲染，无需除零兜底） */
const complianceRate = computed(() => {
  return Number(((props.stats.compliantCount / props.stats.totalCommits) * 100).toFixed(1))
})

/** 总览卡片：检查提交数 / 不合规提交（错误色） / 合规率 */
const overviewCards = computed<StatCardItem[]>(() => [
  { key: "total", value: props.stats.totalCommits, label: props.i18n.ruleCheckTotal },
  { key: "violations", value: props.stats.violationCount, label: props.i18n.ruleCheckViolations, cls: "gp-statgrid-card--danger" },
  { key: "rate", value: `${complianceRate.value}%`, label: props.i18n.ruleCheckCompliant },
])
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
