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
  return props.shortcut.keys.split(", ").flatMap((seq) =>
    seq.split("+").map((k) => k.trim()),
  )
})
</script>

<style lang="scss" scoped>
@use "../styles/ShortcutCard.scss";
</style>
