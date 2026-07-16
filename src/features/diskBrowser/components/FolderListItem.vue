<!-- 文件夹/文件列表项 — 三列布局（名称 / 大小 / 日期），hover 显示操作 -->
<template>
  <div
    class="db-item-row"
    :class="{ 'is-file': item.isFile }"
    @dblclick="$emit('itemDblclick', item)"
  >
    <div class="db-item-name">
      <IconWrapper
        :name="item.isFile ? 'file' : 'folder'"
        :size="16"
        class="db-item-icon"
      />
      <span class="db-item-label" :title="item.name">{{ item.name }}</span>
    </div>
    <span class="db-item-size">{{
      item.isFile && item.size ? formatSize(item.size) : '\u2014'
    }}</span>
    <span class="db-item-date">{{
      item.modifiedTime ? formatDate(item.modifiedTime) : ''
    }}</span>
    <div class="db-item-actions">
      <Button
        v-if="!item.isFile"
        variant="ghost"
        size="xsmall"
        :icon="isFavorite ? 'star' : 'starOutline'"
        :icon-size="12"
        class="db-action-btn"
        :class="{ 'is-favorite': isFavorite }"
        :title="isFavorite ? (i18n.removeFavorite || '取消收藏') : (i18n.addFavorite || '添加收藏')"
        @click.stop="$emit('toggleFavorite', item.path)"
      />
      <Button
        v-if="!item.isFile"
        variant="ghost"
        size="xsmall"
        icon="chevronRight"
        :icon-size="12"
        class="db-action-btn"
        :title="i18n.browse || '浏览'"
        @click.stop="$emit('navigate', item)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="openInNew"
        :icon-size="12"
        class="db-action-btn"
        :title="i18n.open || '打开'"
        @click.stop="$emit('open', item.path)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="contentCopy"
        :icon-size="12"
        class="db-action-btn"
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
