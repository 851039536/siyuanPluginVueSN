<!-- 地址栏组件 — 返回按钮 + 面包屑路径 + 操作工具栏 -->
<template>
  <div class="db-address-bar">
    <div class="db-address-left">
      <Button
        v-if="currentPath"
        variant="ghost"
        size="xsmall"
        icon="back"
        :icon-size="14"
        class="db-back-btn"
        :title="i18n.back"
        @click="$emit('back')"
      />
      <div class="db-breadcrumb">
        <button
          class="db-crumb"
          :title="i18n.backToRoot"
          @click="$emit('navigateRoot')"
        >
          <IconWrapper
            name="diskBrowser"
            :size="11"
          />
          {{ expandedDisk }}
        </button>
        <template
          v-for="(segment, index) in pathSegments"
          :key="index"
        >
          <span class="db-crumb-sep">&#9656;</span>
          <button
            class="db-crumb"
            :title="segment"
            @click="$emit('navigatePath', index)"
          >
            {{ segment }}
          </button>
        </template>
      </div>
    </div>

    <div class="db-toolbar-actions">
      <span
        v-if="itemCount > 0"
        class="db-item-count"
      >{{ itemCount }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="openInNew"
        :icon-size="13"
        :title="i18n.openInExplorer"
        @click="$emit('open', currentPath || expandedDisk)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="contentCopy"
        :icon-size="13"
        :title="i18n.copyPath"
        @click="$emit('copyPath', currentPath || expandedDisk)"
      />
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :icon-size="13"
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
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  loadingFolders: boolean
  itemCount: number
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
@use "../styles/index.scss";
</style>
