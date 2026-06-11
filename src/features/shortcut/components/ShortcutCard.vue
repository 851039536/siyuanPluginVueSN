<template>
  <div
    class="shortcut-card"
    :class="{
      'is-favorite': isFavorite,
      'is-recent': isRecent,
    }"
  >
    <div class="card-header">
      <div class="shortcut-name">
        <span class="name-text">{{ shortcut.name }}</span>
        <span
          v-if="shortcut.platform"
          class="platform-badge"
        >{{ shortcut.platform }}</span>
        <span
          v-if="showToolBadge"
          class="tool-badge"
        >{{ categoryLabel }}</span>
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
    <div
      class="shortcut-keys"
      :title="copyTitle"
      @click="$emit('copy', shortcut)"
    >
      <span
        v-for="(key, idx) in keyParts"
        :key="`key-${idx}`"
        class="key-badge"
      >
        {{ key }}
      </span>
    </div>
    <div class="shortcut-desc">
      {{ shortcut.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ShortcutInfo } from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"

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
  favoriteTitle: "收藏",
  unFavoriteTitle: "取消收藏",
  copyTitle: "复制",
  editTitle: "编辑",
  deleteTitle: "删除",
})

defineEmits<{
  toggleFavorite: [id: string]
  copy: [shortcut: ShortcutInfo]
  edit: [shortcut: ShortcutInfo]
  delete: [id: string]
}>()

const keyParts = computed(() => {
  return props.shortcut.keys.split(", ").flatMap(seq =>
    seq.split("+").map((k) => k.trim()),
  )
})

const pathText = computed(() => {
  const parts = [props.categoryLabel]
  if (props.shortcut.group) {
    parts.push(props.shortcut.group)
  }
  return parts.join(" / ")
})
</script>

<style scoped lang="scss">
.shortcut-card {
  padding: 10px 12px;
  border-bottom: 1px dashed var(--b3-theme-surface-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.is-favorite {
  background: linear-gradient(135deg, transparent 0%, var(--b3-theme-primary-lightest) 100%);
}

.is-recent {
  border-left: 3px solid var(--b3-theme-primary);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
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
  min-width: 0;
}

.name-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-badge {
  display: inline-block;
  padding: 1px 5px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface-variant);
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.tool-badge {
  display: inline-block;
  padding: 1px 5px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.shortcut-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}

.shortcut-keys {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  cursor: pointer;
}

.shortcut-keys:hover {
  opacity: 0.8;
}

.shortcut-keys:active {
  opacity: 0.6;
}

// Codex-style key-badge: monospace, border, subtle background
.key-badge {
  display: inline-block;
  padding: 2px 7px;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  background: var(--b3-theme-primary-lightest);
  border: 1px solid var(--b3-theme-primary-light);
  border-radius: 4px;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.shortcut-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>