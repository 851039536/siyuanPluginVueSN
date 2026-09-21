<!-- 文件夹/文件列表项 — 三列布局（名称 / 大小 / 日期），hover 或聚焦时显示操作 -->
<template>
  <div
    class="db-item-row"
    :class="{ 'is-file': item.isFile }"
    role="button"
    tabindex="0"
    @dblclick="$emit('itemDblclick', item)"
    @keydown.enter.prevent="onEnter"
    @keydown.space.prevent="onEnter"
  >
    <div class="db-item-name">
      <IconWrapper
        :name="item.isFile ? 'file' : 'folder'"
        :size="16"
        class="db-item-icon"
      />
      <span
        class="db-item-label"
        :title="item.name"
      >{{ item.name }}</span>
    </div>
    <span class="db-item-size">{{
      item.isFile && item.size ? formatFileSize(item.size) : '\u2014'
    }}</span>
    <span class="db-item-date">{{
      item.modifiedTime ? formatDate(item.modifiedTime) : '\u2014'
    }}</span>
    <div class="db-item-actions">
      <Button
        v-if="!item.isFile"
        variant="ghost"
        size="xsmall"
        dense
        :icon="isFavorite ? 'star' : 'starOutline'"
        class="db-action-btn"
        :class="{ 'is-favorite': isFavorite }"
        :title="isFavorite ? i18n.removeFavorite : i18n.addFavorite"
        @click.stop="$emit('toggleFavorite', item.path)"
      />
      <Button
        v-if="!item.isFile"
        variant="ghost"
        size="xsmall"
        dense
        icon="chevronRight"
        class="db-action-btn"
        :title="i18n.browse"
        @click.stop="$emit('navigate', item)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="openInNew"
        class="db-action-btn"
        :title="i18n.open"
        @click.stop="$emit('open', item.path)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="contentCopy"
        class="db-action-btn"
        :title="i18n.copyPath"
        @click.stop="$emit('copyPath', item.path)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  DiskBrowserI18n,
  FolderInfo,
} from "../types"
import { formatFileSize } from "@/utils/format"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  item: FolderInfo
  isFavorite: boolean
  i18n: DiskBrowserI18n
  formatDate: (date: string) => string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  itemDblclick: [item: FolderInfo]
  toggleFavorite: [path: string]
  navigate: [item: FolderInfo]
  open: [path: string]
  copyPath: [path: string]
}>()

/** 键盘主操作：与双击一致（文件=打开，文件夹=进入） */
function onEnter(): void {
  emit("itemDblclick", props.item)
}
</script>

<style scoped lang="scss">
@use "../styles/FolderListItem.scss";
</style>
