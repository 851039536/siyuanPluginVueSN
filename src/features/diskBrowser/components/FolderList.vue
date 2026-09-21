<!-- 文件列表内容区 — 地址栏 + 列标题 + 列表项 + 加载/空/错误状态 + 底栏 -->
<template>
  <div class="db-content">
    <AddressBar
      :current-path="currentPath"
      :expanded-disk="expandedDisk"
      :path-segments="pathSegments"
      :loading-folders="loadingFolders"
      :i18n="i18n"
      @back="$emit('back')"
      @navigate-root="$emit('navigateRoot')"
      @navigate-path="$emit('navigatePath', $event)"
      @open="$emit('open', $event)"
      @copy-path="$emit('copyPath', $event)"
      @refresh="$emit('refresh')"
    />

    <template v-if="!loadingFolders">
      <!-- 读取失败：与「空目录」区分（权限拒绝 / 路径消失等） -->
      <div
        v-if="loadError"
        class="db-error"
      >
        <IconWrapper
          name="error"
          :size="32"
        />
        <p>{{ loadError }}</p>
      </div>

      <template v-else>
        <div
          v-if="folders.length > 0"
          class="db-column-headers"
        >
          <span class="db-col-name">{{ i18n.name }}</span>
          <span class="db-col-size">{{ i18n.size }}</span>
          <span class="db-col-date">{{ i18n.date }}</span>
          <span class="db-col-actions" />
        </div>

        <div class="db-folder-items">
          <FolderListItem
            v-for="item in folders"
            :key="item.path"
            :item="item"
            :is-favorite="favoriteSet.has(item.path)"
            :i18n="i18n"
            :format-date="formatDate"
            @item-dblclick="$emit('itemDblclick', $event)"
            @toggle-favorite="$emit('toggleFavorite', $event)"
            @navigate="$emit('navigate', $event)"
            @open="$emit('open', $event)"
            @copy-path="$emit('copyPath', $event)"
          />
          <div
            v-if="folders.length === 0"
            class="db-empty"
          >
            <IconWrapper
              name="folder"
              :size="36"
            />
            <p>{{ i18n.emptyFolder }}</p>
          </div>
        </div>
      </template>
    </template>

    <div
      v-else
      class="db-loading"
    >
      <Loader />
    </div>

    <div class="db-status-bar">
      <span
        class="db-status-path"
        :title="currentPath || expandedDisk"
      >{{ currentPath || expandedDisk }}</span>
      <span v-if="!loadError">{{ folders.length }} {{ i18n.items }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  DiskBrowserI18n,
  FolderInfo,
} from "../types"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import AddressBar from "./AddressBar.vue"
import FolderListItem from "./FolderListItem.vue"

interface Props {
  folders: FolderInfo[]
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  loadingFolders: boolean
  loadError: string
  favoriteSet: Set<string>
  i18n: DiskBrowserI18n
  formatDate: (date: string) => string
}

defineProps<Props>()
defineEmits<{
  back: []
  navigateRoot: []
  navigatePath: [index: number]
  open: [path: string]
  copyPath: [path: string]
  refresh: []
  itemDblclick: [item: FolderInfo]
  toggleFavorite: [path: string]
  navigate: [item: FolderInfo]
}>()
</script>

<style scoped lang="scss">
@use "../styles/FolderList.scss";
</style>
