<!-- 文件列表 — 详细信息表格 / 图标网格双视图，多选、双击进入、右键菜单、加载更多 -->
<template>
  <div class="fm-entry-list">
    <!-- 加载中 -->
    <div
      v-if="loading"
      class="fm-list-state"
    >
      <Loader />
    </div>

    <!-- 加载错误 -->
    <div
      v-else-if="loadError"
      class="fm-list-state fm-list-error"
    >
      <IconWrapper
        name="error"
        :size="20"
      />
      <span>{{ loadError }}</span>
    </div>

    <!-- 空目录 -->
    <div
      v-else-if="entries.length === 0"
      class="fm-list-state"
    >
      <!-- 空态："此文件夹为空" -->
      <span>{{ i18n.emptyFolder }}</span>
    </div>

    <!-- 详细信息视图 -->
    <template v-else-if="viewMode === 'details'">
      <!-- 列标题：名称 / 大小 / 修改日期 -->
      <div class="fm-column-headers">
        <button
          class="fm-col fm-col-name"
          @click="$emit('sort', 'name')"
        >
          {{ i18n.colName }}
          <span
            v-if="sortField === 'name'"
            class="fm-sort-arrow"
          >{{ sortAsc ? "▲" : "▼" }}</span>
        </button>
        <button
          class="fm-col fm-col-size"
          @click="$emit('sort', 'size')"
        >
          {{ i18n.colSize }}
          <span
            v-if="sortField === 'size'"
            class="fm-sort-arrow"
          >{{ sortAsc ? "▲" : "▼" }}</span>
        </button>
        <button
          class="fm-col fm-col-date"
          @click="$emit('sort', 'time')"
        >
          {{ i18n.colDate }}
          <span
            v-if="sortField === 'time'"
            class="fm-sort-arrow"
          >{{ sortAsc ? "▲" : "▼" }}</span>
        </button>
      </div>

      <div class="fm-detail-rows">
        <div
          v-for="entry in entries"
          :key="entry.key"
          class="fm-detail-row"
          :class="{ selected: isSelected(entry.key) }"
          @click="$emit('itemClick', entry, $event)"
          @dblclick="$emit('itemDblclick', entry)"
          @contextmenu.prevent="$emit('itemContextmenu', entry, $event)"
        >
          <span class="fm-col-name">
            <IconWrapper
              :name="entryIconKey(entry)"
              :size="14"
            />
            <span class="fm-entry-name">{{ entry.name }}</span>
          </span>
          <span class="fm-col-size">{{ entry.isFolder ? "—" : formatFileSize(entry.size) }}</span>
          <span class="fm-col-date">{{ entry.lastModified || "—" }}</span>
        </div>
      </div>
    </template>

    <!-- 图标网格视图 -->
    <template v-else>
      <div class="fm-icon-grid">
        <div
          v-for="entry in entries"
          :key="entry.key"
          class="fm-icon-item"
          :class="{ selected: isSelected(entry.key) }"
          :title="entry.name"
          @click="$emit('itemClick', entry, $event)"
          @dblclick="$emit('itemDblclick', entry)"
          @contextmenu.prevent="$emit('itemContextmenu', entry, $event)"
        >
          <IconWrapper
            :name="entryIconKey(entry)"
            :size="30"
          />
          <span class="fm-icon-name">{{ entry.name }}</span>
        </div>
      </div>
    </template>

    <!-- 加载更多（大目录增量渲染） -->
    <div
      v-if="!loading && hasMore"
      class="fm-load-more"
    >
      <!-- 按钮："加载更多" -->
      <Button
        variant="ghost"
        size="xsmall"
        @click="$emit('loadMore')"
      >
        {{ i18n.loadMore }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { S3Entry, S3FileManagerI18n, SortField, ViewMode } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"
import { formatFileSize } from "@/utils/format"
import { entryIconKey } from "../utils"

interface Props {
  entries: S3Entry[]
  viewMode: ViewMode
  loading: boolean
  loadError: string
  hasMore: boolean
  sortField: SortField
  sortAsc: boolean
  isSelected: (key: string) => boolean
  i18n: S3FileManagerI18n
}

defineProps<Props>()
defineEmits<{
  itemClick: [entry: S3Entry, ev: MouseEvent]
  itemDblclick: [entry: S3Entry]
  itemContextmenu: [entry: S3Entry, ev: MouseEvent]
  sort: [field: SortField]
  loadMore: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/FmEntryList.scss";
@use "../styles/index.scss";
</style>
