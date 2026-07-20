<!-- 统计分区子组件 - 纯展示面板（标题 + 卡片/图表内容） -->
<template>
  <div class="stat-section">
    <div class="section-header">
      <Icon :icon="icon" />{{ title }}
      <span class="section-header-spacer" />
      <slot name="headerExtra" />
    </div>
    <div class="section-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"

interface Props {
  title: string
  icon: string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
@use "../styles/StatSection.scss";
</style>
