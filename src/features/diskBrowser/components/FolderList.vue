<template>
  <div class="folder-list">
    <div class="folder-list-header">
      <div class="header-left">
        <Button
          v-if="currentPath"
          variant="ghost"
          size="small"
          icon="back"
          :icon-size="14"
          class="back-btn"
          :title="i18n.back || '返回上级'"
          @click="$emit('back')"
        />
        <code class="header-path">{{ currentDisplayPath }}</code>
      </div>
      <div class="folder-header-actions">
        <span
          v-if="folders.length > 0"
          class="item-count"
        >
          {{ folders.length }} {{ i18n.items || '项' }}
        </span>
        <span
          v-if="currentFolderCache.text"
          class="cache-tag-small"
          :class="{ expired: currentFolderCache.isExpired }"
          :title="currentFolderCache.tooltip"
        >
          {{ currentFolderCache.text }}
        </span>
        <Button
          variant="ghost"
          size="small"
          icon="refresh"
          :icon-size="13"
          :loading="loadingFolders"
          :title="i18n.refreshing || '刷新'"
          @click="$emit('refresh')"
        />
        <Button
          variant="ghost"
          size="small"
          icon="openInNew"
          :icon-size="13"
          :title="i18n.openInExplorer || '在资源管理器中打开'"
          @click="$emit('open', currentPath || expandedDisk)"
        />
        <Button
          variant="ghost"
          size="small"
          icon="contentCopy"
          :icon-size="13"
          :title="i18n.copyPath || '复制路径'"
          @click="$emit('copy-path', currentPath || expandedDisk)"
        />
      </div>
    </div>

    <div
      v-if="!loadingFolders"
      class="folder-items"
    >
      <div
        v-for="item in folders"
        :key="item.path"
        class="folder-item"
        :class="{ 'is-file': item.isFile }"
        @dblclick="$emit('item-dblclick', item)"
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
            size="small"
            :icon="isFavorite(item.path) ? 'star' : 'starOutline'"
            :icon-size="13"
            class="folder-action-btn favorite-btn"
            :class="{ 'is-favorite': isFavorite(item.path) }"
            :title="isFavorite(item.path) ? (i18n.removeFavorite || '取消收藏') : (i18n.addFavorite || '添加收藏')"
            @click.stop="$emit('toggle-favorite', item.path)"
          />
          <Button
            v-if="!item.isFile"
            variant="ghost"
            size="small"
            icon="chevronRight"
            :icon-size="13"
            class="folder-action-btn"
            :title="i18n.browse || '浏览'"
            @click.stop="$emit('navigate', item)"
          />
          <Button
            variant="ghost"
            size="small"
            icon="openInNew"
            :icon-size="13"
            class="folder-action-btn"
            :title="i18n.open || '打开'"
            @click.stop="$emit('open', item.path)"
          />
          <Button
            variant="ghost"
            size="small"
            icon="contentCopy"
            :icon-size="13"
            class="folder-action-btn"
            :title="i18n.copyPath || '复制路径'"
            @click.stop="$emit('copy-path', item.path)"
          />
        </div>
      </div>
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
import type {
  CacheStatus,
  DiskBrowserI18n,
  FolderInfo,
} from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import { formatSize } from "../utils"

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

const props = defineProps<Props>()
defineEmits<{
  "back": []
  "refresh": []
  "open": [path: string]
  "copy-path": [path: string]
  "item-dblclick": [item: FolderInfo]
  "toggle-favorite": [path: string]
  "navigate": [item: FolderInfo]
}>()

function isFavorite(path: string): boolean {
  return props.favoriteSet.has(path)
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.folder-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid $border;
  @include contain-layout;
}

.folder-list-header {
  @include flex-align-center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid $border;
  flex-shrink: 0;

  .header-left {
    @include flex-align-center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .header-path {
    font-family: $mono;
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    @include text-ellipsis;
  }
}

.folder-header-actions {
  @include flex-align-center;
  gap: 4px;
}

.item-count {
  font-family: $mono;
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  padding: 1px 6px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 3px;
  white-space: nowrap;
}

.cache-tag-small {
  font-family: $mono;
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  padding: 1px 6px;
  background: var(--b3-theme-primary-lightest);
  border-radius: 3px;
  white-space: nowrap;

  &.expired {
    color: var(--b3-theme-error);
    background: rgba(var(--b3-theme-error-rgb, 220, 38, 38), 0.08);
  }
}

.folder-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  @include scrollbar;
}

.folder-item {
  @include flex-align-center;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 3px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  @include border-card;

  &:hover {
    .folder-actions {
      opacity: 1;
    }
  }

  &.is-file {
    .folder-icon {
      color: var(--b3-theme-on-surface-light);
    }

    .folder-name {
      font-family: $mono;
    }
  }
}

.folder-icon {
  flex-shrink: 0;
  @include flex-center;
  color: var(--b3-theme-primary);
}

.folder-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.folder-name {
  font-size: 12px;
  color: var(--b3-theme-on-background);
  @include text-ellipsis;
}

.folder-meta {
  @include flex-align-center;
  gap: 10px;
}

.file-size,
.modified-time {
  font-family: $mono;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.6;
}

.folder-actions {
  flex-shrink: 0;
  @include flex-align-center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
}

.folder-action-btn {
  &.is-favorite {
    color: var(--b3-theme-primary);
  }
}

.empty-state {
  @include flex-center;
  flex-direction: column;
  padding: 48px 20px;
  color: var(--b3-theme-on-surface-light);

  svg, :deep(svg) {
    opacity: 0.25;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
    font-size: 12px;
    opacity: 0.5;
    font-style: italic;
  }
}

.loading-wrapper {
  position: relative;
  height: 200px;
}
</style>
