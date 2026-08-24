<!-- 热力图 Tab 入口容器：内部加载笔记本列表并编排热力图卡片 -->
<template>
  <div class="heatmap-tab">
    <HeatmapCard
      :on-get-activity-data="queries?.getHeatmapActivityData"
      :on-get-daily-detail="queries?.getHeatmapDailyDetail"
      :notebooks="heatmapNotebooks"
      :writing-streak="stats?.writingStreak ?? 0"
      :active-days="stats?.activeDays ?? 0"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
// 热力图 Tab 入口容器：挂载时加载笔记本筛选列表
import {
  computed,
  onMounted,
  ref,
} from "vue"
import type {
  ChangedDoc,
  HeatmapMetric,
  StatisticsData,
} from "../../types"
import { getHeatmapNotebooks } from "../../queries/heatmapStats"
import HeatmapCard from "./HeatmapCard.vue"

interface HeatmapQueries {
  getHeatmapActivityData: (
    months: number,
    metric: HeatmapMetric,
    notebookId?: string,
  ) => Promise<Map<string, number>>
  getHeatmapDailyDetail: (dateStr: string) => Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }>
}

interface Props {
  stats?: StatisticsData | null
  queries?: HeatmapQueries
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  stats: null,
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n || {})

const heatmapNotebooks = ref<Array<{ id: string, name: string }>>([])

onMounted(async () => {
  heatmapNotebooks.value = await getHeatmapNotebooks()
})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
