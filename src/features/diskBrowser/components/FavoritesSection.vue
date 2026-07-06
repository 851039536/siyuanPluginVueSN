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
        size="xsmall"
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
          size="xsmall"
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
  border-top: 1px solid $border;
  flex-shrink: 0;
}

.favorites-header {
  @include flex-align-center;
  gap: 6px;
  padding: 6px 14px;
  border-bottom: 1px dashed $border;

  span {
    @include meta-label;
    flex: 1;
    color: var(--b3-theme-on-surface);
  }
}

.favorites-list-horizontal {
  @include flex-align-center;
  gap: 6px;
  padding: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  @include scrollbar(4px, 4px);
}

.favorite-card {
  @include flex-align-center;
  gap: 6px;
  min-width: 110px;
  max-width: 170px;
  padding: 5px 10px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  flex-shrink: 0;
  @include border-card;

  &:hover {
    .favorite-remove-btn {
      opacity: 1;
    }
  }
}

.favorite-icon {
  @include icon-container(22px);
}

.favorite-name {
  flex: 1;
  min-width: 0;
  font-family: $mono;
  font-size: 11px;
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
