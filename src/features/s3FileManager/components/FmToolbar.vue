<!-- 工具栏 — 上传/新建文件夹/下载/复制/移动/重命名/删除 + 视图切换 + 配置/日志入口 -->
<template>
  <div class="fm-toolbar">
    <div class="fm-toolbar-group">
      <!-- 按钮："上传" -->
      <Button
        size="xsmall"
        icon="upload"
        :icon-size="14"
        :disabled="!isConfigured || busy"
        @click="$emit('upload')"
      >
        {{ i18n.upload }}
      </Button>
      <!-- 按钮："新建文件夹" -->
      <Button
        variant="secondary"
        size="xsmall"
        icon="folderPlus"
        :icon-size="14"
        :disabled="!isConfigured || busy"
        @click="$emit('newFolder')"
      >
        {{ i18n.newFolder }}
      </Button>
    </div>

    <!-- 选中项操作组（有选中时显示） -->
    <div
      v-if="selectedCount > 0"
      class="fm-toolbar-group"
    >
      <!-- 按钮："下载" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="download"
        :icon-size="14"
        :disabled="busy"
        :title="i18n.download"
        @click="$emit('download')"
      />
      <!-- 按钮："复制" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="copy"
        :icon-size="14"
        :disabled="busy"
        :title="i18n.copy"
        @click="$emit('copy')"
      />
      <!-- 按钮："移动" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="folderMove"
        :icon-size="14"
        :disabled="busy"
        :title="i18n.move"
        @click="$emit('move')"
      />
      <!-- 按钮："重命名"（仅单选可用） -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="edit"
        :icon-size="14"
        :disabled="busy || selectedCount !== 1"
        :title="i18n.rename"
        @click="$emit('rename')"
      />
      <!-- 按钮："删除" -->
      <Button
        variant="danger"
        size="xsmall"
        icon="delete"
        :icon-size="14"
        :disabled="busy"
        :title="i18n.delete"
        @click="$emit('delete')"
      />
      <!-- 选中计数："已选 N 项" -->
      <span class="fm-selected-count">{{ i18n.selectedPrefix }} {{ selectedCount }} {{ i18n.itemsUnit }}</span>
    </div>

    <div class="fm-toolbar-spacer" />

    <div class="fm-toolbar-group">
      <!-- 视图切换：详细/图标 -->
      <Button
        :variant="viewMode === 'details' ? 'secondary' : 'ghost'"
        size="xsmall"
        icon="list"
        :icon-size="14"
        :title="i18n.viewDetails"
        @click="$emit('setView', 'details')"
      />
      <Button
        :variant="viewMode === 'icons' ? 'secondary' : 'ghost'"
        size="xsmall"
        icon="viewGrid"
        :icon-size="14"
        :title="i18n.viewIcons"
        @click="$emit('setView', 'icons')"
      />
      <!-- 按钮："操作日志" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="textBox"
        :icon-size="14"
        :title="i18n.logTitle"
        @click="$emit('openLog')"
      />
      <!-- 按钮："S3 配置" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="settings"
        :icon-size="14"
        :title="i18n.configTitle"
        @click="$emit('openConfig')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { S3FileManagerI18n, ViewMode } from "../types"
import Button from "@/components/Button.vue"

interface Props {
  isConfigured: boolean
  busy: boolean
  selectedCount: number
  viewMode: ViewMode
  i18n: S3FileManagerI18n
}

defineProps<Props>()
defineEmits<{
  upload: []
  newFolder: []
  download: []
  copy: []
  move: []
  rename: []
  delete: []
  setView: [mode: ViewMode]
  openLog: []
  openConfig: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/FmToolbar.scss";
@use "../styles/index.scss";
</style>
