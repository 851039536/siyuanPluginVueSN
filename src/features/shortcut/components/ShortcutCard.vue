<template>
  <Card
    variant="bordered"
    size="small"
    :class="{
      'is-favorite': isFavorite,
      'is-recent': isRecent
    }"
  >
    <div class="card-header">
      <div class="shortcut-name">
        <span class="name-text">{{ shortcut.name }}</span>
        <span v-if="shortcut.platform" class="platform-badge">{{ shortcut.platform }}</span>
        <span v-if="showToolBadge" class="tool-badge">{{ categoryLabel }}</span>
      </div>
      <div class="shortcut-actions">
        <Button
          variant="ghost"
          size="small"
          :icon="isFavorite ? 'star' : 'starOutline'"
          :class="{ active: isFavorite }"
          :title="isFavorite ? unFavoriteTitle : favoriteTitle"
          @click="$emit('toggleFavorite', shortcut.id)"
        />
        <Button
          variant="ghost"
          size="small"
          icon="contentCopy"
          :title="copyTitle"
          @click="$emit('copy', shortcut)"
        />
        <Button
          v-if="shortcut.category === 'custom'"
          variant="ghost"
          size="small"
          icon="edit"
          :title="editTitle"
          @click="$emit('edit', shortcut)"
        />
        <Button
          v-if="shortcut.category === 'custom'"
          variant="ghost"
          size="small"
          icon="delete"
          :title="deleteTitle"
          @click="$emit('delete', shortcut.id)"
        />
      </div>
    </div>
    <div class="shortcut-keys" :title="copyTitle" @click="$emit('copy', shortcut)">
      <span v-for="key in keyParts" :key="key" class="key-badge">
        {{ key }}
      </span>
    </div>
    <div class="shortcut-desc">{{ shortcut.description }}</div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/components/Card.vue'
import Button from '@/components/Button.vue'
import type { ShortcutInfo } from '../types'

interface Props {
  shortcut: ShortcutInfo
  isFavorite: boolean
  isRecent: boolean
  categoryLabel: string
  showToolBadge: boolean
  favoriteTitle?: string
  unFavoriteTitle?: string
  copyTitle?: string
  editTitle?: string
  deleteTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  favoriteTitle: '收藏',
  unFavoriteTitle: '取消收藏',
  copyTitle: '复制',
  editTitle: '编辑',
  deleteTitle: '删除'
})

defineEmits<{
  'toggleFavorite': [id: string]
  'copy': [shortcut: ShortcutInfo]
  'edit': [shortcut: ShortcutInfo]
  'delete': [id: string]
}>()

const keyParts = computed(() => {
  return props.shortcut.keys.split('+').map(k => k.trim())
})
</script>

<style scoped lang="scss">
.is-favorite {
  background: linear-gradient(135deg, var(--b3-theme-surface) 0%, var(--b3-theme-primary-lightest) 100%);
}

.is-recent {
  border-left: 3px solid var(--b3-theme-primary);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.shortcut-name {
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  line-height: 1.3;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-text {
  flex: 1;
}

.platform-badge {
  display: inline-block;
  padding: 2px 6px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-variant);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.tool-badge {
  display: inline-block;
  padding: 2px 6px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.shortcut-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shortcut-keys {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  cursor: pointer;
  transition: opacity 0.2s;
}

.shortcut-keys:hover {
  opacity: 0.8;
}

.shortcut-keys:active {
  opacity: 0.6;
}

.key-badge {
  display: inline-block;
  padding: 4px 8px;
  background: linear-gradient(135deg, var(--b3-theme-primary) 0%, var(--b3-theme-primary-light) 100%);
  color: white;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.shortcut-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 0.2s;
}
</style>
