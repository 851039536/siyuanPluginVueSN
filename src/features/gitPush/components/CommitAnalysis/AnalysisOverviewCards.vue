<!-- gitPush 提交分析总览卡片区（总提交次数 / 已分析项目 + 失败提示） -->
<template>
  <div>
    <!-- 总览卡片 -->
    <div class="gpa-cards">
      <div class="gpa-card">
        <div class="gpa-card-value">{{ stats.totalCommits }}</div>
        <!-- 卡片标签："总提交次数" -->
        <div class="gpa-card-label">{{ i18n.analysisTotalCommits }}</div>
      </div>
      <div class="gpa-card">
        <div class="gpa-card-value">{{ stats.analyzedCount }} / {{ stats.projectCount }}</div>
        <!-- 卡片标签："已分析项目" -->
        <div class="gpa-card-label">{{ i18n.analysisCoveredProjects }}</div>
      </div>
    </div>

    <!-- 失败提示 -->
    <div
      v-if="stats.failedCount > 0"
      class="gpa-fail-hint"
    >
      {{ i18n.analysisFailedCount.replace("{0}", String(stats.failedCount)) }}
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析总览卡片区（总提交次数 / 已分析项目 + 失败提示）
import type { CommitAnalysisStats } from "../../types"

defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 totalCommits/analyzedCount/projectCount/failedCount） */
  stats: CommitAnalysisStats
}>()
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
