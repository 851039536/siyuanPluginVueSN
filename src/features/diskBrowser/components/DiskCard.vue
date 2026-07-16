<!-- 磁盘卡片组件 — 显示盘符、标签、空间使用率进度条 -->
<template>
  <div
    class="disk-card"
    :class="{
      active: selectedDisk === disk.drive,
      expanded: expandedDisk === disk.drive,
    }"
    @click="$emit('click')"
  >
    <div class="disk-card-header">
      <div class="disk-info">
        <span class="disk-name">{{ disk.drive }}</span>
        <span class="disk-label">{{ disk.label || '\u00A0' }}</span>
      </div>
      <div class="expand-indicator">
        <IconWrapper
          :name="expandedDisk === disk.drive ? 'chevronUp' : 'chevronDown'"
          :size="12"
        />
      </div>
    </div>
    <div
      v-if="disk.total"
      class="disk-card-body"
    >
      <div class="disk-usage-bar">
        <div
          class="usage-fill"
          :style="{ width: `${disk.usagePercent}%` }"
        />
      </div>
      <div class="disk-space">
        {{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiskInfo } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatSize } from "../utils"

interface Props {
  disk: DiskInfo
  selectedDisk: string
  expandedDisk: string
}

defineProps<Props>()
defineEmits<{
  click: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/DiskCard.scss";
@use "../styles/index.scss";
</style>
