<!-- 写作活跃度 Tab 入口容器：编排笔记本活跃度趋势 -->
<template>
  <div class="activity-tab">
    <NotebookActivityTrend
      :on-get-notebook-activity-trend="getNotebookActivityTrend"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
// 活跃度 Tab 入口容器：纯渲染编排
import { computed } from "vue"
import type { NotebookActivityItem } from "../../types"
import NotebookActivityTrend from "./NotebookActivityTrend.vue"

interface Props {
  getNotebookActivityTrend?: (days: number) => Promise<NotebookActivityItem[]>
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
