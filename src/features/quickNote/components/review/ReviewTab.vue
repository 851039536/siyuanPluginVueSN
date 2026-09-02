<template>
  <section class="panel-section">
    <!-- 每周复盘（周切换头 + 统计卡片行 + 双图表 + 卡点汇总） -->
    <WeeklyReview
      :review="review"
      :i18n="i18n"
    />
  </section>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 每周复盘 Tab
 * 纯展示壳：透传 useWeeklyReview 周切换派生数据给 WeeklyReview 子组件
 */
import WeeklyReview from "./WeeklyReview.vue"
import { useWeeklyReview } from "../../composables/useWeeklyReview"

type ReviewApi = ReturnType<typeof useWeeklyReview>

const props = defineProps<{
  i18n: Record<string, string>
  review: ReviewApi
}>()

const review = props.review
</script>

<style scoped lang="scss">
@use "../../styles/index.scss";
</style>
