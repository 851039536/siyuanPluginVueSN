<!-- 文件夹/文件列表组件 — 展示当前目录内容，支持导航、收藏、打开、复制路径 -->
<template>
  <div class="folder-list">
    <FolderListHeader
      :current-path="currentPath"
      :expanded-disk="expandedDisk"
      :current-display-path="currentDisplayPath"
      :loading-folders="loadingFolders"
      :cache-status="currentFolderCache"
      :item-count="folders.length"
      :i18n="i18n"
      @back="$emit('back')"
      @refresh="$emit('refresh')"
      @open="$emit('open', $event)"
      @copy-path="$emit('copyPath', $event)"
    />

    <div
      v-if="!loadingFolders"
      class="folder-items"
    >
      <FolderListItem
        v-for="item in folders"
        :key="item.path"
        :item="item"
        :is-favorite="favoriteSet.has(item.path)"
        :i18n="i18n"
        :format-date="formatDate"
        @item-dblclick="$emit('itemDblclick', $event)"
        @toggle-favorite="$emit('toggleFavorite', $event)"
        @navigate="$emit('navigate', $event)"
        @open="$emit('open', $event)"
        @copy-path="$emit('copyPath', $event)"
      />
      <div
        v-if="folders.length === 0"
        class="empty-state"
      >
        <IconWrapper
          name="folder"
          :size="40"
          color="var(--b3-theme-on-surface-light)"
        />
        <p>{{ i18n.emptyFolder || '此文件夹为空' }}</p>
      </div>
    </div>
    <div
      v-else
      class="loading-wrapper"
    >
      <Loader />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CacheStatus, DiskBrowserI18n, FolderInfo } from "../types"
import FolderListHeader from "./FolderListHeader.vue"
import FolderListItem from "./FolderListItem.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"

interface Props {
  folders: FolderInfo[]
  currentPath: string
  expandedDisk: string
  currentDisplayPath: string
  loadingFolders: boolean
  currentFolderCache: CacheStatus
  favoriteSet: Set<string>
  i18n: DiskBrowserI18n
  formatDate: (date: string) => string
}

defineProps<Props>()
defineEmits<{
  back: []
  refresh: []
  open: [path: string]
  copyPath: [path: string]
  itemDblclick: [item: FolderInfo]
  toggleFavorite: [path: string]
  navigate: [item: FolderInfo]
}>()
</script>

<style scoped lang="scss">
@use "../styles/FolderList.scss";
@use "../styles/index.scss";
</style>
