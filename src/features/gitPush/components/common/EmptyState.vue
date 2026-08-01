<!-- gitPush 通用空状态占位组件（icon + 文案，消除跨 6 文件重复） -->
<template>
  <div class="gp-empty">
    <div class="gp-empty-icon">
      <Icon
        :icon="icon"
        :width="iconSize"
        :height="iconSize"
        :class="{ 'gp-spin': spin }"
      />
    </div>
    <!-- 空状态文案（i18n 键值） -->
    <div class="gp-empty-text">
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"

withDefaults(defineProps<{
  /** Iconify 图标名（如 "mdi:chart-timeline-variant"） */
  icon: string
  /** 空状态文案 */
  text: string
  /** 图标是否持续旋转（加载态） */
  spin?: boolean
  /** 图标尺寸（默认 48） */
  iconSize?: string
}>(), {
  iconSize: "48",
})
</script>
