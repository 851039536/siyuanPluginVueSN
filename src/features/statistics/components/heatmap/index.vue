<!-- 热力图 Tab 入口容器：内部加载笔记本列表并编排热力图卡片 -->
<template>
  <div class="heatmap-tab">
    <HeatmapCard
      ref="cardRef"
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
// 热力图 Tab 入口容器：挂载时加载笔记本筛选列表，并订阅顶层总刷新自更新
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue"
import type {
  getHeatmapActivityData,
  getHeatmapDailyDetail,
} from "../../queries/heatmapStats"
import type { StatisticsData } from "../../types"
import { onStatisticsRefresh } from "../../composables/useStatisticsRefresh"
import { getHeatmapNotebooks } from "../../queries/heatmapStats"
import HeatmapCard from "./HeatmapCard.vue"

// 查询函数聚合：直接从 queries 模块投影类型，避免手写镜像签名
interface HeatmapQueries {
  getHeatmapActivityData: typeof getHeatmapActivityData
  getHeatmapDailyDetail: typeof getHeatmapDailyDetail
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
// 卡片暴露的 reload：让容器驱动的刷新能重查日历网格数据
const cardRef = ref<InstanceType<typeof HeatmapCard> | null>(null)

async function loadNotebooks(): Promise<void> {
  heatmapNotebooks.value = await getHeatmapNotebooks()
}

// 订阅顶层总刷新：重载笔记本筛选列表 + 让卡片重查日历数据。
// 摘要卡（writingStreak/activeDays）来自 stats prop，由顶层刷新后自动跟随。
let stopRefresh: (() => void) | null = null

onMounted(async () => {
  await loadNotebooks()
  stopRefresh = onStatisticsRefresh(async () => {
    await loadNotebooks()
    cardRef.value?.reload()
  })
})

onBeforeUnmount(() => {
  stopRefresh?.()
  stopRefresh = null
})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
