<!-- 地址栏 — 返回按钮 + 面包屑路径 + 打开/复制/刷新操作 -->
<template>
  <div class="db-address-bar">
    <div class="db-address-left">
      <Button
        v-if="currentPath"
        variant="ghost"
        size="xsmall"
        dense
        icon="back"
        class="db-back-btn"
        :title="i18n.back"
        @click="$emit('back')"
      />
      <div class="db-breadcrumb">
        <Button
          variant="ghost"
          text
          size="xsmall"
          class="db-crumb"
          icon="diskBrowser"
          :title="i18n.backToRoot"
          @click="$emit('navigateRoot')"
        >
          {{ expandedDisk }}
        </Button>
        <template
          v-for="(segment, index) in pathSegments"
          :key="index"
        >
          <span class="db-crumb-sep">&#9656;</span>
          <Button
            variant="ghost"
            text
            size="xsmall"
            class="db-crumb"
            :title="segment"
            @click="$emit('navigatePath', index)"
          >
            {{ segment }}
          </Button>
        </template>
      </div>
    </div>

    <div class="db-toolbar-actions">
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="openInNew"
        :title="i18n.openInExplorer"
        @click="$emit('open', currentPath || expandedDisk)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="contentCopy"
        :title="i18n.copyPath"
        @click="$emit('copyPath', currentPath || expandedDisk)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        dense
        icon="refresh"
        :loading="loadingFolders"
        :title="i18n.refreshing"
        @click="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n } from "../types"
import Button from "@/components/Button.vue"

interface Props {
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  loadingFolders: boolean
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  back: []
  navigateRoot: []
  navigatePath: [index: number]
  open: [path: string]
  copyPath: [path: string]
  refresh: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/AddressBar.scss";
</style>
