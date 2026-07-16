<!-- 双栏布局左侧栏 — 磁盘列表 + 收藏夹 + 刷新 -->
<template>
  <div class="db-sidebar">
    <div class="db-sidebar-header">
      <IconWrapper
        name="diskBrowser"
        :size="16"
        color="var(--b3-theme-primary)"
      />
      <span class="db-sidebar-title">{{ i18n.panelTitle || '磁盘浏览器' }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :icon-size="12"
        :loading="loading"
        :title="i18n.refreshing || '刷新'"
        class="db-sidebar-refresh"
        @click="$emit('refreshAll')"
      />
    </div>

    <div class="db-drives">
      <div
        v-for="disk in disks"
        :key="disk.drive"
        class="db-drive-row"
        :class="{ active: expandedDisk === disk.drive }"
        :title="disk.label ? `${disk.label} (${disk.drive})` : disk.drive"
        @click="$emit('selectDisk', disk)"
      >
        <div class="db-drive-icon">
          <IconWrapper
            name="diskBrowser"
            :size="16"
          />
        </div>
        <div class="db-drive-info">
          <span class="db-drive-label">{{ disk.drive }}</span>
          <span
            v-if="disk.total"
            class="db-drive-usage"
          >{{ disk.usagePercent || 0 }}%</span>
        </div>
        <div
          v-if="disk.total"
          class="db-drive-bar"
        >
          <div
            class="db-drive-fill"
            :style="{ width: `${disk.usagePercent || 0}%` }"
          />
        </div>
      </div>
    </div>

    <div
      v-if="favoriteFolders.length > 0"
      class="db-favorites"
    >
      <div class="db-favorites-title">
        <IconWrapper
          name="star"
          :size="12"
          color="#f97316"
        />
        <span>{{ i18n.favorites || '收藏夹' }}</span>
        <Badge
          :content="favoriteFolders.length"
          variant="primary"
          size="xsmall"
        />
      </div>
      <div
        v-for="path in favoriteFolders"
        :key="path"
        class="db-fav-row"
        :title="path"
        @click="$emit('navigateFavorite', path)"
      >
        <IconWrapper
          name="folder"
          :size="12"
          color="var(--b3-theme-on-surface-light)"
        />
        <span class="db-fav-name">{{ getFolderName(path) }}</span>
        <Button
          variant="ghost"
          size="xsmall"
          icon="close"
          :icon-size="10"
          class="db-fav-remove"
          :title="i18n.removeFavorite || '取消收藏'"
          @click.stop="$emit('removeFavorite', path)"
        />
      </div>
    </div>

    <div class="db-sidebar-footer">
      <span
        v-if="cacheStatus.text"
        class="db-cache-tag"
        :class="{ expired: cacheStatus.isExpired }"
        :title="cacheStatus.tooltip"
      >
        {{ cacheStatus.text }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CacheStatus,
  DiskBrowserI18n,
  DiskInfo,
} from "../types"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { getFolderName } from "../utils"

interface Props {
  disks: DiskInfo[]
  expandedDisk: string
  favoriteFolders: string[]
  loading: boolean
  cacheStatus: CacheStatus
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  refreshAll: []
  selectDisk: [disk: DiskInfo]
  navigateFavorite: [path: string]
  removeFavorite: [path: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/Sidebar.scss";
@use "../styles/index.scss";
</style>
