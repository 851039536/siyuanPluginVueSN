<!-- gitPush 代码统计报告：团队总览分区（KPI 卡片：团队成员/总提交数/总代码量/平均质量/最活跃贡献者） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："团队总览" -->
    <div class="gpr-section-title">
      {{ i18n.reportTeamTitle }}
    </div>
    <!-- 总览卡片（配置驱动：数值 + 标签） -->
    <div class="gpr-cards">
      <div
        v-for="(card, i) in overviewCards"
        :key="i"
        class="gpr-card"
        :class="card.cls"
      >
        <!-- 卡片数值（等宽字体突出展示） -->
        <div class="gpr-card-value">
          {{ card.value }}
        </div>
        <!-- 卡片标签（两级字号制：辅助标签） -->
        <div class="gpr-card-label">
          {{ card.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 团队总览分区：从 teamOverview 派生 KPI 卡片（成员数/总提交/总代码量/平均质量/最活跃贡献者）
import type { CodeReportData } from "../../types"
import { computed } from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 teamOverview / totalCommits） */
  report: CodeReportData
}>()

/** 总览卡片配置：团队成员/总提交数/总代码量/平均代码质量/最活跃贡献者（平均质量按色弱化，最活跃用主题色） */
const overviewCards = computed(() => [
  { value: props.report.teamOverview.memberCount, label: props.i18n.reportMemberCount, cls: "" },
  { value: props.report.totalCommits, label: props.i18n.reportTotalCommits, cls: "" },
  { value: props.report.teamOverview.totalLines, label: props.i18n.reportTotalLines, cls: "" },
  { value: props.report.teamOverview.avgQuality, label: props.i18n.reportAvgQuality, cls: "gpr-card--warn" },
  { value: props.report.teamOverview.topAuthor, label: props.i18n.reportTopAuthor, cls: "gpr-card--accent" },
])
</script>

<style lang="scss">
@use "../../styles/TeamOverviewSection.scss";
@use "../../styles/index.scss";
</style>
