<!-- 里程碑 Tab 入口容器：编排里程碑卡片（stats 对象整传，由卡片内部按字段取值） -->
<template>
  <div class="milestones-tab">
    <MilestonesCard
      :plugin="plugin"
      :stats="stats"
      :i18n="props.i18n"
    />
  </div>
</template>

<script setup lang="ts">
// 里程碑 Tab 入口容器：纯渲染编排
import type { Plugin } from "siyuan"
import type { StatisticsData } from "../../types"
import MilestonesCard from "./MilestonesCard.vue"

interface Props {
  plugin?: Plugin
  stats?: StatisticsData | null
  i18n?: Record<string, any>
}

// withDefaults 保证 i18n 默认 {}，模板经 props 直接访问
const props = withDefaults(defineProps<Props>(), {
  plugin: undefined,
  stats: null,
  i18n: () => ({}),
})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
