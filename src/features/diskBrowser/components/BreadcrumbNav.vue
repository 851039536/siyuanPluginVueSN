<template>
  <div class="breadcrumb-nav" v-if="currentPath">
    <Button
      variant="ghost"
      size="small"
      icon="folder"
      :icon-size="14"
      class="breadcrumb-item"
      :title="i18n.backToRoot || '返回根目录'"
      @click="$emit('navigate-root')"
    >
      {{ expandedDisk }}
    </Button>
    <span v-for="(segment, index) in pathSegments" :key="index" class="breadcrumb-segment">
      <IconWrapper name="chevronRight" :size="10" />
      <Button
        variant="ghost"
        size="small"
        class="breadcrumb-item"
        :title="segment"
        @click="$emit('navigate-path', index)"
      >
        {{ segment }}
      </Button>
    </span>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import IconWrapper from '@/components/IconWrapper.vue'
import type { DiskBrowserI18n } from '../types'

interface Props {
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  'navigate-root': []
  'navigate-path': [index: number]
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.breadcrumb-nav {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  overflow-x: auto;
  white-space: nowrap;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-theme-surface-lighter);
    border-radius: 2px;
  }
}

.breadcrumb-segment {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-on-surface-light);
}

.breadcrumb-item {
  font-size: 12px;

  &:hover {
    color: var(--b3-theme-primary);
  }
}
</style>
