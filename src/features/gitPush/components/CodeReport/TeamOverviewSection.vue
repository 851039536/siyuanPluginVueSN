<!-- gitPush 代码统计报告：团队总览分区（Pulse 式汇总头 + KPI 卡片：团队成员/总提交数/总代码量/最活跃贡献者） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："团队总览" -->
    <div class="gpr-section-title">
      {{ i18n.reportTeamTitle }}
    </div>
    <!-- Pulse 式范围感知汇总头（"N 次提交（范围）"，对齐 GitHub Insights 的区间总计语义；组件派生，不进 CodeReportData） -->
    <div class="gpr-pulse-summary">
      {{ pulseSummary }}
    </div>
    <!-- 总览卡片（共享 KPI 卡片网格，配置驱动：数值 + 标签） -->
    <StatCardGrid
      :min-width="110"
      :cards="overviewCards"
    />
  </div>
</template>

<script setup lang="ts">
// 团队总览分区：从 teamOverview 派生 KPI 卡片（成员数/总提交/总代码量/最活跃贡献者）
import type { CodeReportData } from "../../types"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed } from "vue"
import { fmtTemplate } from "../../utils/i18nFormat"
import StatCardGrid from "../common/StatCardGrid.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 teamOverview / totalCommits / rangeLabel） */
  report: CodeReportData
}>()

/** Pulse 式汇总头（范围感知：totalCommits + rangeLabel 组件 computed 派生，避免改 CodeReportData 形状） */
const pulseSummary = computed(() =>
  fmtTemplate(props.i18n.reportPulseSummary, String(props.report.totalCommits), props.report.rangeLabel),
)

/** 总览卡片配置：团队成员/总提交数/总代码量/最活跃贡献者（最活跃用主题色） */
const overviewCards = computed<StatCardItem[]>(() => [
  { key: "members", value: props.report.teamOverview.memberCount, label: props.i18n.reportMemberCount },
  { key: "commits", value: props.report.totalCommits, label: props.i18n.reportTotalCommits },
  { key: "lines", value: props.report.teamOverview.totalLines, label: props.i18n.reportTotalLines },
  { key: "top", value: props.report.teamOverview.topAuthor, label: props.i18n.reportTopAuthor, cls: "gp-statgrid-card--accent", truncate: true },
])
</script>

<style lang="scss">
@use "../../styles/CodeReportPanel.scss";
@use "../../styles/index.scss";
</style>
