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
          :icon="isDesktopRoot ? 'desktop' : 'diskBrowser'"
          :title="rootTitle"
          @click="$emit('navigateRoot')"
        >
          {{ rootLabel }}
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
import { computed } from "vue"
import Button from "@/components/Button.vue"

interface Props {
  currentPath: string
  expandedDisk: string
  /** 导航根显示名（盘符 → "E:"，桌面 → i18n.desktop） */
  rootLabel: string
  /** 当前根是否为桌面（决定根图标与悬浮提示） */
  isDesktopRoot: boolean
  pathSegments: string[]
  loadingFolders: boolean
  i18n: DiskBrowserI18n
}

const props = defineProps<Props>()
defineEmits<{
  back: []
  navigateRoot: []
  navigatePath: [index: number]
  open: [path: string]
  copyPath: [path: string]
  refresh: []
}>()

/** 根节点悬浮提示：桌面上补出真实绝对路径（面包屑只显示「桌面」） */
const rootTitle = computed(() =>
  props.isDesktopRoot ? `${props.i18n.desktop}: ${props.expandedDisk}` : props.i18n.backToRoot,
)
</script>

<style scoped lang="scss">
@use "../styles/AddressBar.scss";
</style>
