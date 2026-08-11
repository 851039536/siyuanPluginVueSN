<template>
  <section class="panel-section">
    <!-- 每周复盘（统计卡片 + 双图表 + 卡点汇总） -->
    <WeeklyReview
      :week-total="weekTotal"
      :priority-distribution="priorityDistribution"
      :project-effort="projectEffort"
      :block-summary="blockSummary"
      :i18n="i18n"
    />
  </section>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 每周复盘 Tab
 * 纯展示壳：透传 useWeeklyReview 派生的统计/图表/卡点数据给 WeeklyReview 子组件
 */
import WeeklyReview from "./WeeklyReview.vue"
import { useWeeklyReview } from "../../composables/useWeeklyReview"

type ReviewApi = ReturnType<typeof useWeeklyReview>

const props = defineProps<{
  i18n: Record<string, string>
  review: ReviewApi
}>()

/** 本周完成事项总数 */
const weekTotal = props.review.weekTotal
/** 优先级分布（环形图数据） */
const priorityDistribution = props.review.priorityDistribution
/** 项目精力分布（条形图数据） */
const projectEffort = props.review.projectEffort
/** 卡点汇总清单 */
const blockSummary = props.review.blockSummary
</script>

<style scoped lang="scss">
@use "../../styles/index.scss";
</style>
