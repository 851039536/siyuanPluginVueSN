<!-- gitPush 统计视图状态 chips 条（图标 + 数值，配置驱动渲染） -->
<template>
  <div class="gps-status-bar">
    <!-- 状态 chip：图标 + 数值（label 由调用方给出，hover 显示状态名） -->
    <div
      v-for="chip in chips"
      :key="chip.key"
      class="gps-status-chip"
      :class="`gps-status-chip--${chip.cls}`"
      :title="chip.label"
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
// 状态 chips 条：chips 配置驱动（label 由调用方按 i18n 预渲染，数值亦由调用方 computed 预取）
import { Icon } from "@iconify/vue"

defineProps<{
  /** chip 配置（cls 对应 gps-status-chip--* 修饰类，label 为已渲染的 hover 提示文案） */
  chips: { key: string, icon: string, cls: string, label: string, value: number }[]
}>()
</script>

<style lang="scss">
@use "../../../styles/StatsPanel.scss";
@use "../../../styles/index.scss";
</style>
