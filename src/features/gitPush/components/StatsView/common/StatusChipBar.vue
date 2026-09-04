<!-- gitPush 统计视图状态 chips 条（图标 + 数值，配置驱动渲染） -->
<template>
  <div class="gp-status-bar">
    <!-- 状态 chip：图标 + 数值，hover 显示状态名（labelKey 由调用方配置） -->
    <div
      v-for="chip in chips"
      :key="chip.key"
      class="gp-status-chip"
      :class="`gp-status-chip--${chip.cls}`"
      :title="i18n[chip.labelKey]"
    >
      <Icon
        :icon="chip.icon"
        height="12"
      />
      <span>{{ chip.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 状态 chips 条：chips 配置驱动（数值由调用方 computed 预取；PendingProjects / RepoLinkAudit 共用）
import { Icon } from "@iconify/vue"

defineProps<{
  i18n: Record<string, any>
  /** chip 配置（cls 对应 gp-status-chip--* 修饰类，labelKey 为 hover 提示 i18n 键） */
  chips: { key: string, icon: string, cls: string, labelKey: string, value: number }[]
}>()
</script>

<style lang="scss">
@use "../../../styles/StatsPanel.scss";
@use "../../../styles/index.scss";
</style>
