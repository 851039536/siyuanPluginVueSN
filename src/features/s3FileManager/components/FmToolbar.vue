<!-- 工具栏 — 上传/新建文件夹/下载/复制/移动/重命名/删除 + 搜索 + 视图切换 + 配置/日志入口（外壳复用共享 Toolbar） -->
<template>
  <Toolbar
    class="fm-toolbar"
    variant="borderless"
    size="xsmall"
    wrap
    :padded="false"
    :aria-label="i18n.toolbarLabel"
  >
    <template #start>
      <!-- 按钮："上传" -->
      <Button
        size="xsmall"
        icon="upload"
        :icon-size="14"
        :disabled="busy"
        @click="emit('upload')"
      >
        {{ i18n.upload }}
      </Button>
      <!-- 按钮："新建文件夹" -->
      <Button
        variant="secondary"
        size="xsmall"
        icon="folderPlus"
        :icon-size="14"
        :disabled="busy"
        @click="emit('newFolder')"
      >
        {{ i18n.newFolder }}
      </Button>

      <!-- 选中项操作组（有选中时显示） -->
      <template v-if="selectedCount > 0">
        <!-- 按钮："下载" -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="download"
          :icon-size="14"
          :disabled="busy"
          :title="i18n.download"
          @click="emit('download')"
        />
        <!-- 按钮："复制" -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="copy"
          :icon-size="14"
          :disabled="busy"
          :title="i18n.copy"
          @click="emit('copy')"
        />
        <!-- 按钮："移动" -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="folderMove"
          :icon-size="14"
          :disabled="busy"
          :title="i18n.move"
          @click="emit('move')"
        />
        <!-- 按钮："重命名"（仅单选可用） -->
        <Button
          variant="ghost"
          size="xsmall"
          icon="edit"
          :icon-size="14"
          :disabled="busy || selectedCount !== 1"
          :title="i18n.rename"
          @click="emit('rename')"
        />
        <!-- 按钮："删除" -->
        <Button
          variant="danger"
          size="xsmall"
          icon="delete"
          :icon-size="14"
          :disabled="busy"
          :title="i18n.delete"
          @click="emit('delete')"
        />
        <!-- 选中计数："已选 N 项" -->
        <span class="fm-selected-count">{{ i18n.selectedPrefix }} {{ selectedCount }} {{ i18n.itemsUnit }}</span>
      </template>
    </template>

    <template #end>
      <!-- 搜索：按名称子串过滤当前目录（清空按钮由共享 Input 承担；清空时载荷为 null → 空串） -->
      <Input
        class="fm-toolbar-search"
        :model-value="searchQuery"
        size="xsmall"
        :placeholder="i18n.searchPlaceholder"
        clearable
        @update:model-value="emit('update:searchQuery', String($event ?? ''))"
      />
      <!-- 视图切换：详细/图标（一组互斥选项 ⇒ Button 分组 + aria-pressed） -->
      <Button
        :variant="viewMode === 'details' ? 'secondary' : 'ghost'"
        :aria-pressed="viewMode === 'details'"
        size="xsmall"
        icon="list"
        :icon-size="14"
        :title="i18n.viewDetails"
        @click="emit('setView', 'details')"
      />
      <Button
        :variant="viewMode === 'icons' ? 'secondary' : 'ghost'"
        :aria-pressed="viewMode === 'icons'"
        size="xsmall"
        icon="viewGrid"
        :icon-size="14"
        :title="i18n.viewIcons"
        @click="emit('setView', 'icons')"
      />
      <!-- 按钮："操作日志" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="textBox"
        :icon-size="14"
        :title="i18n.logTitle"
        @click="emit('openLog')"
      />
      <!-- 按钮："S3 配置" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="settings"
        :icon-size="14"
        :title="i18n.configTitle"
        @click="emit('openConfig')"
      />
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
import type { S3FileManagerI18n, ViewMode } from "../types"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Toolbar from "@/components/Toolbar.vue"

interface Props {
  busy: boolean
  selectedCount: number
  viewMode: ViewMode
  /** 名称过滤词（受控：由宿主持有，本组件只回传变更） */
  searchQuery: string
  i18n: S3FileManagerI18n
}

defineProps<Props>()

const emit = defineEmits<{
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
  /** 搜索过滤词变更（含清空） */
  "update:searchQuery": [value: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/FmToolbar.scss";
</style>
