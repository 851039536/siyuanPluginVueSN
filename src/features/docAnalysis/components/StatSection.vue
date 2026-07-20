<!-- 统计分区子组件 - 可折叠分区标题 + 卡片/图表内容 -->
<template>
  <div class="stat-section">
    <div
      class="section-header"
      @click="$emit('toggle', sectionKey)"
    >
      <Icon
        :icon="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'"
        class="section-toggle-icon"
      />
      <Icon :icon="icon" />{{ title }}
      <span
        v-if="isCollapsed && summary"
        class="section-hint"
      >{{ summary }}</span>
      <span class="section-header-spacer" />
      <slot name="headerExtra" />
    </div>
    <div v-show="!isCollapsed">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"

interface Props {
  sectionKey: string
  title: string
  icon: string
  isCollapsed: boolean
  summary?: string
}

defineProps<Props>()

defineEmits<{
  (e: "toggle", key: string): void
}>()
</script>

<style lang="scss" scoped>
@use "../styles/StatSection.scss";
</style>
