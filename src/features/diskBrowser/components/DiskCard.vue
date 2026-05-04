<template>
  <Card
    class="disk-card"
    :class="{
      active: selectedDisk === disk.drive,
      expanded: expandedDisk === disk.drive,
    }"
    variant="flat"
    size="small"
    :clickable="true"
    :active="selectedDisk === disk.drive"
    @click="$emit('click')"
  >
    <template #header>
      <div class="disk-card-header">
        <div class="disk-icon">
          <IconWrapper
            name="diskBrowser"
            :size="20"
          />
        </div>
        <div class="disk-info">
          <div class="disk-name">
            {{ disk.drive }}
          </div>
        </div>
        <div class="expand-indicator">
          <IconWrapper
            :name="expandedDisk === disk.drive ? 'chevronUp' : 'chevronDown'"
            :size="14"
          />
        </div>
      </div>
    </template>
    <div class="disk-card-body">
      <div
        v-if="disk.label"
        class="disk-label"
      >
        {{ disk.label }}
      </div>
      <div
        v-if="disk.total"
        class="disk-usage-bar"
      >
        <div
          class="usage-fill"
          :style="{ width: `${disk.usagePercent}%` }"
        ></div>
      </div>
      <div
        v-if="disk.total"
        class="disk-space"
      >
        {{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import type { DiskInfo } from "../types"
import Card from "@/components/Card.vue"
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
  @include card-hover-effect;
  @include gpu-accelerate;

  &:deep(.si-card__header) {
    padding: 8px 10px;
    border-bottom: none;
  }

  &:deep(.si-card__body) {
    padding: 0 10px 10px;
  }
}

.disk-card-header {
  @include flex-align-center;
  gap: 8px;
}

.disk-icon {
  @include icon-container(32px);
  border-radius: 6px;
}

.disk-info {
  flex: 1;
  min-width: 0;
}

.disk-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  @include text-ellipsis;
}

.disk-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  @include text-ellipsis;
  margin-bottom: 6px;
  padding: 0 4px;
  height: 14px;
}

.expand-indicator {
  flex-shrink: 0;
  @include flex-center;
  color: var(--b3-theme-on-surface-light);
}

.disk-card-body {
  display: flex;
  flex-direction: column;
}

.disk-usage-bar {
  width: 100%;
  height: 4px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}

.usage-fill {
  height: 100%;
  background: var(--b3-theme-primary);
}

.disk-space {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  text-align: center;
  white-space: nowrap;
}
</style>
