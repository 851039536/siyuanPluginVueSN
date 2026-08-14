<!-- 磁盘浏览器 Dock 面板根组件 — 双栏布局（侧栏 + 内容区） -->
<template>
  <div class="disk-browser-panel">
    <div
      v-if="!expandedDisk"
      class="db-all-drives"
    >
      <div class="db-all-drives-header">
        <div class="db-all-drives-heading">
          <IconWrapper
            name="diskBrowser"
            :size="16"
            color="var(--b3-theme-primary)"
          />
          <span>{{ i18n.panelTitle }}</span>
        </div>
        <Button
          variant="ghost"
          size="xsmall"
          icon="refresh"
          :icon-size="12"
          :loading="loading"
          :title="i18n.refreshing"
          @click="refreshDisks"
        />
      </div>

      <div
        v-if="disks.length > 0"
        class="db-all-overview"
      >
        <div class="db-all-overview-icon">
          <IconWrapper
            name="diskBrowser"
            :size="28"
          />
        </div>
        <div class="db-all-overview-info">
          <div class="db-all-overview-meta">
            {{ disks.length }} {{ i18n.disks }}
          </div>
          <div
            v-if="totalCapacity > 0"
            class="db-all-overview-capacity"
          >
            <span class="db-all-overview-used">
              {{ i18n.usedSpace }} {{ formatSize(totalUsed) }}
            </span>
            <span class="db-all-overview-divider">·</span>
            <span>{{ i18n.totalSpace }} {{ formatSize(totalCapacity) }}</span>
          </div>
          <div class="db-all-overview-hint">
            {{ i18n.clickToBrowse }}
          </div>
        </div>
      </div>

      <div
        v-if="disks.length > 0"
        class="db-all-drives-grid"
      >
        <div
          v-for="disk in disks"
          :key="disk.drive"
          class="db-all-drive-card"
          @click="toggleDisk(disk)"
        >
          <div class="db-all-drive-card-head">
            <div class="db-all-drive-icon">
              <IconWrapper
                name="diskBrowser"
                :size="22"
              />
            </div>
            <div class="db-all-drive-ident">
              <span class="db-all-drive-label">{{ disk.drive }}</span>
              <span
                v-if="disk.label"
                class="db-all-drive-name"
                :title="disk.label"
              >{{ disk.label }}</span>
            </div>
            <span
              v-if="disk.total"
              class="db-all-drive-percent"
              :class="usageToneClass(disk.usagePercent || 0)"
            >{{ disk.usagePercent || 0 }}%</span>
          </div>

          <div
            v-if="disk.total"
            class="db-all-drive-bar"
          >
            <div
              class="db-all-drive-fill"
              :class="usageToneClass(disk.usagePercent || 0)"
              :style="{ width: `${Math.min(disk.usagePercent || 0, 100)}%` }"
            />
          </div>
          <div
            v-if="disk.total"
            class="db-all-drive-space"
          >
            <span>{{ i18n.usedSpace }} {{ formatSize(disk.used || 0) }}</span>
            <span class="db-all-drive-free">
              {{ i18n.freeSpace }} {{ formatSize(disk.total - (disk.used || 0)) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-else-if="loading"
        class="db-all-empty"
      >
        <Loader />
      </div>
      <div
        v-else
        class="db-all-empty"
      >
        <IconWrapper
          name="diskBrowser"
          :size="32"
          color="var(--b3-theme-on-surface-light)"
        />
        <p>{{ i18n.loadDisksFailed }}</p>
      </div>

      <div class="db-all-favorites">
        <div class="db-all-fav-header">
          <IconWrapper
            name="star"
            :size="12"
            color="#f97316"
          />
          <span>{{ i18n.favorites }}</span>
          <Badge
            v-if="favoriteFolders.length > 0"
            :content="favoriteFolders.length"
            variant="primary"
            size="xsmall"
          />
        </div>
        <div
          v-if="favoriteFolders.length > 0"
          class="db-all-fav-list"
        >
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
        <div
          v-else
          class="db-all-fav-empty"
        >
          <IconWrapper
            name="starOutline"
            :size="20"
            color="var(--b3-theme-on-surface-light)"
          />
          <p>{{ i18n.noFavorites }}</p>
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
import { computed } from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import FolderList from "./components/FolderList.vue"
import Sidebar from "./components/Sidebar.vue"
import { useDiskBrowser } from "./composables/useDiskBrowser"
import {
  formatSize,
  getFolderName,
} from "./utils"

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

const totalCapacity = computed(() =>
  disks.value.reduce((sum, disk) => sum + (disk.total || 0), 0),
)

const totalUsed = computed(() =>
  disks.value.reduce((sum, disk) => sum + (disk.used || 0), 0),
)

function usageToneClass(percent: number): string {
  if (percent >= 85) return "tone-danger"
  if (percent >= 60) return "tone-warning"
  return "tone-normal"
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss" as *;
</style>
