<!-- 收藏夹区域组件 — 横向滚动展示已收藏文件夹，支持导航和移除 -->
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
@use "../styles/FavoritesSection.scss";
@use "../styles/index.scss";
</style>
