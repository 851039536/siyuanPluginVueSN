<!-- 文件夹/文件列表项 — 单行展示，支持收藏、导航、打开、复制路径 -->
<template>
  <div
    class="folder-item"
    :class="{ 'is-file': item.isFile }"
    @dblclick="$emit('itemDblclick', item)"
  >
    <div class="folder-icon">
      <IconWrapper
        :name="item.isFile ? 'file' : 'folder'"
        :size="18"
      />
    </div>
    <div class="folder-info">
      <div
        class="folder-name"
        :title="item.name"
      >
        {{ item.name }}
      </div>
      <div
        v-if="item.size !== undefined || item.modifiedTime"
        class="folder-meta"
      >
        <span
          v-if="item.isFile && item.size !== undefined"
          class="file-size"
        >{{ formatSize(item.size) }}</span>
        <span
          v-if="item.modifiedTime"
          class="modified-time"
        >{{ formatDate(item.modifiedTime) }}</span>
      </div>
    </div>
    <div class="folder-actions">
      <Button
        v-if="!item.isFile"
        variant="ghost"
        size="xsmall"
        :icon="isFavorite ? 'star' : 'starOutline'"
        :icon-size="13"
        class="folder-action-btn favorite-btn"
        :class="{ 'is-favorite': isFavorite }"
        :title="isFavorite ? (i18n.removeFavorite || '取消收藏') : (i18n.addFavorite || '添加收藏')"
        @click.stop="$emit('toggleFavorite', item.path)"
      />
      <Button
        v-if="!item.isFile"
        variant="ghost"
        size="xsmall"
        icon="chevronRight"
        :icon-size="13"
        class="folder-action-btn"
        :title="i18n.browse || '浏览'"
        @click.stop="$emit('navigate', item)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="openInNew"
        :icon-size="13"
        class="folder-action-btn"
        :title="i18n.open || '打开'"
        @click.stop="$emit('open', item.path)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="contentCopy"
        :icon-size="13"
        class="folder-action-btn"
        :title="i18n.copyPath || '复制路径'"
        @click.stop="$emit('copyPath', item.path)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n, FolderInfo } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatSize } from "../utils"

interface Props {
  item: FolderInfo
  isFavorite: boolean
  i18n: DiskBrowserI18n
  formatDate: (date: string) => string
}

defineProps<Props>()
defineEmits<{
  itemDblclick: [item: FolderInfo]
  toggleFavorite: [path: string]
  navigate: [item: FolderInfo]
  open: [path: string]
  copyPath: [path: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/FolderListItem.scss";
@use "../styles/index.scss";
</style>
