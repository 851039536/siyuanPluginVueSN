<template>
  <Card
    class="disk-card"
    :class="{ active: selectedDisk === disk.drive, expanded: expandedDisk === disk.drive }"
    variant="flat"
    size="small"
    :clickable="true"
    :active="selectedDisk === disk.drive"
    @click="$emit('click')"
  >
    <template #header>
      <div class="disk-card-header">
        <div class="disk-icon">
          <IconWrapper name="diskBrowser" :size="20" />
        </div>
        <div class="disk-info">
          <div class="disk-name">{{ disk.drive }}</div>
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
      <div class="disk-label" v-if="disk.label">{{ disk.label }}</div>
      <div class="disk-usage-bar" v-if="disk.total">
        <div class="usage-fill" :style="{ width: disk.usagePercent + '%' }"></div>
      </div>
      <div class="disk-space" v-if="disk.total">
        {{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import Card from '@/components/Card.vue'
import IconWrapper from '@/components/IconWrapper.vue'
import type { DiskInfo } from '../types'

interface Props {
  disk: DiskInfo
  selectedDisk: string
  expandedDisk: string
}

defineProps<Props>()
defineEmits<{
  click: []
}>()

function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.disk-card {
  width: calc(25% - 6px);
  min-width: 120px;
  max-width: 180px;
  flex-shrink: 0;

  &:hover {
    transform: translateY(-2px);
  }

  &:deep(.si-card__header) {
    padding: 8px 10px;
    border-bottom: none;
  }

  &:deep(.si-card__body) {
    padding: 0 10px 10px;
  }
}

.disk-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.disk-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

.disk-info {
  flex: 1;
  min-width: 0;
}

.disk-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.disk-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
  padding: 0 4px;
  height: 14px;
}

.expand-indicator {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface-light);
  transition: all 0.2s ease;
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
  transition: width 0.3s ease;
}

.disk-space {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  text-align: center;
  white-space: nowrap;
}
</style>
