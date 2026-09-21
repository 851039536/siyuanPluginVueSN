<!-- 磁盘浏览器 Dock 面板根组件 — 单一双栏布局（导航栏 + 内容区） -->
<template>
  <div class="disk-browser-panel">
    <div class="db-layout">
      <NavPane
        :disks="disks"
        :desktop-path="desktopPath"
        :expanded-disk="expandedDisk"
        :favorite-folders="favoriteFolders"
        :loading="loading"
        :total-capacity="totalCapacity"
        :total-used="totalUsed"
        :i18n="i18n"
        @select-disk="toggleDisk"
        @select-desktop="toggleDesktop"
        @navigate-favorite="navigateToFavorite"
        @remove-favorite="toggleFavorite"
        @refresh-disks="refreshDisks"
      />

      <FolderList
        v-if="expandedDisk"
        :folders="folders"
        :current-path="currentPath"
        :expanded-disk="expandedDisk"
        :root-label="rootLabel"
        :is-desktop-root="isDesktopRoot"
        :path-segments="pathSegments"
        :loading-folders="loadingFolders"
        :load-error="loadError"
        :favorite-set="favoriteSet"
        :i18n="i18n"
        :format-date="formatDate"
        @back="navigateBack"
        @navigate-root="navigateToRoot"
        @navigate-path="navigateToPath"
        @open="openPath"
        @copy-path="copyPathToClipboard"
        @refresh="refreshCurrentFolder"
        @item-dblclick="handleItemDoubleClick"
        @toggle-favorite="toggleFavorite"
        @navigate="navigateIntoFolder"
      />

      <!-- 未选磁盘时的引导 -->
      <div
        v-else
        class="db-welcome"
      >
        <IconWrapper
          name="diskBrowser"
          :size="40"
        />
        <p>{{ i18n.clickToBrowse }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n } from "./types"
import type { DiskBrowserStorage } from "./types/storage"
import IconWrapper from "@/components/IconWrapper.vue"
import FolderList from "./components/FolderList.vue"
import NavPane from "./components/NavPane.vue"
import { useDiskBrowser } from "./composables/useDiskBrowser"

interface Props {
  i18n: DiskBrowserI18n
  storage: DiskBrowserStorage
}

const props = defineProps<Props>()

const {
  disks,
  desktopPath,
  expandedDisk,
  folders,
  loading,
  loadingFolders,
  loadError,
  currentPath,
  favoriteFolders,
  favoriteSet,
  pathSegments,
  rootLabel,
  isDesktopRoot,
  totalCapacity,
  totalUsed,
  toggleFavorite,
  toggleDisk,
  toggleDesktop,
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
} = useDiskBrowser({ i18n: props.i18n, storage: props.storage })
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
