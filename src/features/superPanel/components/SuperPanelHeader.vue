<template>
  <div class="super-panel-header">
    <div class="super-panel-title">
      <IconWrapper name="superPanel" :size="20" />
      <span>{{ title }}</span>
    </div>
    <div class="header-actions">
      <ActionButton
        v-for="action in actions"
        :key="action.key"
        :icon="action.icon"
        :size="16"
        :title="action.title"
        @click="action.handler"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import ActionButton from './ActionButton.vue'
import type { IconKey } from '@/config/icons'

interface HeaderAction {
  key: string
  icon: IconKey
  title: string
  handler: () => void
}

interface Props {
  title?: string
  i18n: {
    title?: string
    enableAll?: string
    disableAll?: string
    aiSettings?: string
    refresh?: string
    close?: string
  }
}

interface Emits {
  (e: 'toggleAll', enabled: boolean): void
  (e: 'toggleAiSettings'): void
  (e: 'refresh'): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const actions = computed<HeaderAction[]>(() => [
  {
    key: 'enableAll',
    icon: 'success',
    title: props.i18n.enableAll || '全部开启',
    handler: () => emit('toggleAll', true)
  },
  {
    key: 'disableAll',
    icon: 'close',
    title: props.i18n.disableAll || '全部关闭',
    handler: () => emit('toggleAll', false)
  },
  {
    key: 'aiSettings',
    icon: 'settings',
    title: props.i18n.aiSettings || 'AI配置',
    handler: () => emit('toggleAiSettings')
  },
  {
    key: 'refresh',
    icon: 'refresh',
    title: props.i18n.refresh || '刷新',
    handler: () => emit('refresh')
  },
  {
    key: 'close',
    icon: 'close',
    title: props.i18n.close || '关闭',
    handler: () => emit('close')
  }
])
</script>

<style scoped lang="scss">
.super-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  min-height: 60px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.super-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
