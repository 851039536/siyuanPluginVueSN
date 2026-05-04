<template>
  <div
    v-if="favoriteFolders.length > 0"
    class="favorites-section"
  >
    <div class="favorites-header">
      <IconWrapper
        name="star"
        :size="14"
        color="#f97316"
      />
      <span>{{ i18n.favorites || '收藏夹' }}</span>
      <Badge
        :content="favoriteFolders.length"
        variant="primary"
        size="small"
      />
    </div>
    <div class="favorites-list-horizontal">
      <div
        v-for="path in favoriteFolders"
        :key="path"
        class="favorite-card"
        :title="path"
        @click="$emit('navigate', path)"
      >
        <div class="favorite-icon">
          <IconWrapper
            name="folder"
            :size="16"
          />
        </div>
        <div class="favorite-name">
          {{ getFolderName(path) }}
        </div>
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
import type { DiskBrowserI18n } from "../types"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { getFolderName } from "../utils"

interface Props {
  favoriteFolders: string[]
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  navigate: [path: string]
  remove: [path: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.favorites-section {
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
}

.favorites-header {
  @include flex-align-center;
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
  @include flex-align-center;
  gap: 6px;
  padding: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  @include scrollbar(6px, 6px);
}

.favorite-card {
  @include flex-align-center;
  gap: 6px;
  min-width: 120px;
  max-width: 180px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  cursor: pointer;
  flex-shrink: 0;
  @include card-hover-effect(-1px);
  @include gpu-accelerate;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

    .favorite-remove-btn {
      opacity: 1;
    }
  }
}

.favorite-icon {
  @include icon-container(24px);
}

.favorite-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  @include text-ellipsis;
}

.favorite-remove-btn {
  opacity: 0;
  flex-shrink: 0;

  &:hover {
    color: var(--b3-theme-error) !important;
  }
}
</style>
