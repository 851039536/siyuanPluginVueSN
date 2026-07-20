<!-- 磁盘浏览器 Dock 面板根组件 — 双栏布局（侧栏 + 内容区） -->
<template>
  <div class="disk-browser-panel">
    <div
      v-if="!expandedDisk"
      class="db-all-drives"
    >
      <div class="db-all-drives-header">
        <IconWrapper
          name="diskBrowser"
          :size="16"
          color="var(--b3-theme-primary)"
        />
        <span>{{ i18n.panelTitle || '磁盘浏览器' }}</span>
        <Button
          variant="ghost"
          size="xsmall"
          icon="refresh"
          :icon-size="12"
          :loading="loading"
          :title="i18n.refreshing || '刷新'"
          @click="refreshDisks"
        />
      </div>
      <div class="db-all-drives-grid">
        <div
          v-for="disk in disks"
          :key="disk.drive"
          class="db-all-drive-card"
          @click="toggleDisk(disk)"
        >
          <div class="db-all-drive-icon">
            <IconWrapper
              name="diskBrowser"
              :size="22"
            />
          </div>
          <span class="db-all-drive-label">{{ disk.drive }}</span>
          <span class="db-all-drive-name">{{ disk.label || '\u00A0' }}</span>
          <div
            v-if="disk.total"
            class="db-all-drive-bar"
          >
            <div
              class="db-all-drive-fill"
              :style="{ width: `${disk.usagePercent || 0}%` }"
            />
          </div>
          <div
            v-if="disk.total"
            class="db-all-drive-space"
          >
            {{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}
          </div>
        </div>
      </div>
      <div
        v-if="favoriteFolders.length > 0"
        class="db-all-favorites"
      >
        <div class="db-all-fav-header">
          <IconWrapper
            name="star"
            :size="12"
            color="#f97316"
          />
          <span>{{ i18n.favorites || '收藏夹' }}</span>
        </div>
        <div
          v-for="path in favoriteFolders"
          :key="path"
          class="db-all-fav-row"
          @click="navigateToFavorite(path)"
        >
          <IconWrapper
            name="folder"
            :size="14"
          />
          <span>{{ getFolderName(path) }}</span>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="db-layout">
        <Sidebar
          :disks="disks"
          :expanded-disk="expandedDisk"
          :favorite-folders="favoriteFolders"
          :loading="loading"
          :cache-status="cacheStatus"
          :i18n="i18n"
          @refresh-all="refreshDisks"
          @select-disk="toggleDisk"
          @navigate-favorite="navigateToFavorite"
          @remove-favorite="toggleFavorite"
        />

        <FolderList
          :folders="folders"
          :current-path="currentPath"
          :expanded-disk="expandedDisk"
          :path-segments="pathSegments"
          :loading-folders="loadingFolders"
          :current-folder-cache="currentFolderCache"
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
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n } from "./types"
import type { DiskBrowserStorage } from "./types/storage"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import FolderList from "./components/FolderList.vue"
import Sidebar from "./components/Sidebar.vue"
import { useDiskBrowser } from "./composables/useDiskBrowser"
import { formatSize, getFolderName } from "./utils"

interface Props {
  i18n: DiskBrowserI18n
  storage: DiskBrowserStorage
}

const props = defineProps<Props>()

const {
  disks,
  expandedDisk,
  folders,
  loading,
  loadingFolders,
  currentPath,
  favoriteFolders,
  favoriteSet,
  pathSegments,
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
