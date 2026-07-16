<!-- 文件列表内容区 — 地址栏 + 列标题 + 列表项 + 加载/空状态 + 底栏 -->
<template>
  <div class="db-content">
    <AddressBar
      :current-path="currentPath"
      :expanded-disk="expandedDisk"
      :path-segments="pathSegments"
      :loading-folders="loadingFolders"
      :item-count="folders.length"
      :i18n="i18n"
      @back="$emit('back')"
      @navigate-root="$emit('navigateRoot')"
      @navigate-path="$emit('navigatePath', $event)"
      @open="$emit('open', $event)"
      @copy-path="$emit('copyPath', $event)"
      @refresh="$emit('refresh')"
    />

    <div
      v-if="folders.length > 0"
      class="db-column-headers"
    >
      <span class="db-col-name">{{ i18n.name || '名称' }}</span>
      <span class="db-col-size">{{ i18n.size || '大小' }}</span>
      <span class="db-col-date">{{ i18n.date || '修改日期' }}</span>
      <span class="db-col-actions" />
    </div>

    <div
      v-if="!loadingFolders"
      class="db-folder-items"
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
        class="db-empty"
      >
        <IconWrapper
          name="folder"
          :size="36"
          color="var(--b3-theme-on-surface-light)"
        />
        <p>{{ i18n.emptyFolder || '此文件夹为空' }}</p>
      </div>
    </div>
    <div
      v-else
      class="db-loading"
    >
      <Loader />
    </div>

    <div class="db-status-bar">
      <span class="db-status-left">
        <span
          v-if="currentFolderCache.text"
          class="db-status-cache"
          :class="{ expired: currentFolderCache.isExpired }"
          :title="currentFolderCache.tooltip"
        >{{ currentFolderCache.text }}</span>
        <span v-if="expandedDisk">{{ expandedDisk }}</span>
      </span>
      <span class="db-status-right">
        {{ folders.length }} {{ i18n.items || '项' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CacheStatus, DiskBrowserI18n, FolderInfo } from "../types"
import AddressBar from "./AddressBar.vue"
import FolderListItem from "./FolderListItem.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"

interface Props {
  folders: FolderInfo[]
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  loadingFolders: boolean
  currentFolderCache: CacheStatus
  favoriteSet: Set<string>
  i18n: DiskBrowserI18n
  formatDate: (date: string) => string
}

defineProps<Props>()
defineEmits<{
  back: []
  navigateRoot: []
  navigatePath: [index: number]
  open: [path: string]
  copyPath: [path: string]
  refresh: []
  itemDblclick: [item: FolderInfo]
  toggleFavorite: [path: string]
  navigate: [item: FolderInfo]
}>()
</script>

<style scoped lang="scss">
@use "../styles/FolderList.scss";
@use "../styles/index.scss";
</style>
