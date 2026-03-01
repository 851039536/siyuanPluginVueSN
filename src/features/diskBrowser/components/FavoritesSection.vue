<template>
  <div class="favorites-section" v-if="favoriteFolders.length > 0">
    <div class="favorites-header">
      <IconWrapper name="star" :size="14" color="#f97316" />
      <span>{{ i18n.favorites || '收藏夹' }}</span>
      <Badge :content="favoriteFolders.length" variant="primary" size="small" />
    </div>
    <div class="favorites-list-horizontal">
      <div
        v-for="path in favoriteFolders"
        :key="path"
        class="favorite-card"
        @click="$emit('navigate', path)"
        :title="path"
      >
        <div class="favorite-icon">
          <IconWrapper name="folder" :size="16" />
        </div>
        <div class="favorite-name">{{ getFolderName(path) }}</div>
        <Button
          variant="ghost"
          size="small"
          icon="close"
          :icon-size="12"
          class="favorite-remove-btn"
          :title="i18n.removeFavorite || '取消收藏'"
          @click.stop="$emit('remove', path)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import IconWrapper from '@/components/IconWrapper.vue'
import Badge from '@/components/Badge.vue'
import type { DiskBrowserI18n } from '../types'

interface Props {
  favoriteFolders: string[]
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  navigate: [path: string]
  remove: [path: string]
}>()

function getFolderName(path: string): string {
  const parts = path.split('\\')
  return parts[parts.length - 1] || path
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.favorites-section {
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.favorites-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  font-weight: 600;

  span {
    flex: 1;
  }
}

.favorites-list-horizontal {
  display: flex;
  gap: 6px;
  padding: 8px;
  overflow-x: auto;
  overflow-y: hidden;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-theme-surface-lighter);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.favorite-card {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
  max-width: 180px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--b3-theme-primary);
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

    .favorite-remove-btn {
      opacity: 1;
    }
  }
}

.favorite-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.favorite-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-remove-btn {
  opacity: 0;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    color: var(--b3-theme-error) !important;
  }
}
</style>
