<!-- 趋势 Tab 入口容器：编排趋势图与预测组件 -->
<template>
  <div class="trend-tab">
    <TrendView
      :historical-data="historicalData"
      :i18n="i18n"
    />
    <TrendPrediction
      :on-get-trend-prediction="getTrendPrediction"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
// 趋势 Tab 入口容器：纯渲染编排
import { computed } from "vue"
import type {
  HistoricalDataItem,
  TrendPrediction as TrendPredictionData,
} from "../../types"
import TrendPrediction from "./TrendPrediction.vue"
import TrendView from "./TrendView.vue"

interface Props {
  historicalData?: HistoricalDataItem[]
  getTrendPrediction?: () => Promise<TrendPredictionData>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n || {})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
