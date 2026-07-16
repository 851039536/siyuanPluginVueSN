<!-- 文件夹列表头部栏 — 返回按钮、当前路径、项目计数、缓存标签、操作按钮 -->
<template>
  <div class="folder-list-header">
    <div class="header-left">
      <Button
        v-if="currentPath"
        variant="ghost"
        size="xsmall"
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
        v-if="itemCount > 0"
        class="item-count"
      >
        {{ itemCount }} {{ i18n.items || '项' }}
      </span>
      <span
        v-if="cacheStatus.text"
        class="cache-tag-small"
        :class="{ expired: cacheStatus.isExpired }"
        :title="cacheStatus.tooltip"
      >
        {{ cacheStatus.text }}
      </span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :icon-size="13"
        :loading="loadingFolders"
        :title="i18n.refreshing || '刷新'"
        @click="$emit('refresh')"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="openInNew"
        :icon-size="13"
        :title="i18n.openInExplorer || '在资源管理器中打开'"
        @click="$emit('open', currentPath || expandedDisk)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="contentCopy"
        :icon-size="13"
        :title="i18n.copyPath || '复制路径'"
        @click="$emit('copyPath', currentPath || expandedDisk)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CacheStatus, DiskBrowserI18n } from "../types"
import Button from "@/components/Button.vue"

interface Props {
  currentPath: string
  expandedDisk: string
  currentDisplayPath: string
  loadingFolders: boolean
  cacheStatus: CacheStatus
  itemCount: number
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  back: []
  refresh: []
  open: [path: string]
  copyPath: [path: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/FolderListHeader.scss";
@use "../styles/index.scss";
</style>
