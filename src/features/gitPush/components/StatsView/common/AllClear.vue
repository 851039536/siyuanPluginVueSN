<!-- gitPush 统计视图"全部正常"空态（勾选图标 + 文案） -->
<template>
  <div class="gp-status-all-clear">
    <Icon
      icon="mdi:check-all"
      height="12"
    />
    <!-- 空态文案（父组件传入 i18n 文本） -->
    <span>{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
// "全部正常"空态（图标 + 文案，PendingProjects / RepoLinkAudit 共用）
import { Icon } from "@iconify/vue"

defineProps<{
  /** 空态文案（已渲染的 i18n 文本） */
  text: string
}>()
</script>

<style lang="scss">
@use "../../../styles/StatsPanel.scss";
@use "../../../styles/index.scss";
</style>
