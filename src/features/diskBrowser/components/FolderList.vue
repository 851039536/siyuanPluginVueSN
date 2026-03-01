<template>
  <div class="folder-list">
    <div class="folder-list-header">
      <div class="header-left">
        <Button
          v-if="currentPath"
          variant="ghost"
          size="small"
          icon="back"
          :icon-size="16"
          class="back-btn"
          :title="i18n.back || '返回上级'"
          @click="$emit('back')"
        />
        <span>{{ currentDisplayPath }}</span>
      </div>
      <div class="folder-header-actions">
        <Tag v-if="folders.length > 0" size="small" variant="default" class="item-count">
          {{ folders.length }} {{ i18n.items || '项' }}
        </Tag>
        <Tag
          v-if="currentFolderCache.text"
          :variant="currentFolderCache.isExpired ? 'danger' : 'info'"
          size="small"
          class="cache-tag-small"
          :title="currentFolderCache.tooltip"
        >
          {{ currentFolderCache.text }}
        </Tag>
        <Button
          variant="ghost"
          size="small"
          icon="refresh"
          :icon-size="14"
          :loading="loadingFolders"
          :title="i18n.refreshing || '刷新'"
          @click="$emit('refresh')"
        />
        <Button
          variant="ghost"
          size="small"
          icon="openInNew"
          :icon-size="14"
          :title="i18n.openInExplorer || '在资源管理器中打开'"
          @click="$emit('open', currentPath || expandedDisk)"
        />
        <Button
          variant="ghost"
          size="small"
          icon="contentCopy"
          :icon-size="14"
          :title="i18n.copyPath || '复制路径'"
          @click="$emit('copy-path', currentPath || expandedDisk)"
        />
      </div>
    </div>

    <div class="folder-items" v-if="!loadingFolders">
      <div
        v-for="item in folders"
        :key="item.path"
        class="folder-item"
        :class="{ 'is-file': item.isFile }"
        @dblclick="$emit('item-dblclick', item)"
      >
        <div class="folder-icon">
          <IconWrapper :name="item.isFile ? 'file' : 'folder'" :size="20" />
        </div>
        <div class="folder-info">
          <div class="folder-name" :title="item.name">{{ item.name }}</div>
          <div class="folder-meta" v-if="item.size !== undefined || item.modifiedTime">
            <span v-if="item.isFile && item.size !== undefined" class="file-size">{{ formatSize(item.size) }}</span>
            <span v-if="item.modifiedTime" class="modified-time">{{ formatDate(item.modifiedTime) }}</span>
          </div>
        </div>
        <div class="folder-actions">
          <Button
            v-if="!item.isFile"
            variant="ghost"
            size="small"
            :icon="isFavorite(item.path) ? 'star' : 'starOutline'"
            :icon-size="14"
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
            :icon-size="14"
            class="folder-action-btn"
            :title="i18n.browse || '浏览'"
            @click.stop="$emit('navigate', item)"
          />
          <Button
            variant="ghost"
            size="small"
            icon="openInNew"
            :icon-size="14"
            class="folder-action-btn"
            :title="i18n.open || '打开'"
            @click.stop="$emit('open', item.path)"
          />
          <Button
            variant="ghost"
            size="small"
            icon="contentCopy"
            :icon-size="14"
            class="folder-action-btn"
            :title="i18n.copyPath || '复制路径'"
            @click.stop="$emit('copy-path', item.path)"
          />
        </div>
      </div>
      <div v-if="folders.length === 0" class="empty-state">
        <IconWrapper name="folder" :size="48" color="var(--b3-theme-on-surface-light)" />
        <p>{{ i18n.emptyFolder || '此文件夹为空' }}</p>
      </div>
    </div>
    <div class="loading-state" v-else>
      <div class="loading-spinner"></div>
      <span>{{ i18n.loading || '加载中...' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
import IconWrapper from '@/components/IconWrapper.vue'
import Tag from '@/components/Tag.vue'
import type { FolderInfo, CacheStatus, DiskBrowserI18n } from '../types'

interface Props {
  folders: FolderInfo[]
  currentPath: string
  expandedDisk: string
  currentDisplayPath: string
  loadingFolders: boolean
  currentFolderCache: CacheStatus
  favoriteFolders: string[]
  i18n: DiskBrowserI18n
  formatDate: (date: string) => string
}

const props = defineProps<Props>()
defineEmits<{
  back: []
  refresh: []
  open: [path: string]
  'copy-path': [path: string]
  'item-dblclick': [item: FolderInfo]
  'toggle-favorite': [path: string]
  navigate: [item: FolderInfo]
}>()

function isFavorite(path: string): boolean {
  return props.favoriteFolders.includes(path)
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.folder-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.folder-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;

    span {
      font-size: 13px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.folder-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.folder-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    transform: translateX(2px);

    .folder-actions {
      opacity: 1;
    }
  }

  &.is-file {
    .folder-icon {
      color: var(--b3-theme-on-surface-light);
    }
  }
}

.folder-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
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
  font-size: 13px;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.file-size {
  font-weight: 500;
}

.modified-time {
  opacity: 0.8;
}

.folder-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.folder-action-btn {
  &.is-favorite {
    color: var(--b3-theme-primary);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--b3-theme-on-surface-light);

  svg, :deep(svg) {
    opacity: 0.3;
    margin-bottom: 16px;
  }

  p {
    margin: 0;
    font-size: 14px;
    opacity: 0.7;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;

  span {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
  }
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--b3-theme-surface-lighter);
  border-top-color: var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
