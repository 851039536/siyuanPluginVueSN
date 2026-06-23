<template>
  <div
    class="vp-result-item"
    @dblclick="handleDblClick"
  >
    <!-- 类型图标 -->
    <div
      class="vp-result-item__icon"
      :class="iconClass"
    >
      <IconWrapper
        :name="iconKey"
        :size="14"
      />
    </div>

    <!-- 文件信息 -->
    <div class="vp-result-item__info">
      <div
        class="vp-result-item__name"
        :title="item.name"
      >
        {{ item.name }}
      </div>
      <div
        class="vp-result-item__path"
        :title="fullPath"
      >
        {{ item.path }}
      </div>
    </div>

    <!-- 元数据 -->
    <div class="vp-result-item__meta">
      <span
        v-if="item.type === 'file'"
        class="vp-result-item__size"
      >{{ formattedSize }}</span>
      <span class="vp-result-item__date">{{ item.dateModified }}</span>
    </div>

    <!-- 操作按钮 -->
    <div class="vp-result-item__actions">
      <button
        class="vp-result-item__action"
        :title="openButtonTitle"
        :aria-label="openButtonTitle"
        @click.stop="handleOpen"
      >
        <svg><use xlink:href="#iconOpen" /></svg>
      </button>
      <button
        class="vp-result-item__action"
        title="在资源管理器中显示"
        aria-label="在资源管理器中显示"
        @click.stop="handleShowInFolder"
      >
        <svg><use xlink:href="#iconFolder" /></svg>
      </button>
      <button
        class="vp-result-item__action"
        title="复制路径"
        aria-label="复制路径"
        @click.stop="handleCopyPath"
      >
        <svg><use xlink:href="#iconCopy" /></svg>
      </button>
      <button
        class="vp-result-item__action vp-result-item__action--delete"
        title="删除"
        aria-label="删除"
        @click.stop="handleDelete"
      >
        <svg><use xlink:href="#iconTrashcan" /></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EverythingSearchResult } from "../types"
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatFileSize,
  getFileIconType,
  getFullPath,
} from "../api"

interface Props {
  item: EverythingSearchResult
}

interface Emits {
  (e: "dblClick", item: EverythingSearchResult): void
  (e: "open", item: EverythingSearchResult): void
  (e: "showInFolder", item: EverythingSearchResult): void
  (e: "copyPath", item: EverythingSearchResult): void
  (e: "delete", item: EverythingSearchResult): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fullPath = computed(() => getFullPath(props.item))
const formattedSize = computed(() => formatFileSize(props.item.size))

const iconClass = computed(
  () => `vp-result-item__icon--${getFileIconType(props.item.name, props.item.type === "folder")}`,
)

const iconKey = computed<IconKey>(() => {
  if (props.item.type === "folder") return "folder"
  const iconType = getFileIconType(props.item.name, false)
  const iconKeyMap: Record<string, IconKey> = {
    folder: "folder",
    file: "file",
    image: "image",
    video: "play",
    audio: "play",
    archive: "folder",
    code: "code",
    executable: "settings",
    siyuan: "file",
    text: "file",
    markdown: "edit",
    pdf: "file",
    word: "file",
    excel: "file",
    ppt: "file",
  }
  return iconKeyMap[iconType] || "file"
})

const openButtonTitle = computed(() =>
  props.item.type === "folder" ? "打开文件夹" : "打开文件",
)

const handleDblClick = () => emit("dblClick", props.item)
const handleOpen = () => emit("open", props.item)
const handleShowInFolder = () => emit("showInFolder", props.item)
const handleCopyPath = () => emit("copyPath", props.item)
const handleDelete = () => emit("delete", props.item)
</script>

<style scoped lang="scss">
@use "../styles/ResultItem.scss";
</style>
