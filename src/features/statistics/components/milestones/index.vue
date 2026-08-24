<!-- 里程碑 Tab 入口容器：编排里程碑卡片 -->
<template>
  <div class="milestones-tab">
    <MilestonesCard
      :plugin="plugin"
      :total-notes="stats?.totalNotes ?? 0"
      :total-words="stats?.totalWords ?? 0"
      :total-blocks="stats?.totalBlocks ?? 0"
      :total-tags="stats?.totalTags ?? 0"
      :total-backlinks="stats?.totalBacklinks ?? 0"
      :total-assets="stats?.totalAssets ?? 0"
      :total-images="stats?.totalImages ?? 0"
      :notebook-count="stats?.notebookCount ?? 0"
      :code-blocks="stats?.codeBlocks ?? 0"
      :writing-streak="stats?.writingStreak ?? 0"
      :active-days="stats?.activeDays ?? 0"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
// 里程碑 Tab 入口容器：纯渲染编排
import type { Plugin } from "siyuan"
import {
  computed,
} from "vue"
import type { StatisticsData } from "../../types"
import MilestonesCard from "./MilestonesCard.vue"

interface Props {
  plugin?: Plugin
  stats?: StatisticsData | null
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  plugin: undefined,
  stats: null,
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n || {})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
