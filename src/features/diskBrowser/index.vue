<!-- 磁盘浏览器 Dock 面板根组件 — 磁盘卡片、面包屑导航、文件夹列表容器 -->
<template>
  <div class="disk-browser-panel">
    <PanelHeader
      :i18n="i18n"
      :cache-status="cacheStatus"
      :loading="loading"
      @refresh="refreshDisks"
    />

    <div class="disk-list-horizontal">
      <DiskCard
        v-for="disk in disks"
        :key="disk.drive"
        :disk="disk"
        :selected-disk="selectedDisk"
        :expanded-disk="expandedDisk"
        @click="toggleDisk(disk)"
      />
    </div>

    <FavoritesSection
      v-if="favoriteFolders.length > 0"
      :favorite-folders="favoriteFolders"
      :i18n="i18n"
      @navigate="navigateToFavorite"
      @remove="toggleFavorite"
    />

    <template v-if="expandedDisk">
      <BreadcrumbNav
        :current-path="currentPath"
        :expanded-disk="expandedDisk"
        :path-segments="pathSegments"
        :i18n="i18n"
        @navigate-root="navigateToRoot"
        @navigate-path="navigateToPath"
      />

      <FolderList
        :folders="folders"
        :current-path="currentPath"
        :expanded-disk="expandedDisk"
        :current-display-path="currentDisplayPath"
        :loading-folders="loadingFolders"
        :current-folder-cache="currentFolderCache"
        :favorite-set="favoriteSet"
        :i18n="i18n"
        :format-date="formatDate"
        @back="navigateBack"
        @refresh="refreshCurrentFolder"
        @open="openPath"
        @copy-path="copyPathToClipboard"
        @item-dblclick="handleItemDoubleClick"
        @toggle-favorite="toggleFavorite"
        @navigate="navigateIntoFolder"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  DiskBrowserI18n,
} from "./types"
import type { DiskBrowserStorage } from "./types/storage"
import BreadcrumbNav from "./components/BreadcrumbNav.vue"
import DiskCard from "./components/DiskCard.vue"
import FavoritesSection from "./components/FavoritesSection.vue"
import FolderList from "./components/FolderList.vue"
import PanelHeader from "./components/PanelHeader.vue"
import { useDiskBrowser } from "./composables/useDiskBrowser"

interface Props {
  i18n: DiskBrowserI18n
  plugin: Plugin
  storage: DiskBrowserStorage
}

const props = defineProps<Props>()

const {
  disks,
  selectedDisk,
  expandedDisk,
  folders,
  loading,
  loadingFolders,
  currentPath,
  favoriteFolders,
  favoriteSet,
  pathSegments,
  currentDisplayPath,
  cacheStatus,
  currentFolderCache,
  toggleFavorite,
  toggleDisk,
  openPath,
  refreshDisks,
  refreshCurrentFolder,
  handleItemDoubleClick,
  navigateIntoFolder,
  navigateBack,
  navigateToRoot,
  navigateToPath,
  navigateToFavorite,
  copyPathToClipboard,
  formatDate,
} = useDiskBrowser(props.i18n, props.storage)
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
