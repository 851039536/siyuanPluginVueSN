<!-- 报告 Tab 入口容器：编排报告视图 -->
<template>
  <div class="report-tab">
    <ReportView
      :on-get-report-data="getReportData"
      :on-get-comparison-data="getComparisonData"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
// 报告 Tab 入口容器：纯渲染编排
import { computed } from "vue"
import type {
  ComparisonData,
  ReportData,
} from "../../types"
import ReportView from "./ReportView.vue"

interface Props {
  getReportData?: (year?: number, month?: number) => Promise<ReportData>
  getComparisonData?: (
    yearA: number,
    monthA: number | undefined,
    yearB: number,
    monthB: number | undefined,
  ) => Promise<ComparisonData>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n || {})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
