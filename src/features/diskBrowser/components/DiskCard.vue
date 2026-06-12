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
      <div class="disk-icon">
        <IconWrapper
          name="diskBrowser"
          :size="18"
        />
      </div>
      <div class="disk-info">
        <span class="disk-name">{{ disk.drive }}</span>
        <span
          v-if="disk.label"
          class="disk-label"
        >{{ disk.label }}</span>
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
@use "../styles/index.scss" as *;

.disk-card {
  width: calc(25% - 6px);
  min-width: 120px;
  max-width: 180px;
  flex-shrink: 0;
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  @include border-card;

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.disk-card-header {
  @include flex-align-center;
  gap: 8px;
}

.disk-icon {
  @include icon-container(28px);
  border-radius: $radius;
}

.disk-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.disk-name {
  font-family: $mono;
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-on-background);
}

.disk-label {
  @include meta-label;
  color: var(--b3-theme-on-surface);
  @include text-ellipsis;
}

.expand-indicator {
  flex-shrink: 0;
  @include flex-center;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.5;
}

.disk-card-body {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed $border;
}

.disk-usage-bar {
  width: 100%;
  height: 3px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}

.usage-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.disk-space {
  font-family: $mono;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  text-align: center;
  white-space: nowrap;
}
</style>
