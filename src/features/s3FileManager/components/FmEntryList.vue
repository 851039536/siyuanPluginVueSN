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
      <!-- 列标题：名称 / 大小 / 修改日期（点列头排序）
           aria-sort 必须挂在 role="columnheader" 上，故由外层 div 承担该角色，内层 button 只负责触发 -->
      <div
        class="fm-column-headers"
        role="row"
      >
        <!-- 三段列头仅字段不同，抽 v-for 去重；label 映射到对应 i18n 键 -->
        <div
          v-for="col in columns"
          :key="col.field"
          class="fm-col"
          :class="`fm-col-${col.field === 'time' ? 'date' : col.field}`"
          role="columnheader"
          :aria-sort="ariaSort(col.field)"
        >
          <button
            class="fm-col-btn"
            @click="emit('sort', col.field)"
          >
            {{ colLabels[col.field] }}
            <IconWrapper
              v-if="sortField === col.field"
              class="fm-sort-arrow"
              :name="sortAsc ? 'chevronUp' : 'chevronDown'"
              :size="10"
            />
          </button>
        </div>
      </div>

      <div class="fm-detail-rows">
        <div
          v-for="entry in entries"
          :key="entry.key"
          class="fm-detail-row"
          :class="{ selected: isSelected(entry.key), 'drag-over': dragOverKey === entry.key }"
          draggable="true"
          @click="emit('itemClick', entry, $event)"
          @dblclick="emit('itemDblclick', entry)"
          @contextmenu.prevent="emit('itemContextmenu', entry, $event)"
          @dragstart="onDragStart(entry, $event)"
          @dragend="onDragEnd()"
          @dragover="onFolderDragOver(entry, $event)"
          @dragleave="onFolderDragLeave(entry)"
          @drop="onFolderDrop(entry, $event)"
        >
          <span class="fm-col-name">
            <IconWrapper
              :name="entryIconKey(entry)"
              :size="14"
            />
            <span
              class="fm-entry-name"
              :title="entry.name"
            >{{ entry.name }}</span>
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
          :class="{ selected: isSelected(entry.key), 'drag-over': dragOverKey === entry.key }"
          :title="entry.name"
          draggable="true"
          @click="emit('itemClick', entry, $event)"
          @dblclick="emit('itemDblclick', entry)"
          @contextmenu.prevent="emit('itemContextmenu', entry, $event)"
          @dragstart="onDragStart(entry, $event)"
          @dragend="onDragEnd()"
          @dragover="onFolderDragOver(entry, $event)"
          @dragleave="onFolderDragLeave(entry)"
          @drop="onFolderDrop(entry, $event)"
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
import { computed, ref } from "vue"
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

const props = defineProps<Props>()
const emit = defineEmits<{
  itemClick: [entry: S3Entry, ev: MouseEvent]
  itemDblclick: [entry: S3Entry]
  itemContextmenu: [entry: S3Entry, ev: MouseEvent]
  sort: [field: SortField]
  loadMore: []
  entryDragStart: [entry: S3Entry]
  entryDropToFolder: [entry: S3Entry]
}>()

/** 详细视图列头定义：三列仅排序字段不同，模板按此 v-for 渲染 */
const columns: ReadonlyArray<{ field: SortField }> = [
  { field: "name" },
  { field: "size" },
  { field: "time" },
]

/** 列头文案映射：field → 对应 i18n 键 */
const colLabels = computed<Record<SortField, string>>(() => ({
  name: props.i18n.colName,
  size: props.i18n.colSize,
  time: props.i18n.colDate,
}))

/** 列头排序态：仅当前排序列报方向，其余为 none（读屏可感知排序依据） */
function ariaSort(field: SortField): "ascending" | "descending" | "none" {
  if (props.sortField !== field) { return "none" }
  return props.sortAsc ? "ascending" : "descending"
}

// ========== 内部拖动（条目拖到文件夹=移动） ==========

/** 当前被拖动条目的 key（仅内部拖动期间有值） */
const draggingKey = ref<string | null>(null)
/** 当前作为放置目标高亮的文件夹 key */
const dragOverKey = ref<string | null>(null)

/** 目标是否可放置：内部拖动中 + 目标为文件夹 + 非自身 */
function isDropTarget(entry: S3Entry): boolean {
  return !!draggingKey.value && entry.isFolder && entry.key !== draggingKey.value
}

function onDragStart(entry: S3Entry, e: DragEvent): void {
  draggingKey.value = entry.key
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move"
  }
  // 内部/外部拖动的区分由本组件的 draggingKey 与 useExternalDrop 的 hasFiles() 完成，
  // 无需再向 dataTransfer 写入自定义类型（旧 x-s3fm 标记全仓无任何读取方）
  emit("entryDragStart", entry)
}

function onDragEnd(): void {
  draggingKey.value = null
  dragOverKey.value = null
}

function onFolderDragOver(entry: S3Entry, e: DragEvent): void {
  if (!isDropTarget(entry)) { return }
  // preventDefault 才能成为放置目标；非文件夹/外部拖入不在此拦截，冒泡给外部拖入区
  e.preventDefault()
  if (e.dataTransfer) { e.dataTransfer.dropEffect = "move" }
  dragOverKey.value = entry.key
}

function onFolderDragLeave(entry: S3Entry): void {
  if (dragOverKey.value === entry.key) { dragOverKey.value = null }
}

function onFolderDrop(entry: S3Entry, e: DragEvent): void {
  if (!isDropTarget(entry)) { return }
  e.preventDefault()
  e.stopPropagation() // 阻断冒泡到外部 fm-browse 拖入区
  emit("entryDropToFolder", entry)
  draggingKey.value = null
  dragOverKey.value = null
}
</script>

<style scoped lang="scss">
@use "../styles/FmEntryList.scss";
</style>
