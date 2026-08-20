<template>
  <div
    class="vp-result-item"
    @dblclick="handleOpen"
  >
    <!-- 类型图标 -->
    <div class="vp-result-item__icon">
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
      <!-- 打开按钮提示："打开文件夹" / "打开文件" -->
      <button
        class="vp-result-item__action"
        :title="openButtonTitle"
        :aria-label="openButtonTitle"
        @click.stop="handleOpen"
      >
        <svg><use xlink:href="#iconOpen" /></svg>
      </button>
      <!-- 操作按钮提示："在资源管理器中显示" -->
      <button
        class="vp-result-item__action"
        :title="i18n.showInExplorer"
        :aria-label="i18n.showInExplorer"
        @click.stop="handleShowInFolder"
      >
        <svg><use xlink:href="#iconFolder" /></svg>
      </button>
      <!-- 操作按钮提示："复制路径" -->
      <button
        class="vp-result-item__action"
        :title="i18n.copyPath"
        :aria-label="i18n.copyPath"
        @click.stop="handleCopyPath"
      >
        <svg><use xlink:href="#iconCopy" /></svg>
      </button>
      <!-- 操作按钮提示："删除" -->
      <button
        class="vp-result-item__action vp-result-item__action--delete"
        :title="i18n.delete"
        :aria-label="i18n.delete"
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
import { formatFileSize } from "@/utils/format"
import { getFullPath } from "../api"

interface Props {
  item: EverythingSearchResult
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "open", item: EverythingSearchResult): void
  (e: "showInFolder", item: EverythingSearchResult): void
  (e: "copyPath", item: EverythingSearchResult): void
  (e: "delete", item: EverythingSearchResult): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 扩展名 → IconWrapper 图标键一级映射（模块级常量，避免每次求值重建） */
const EXT_ICON_KEY_MAP: Record<string, IconKey> = {
  // 文档
  "pdf": "file",
  "doc": "file",
  "docx": "file",
  "xls": "file",
  "xlsx": "file",
  "ppt": "file",
  "pptx": "file",
  "txt": "file",
  "md": "edit",
  // 图片
  "jpg": "image",
  "jpeg": "image",
  "png": "image",
  "gif": "image",
  "svg": "image",
  "webp": "image",
  "bmp": "image",
  "ico": "image",
  // 视频/音频
  "mp4": "play",
  "avi": "play",
  "mkv": "play",
  "mov": "play",
  "wmv": "play",
  "flv": "play",
  "mp3": "play",
  "wav": "play",
  "flac": "play",
  "aac": "play",
  "ogg": "play",
  // 压缩包
  "zip": "folder",
  "rar": "folder",
  "7z": "folder",
  "tar": "folder",
  "gz": "folder",
  // 代码
  "js": "code",
  "ts": "code",
  "jsx": "code",
  "tsx": "code",
  "vue": "code",
  "html": "code",
  "css": "code",
  "scss": "code",
  "less": "code",
  "json": "code",
  "xml": "code",
  "py": "code",
  "java": "code",
  "c": "code",
  "cpp": "code",
  "h": "code",
  "go": "code",
  "rs": "code",
  "rb": "code",
  "php": "code",
  "sql": "code",
  "sh": "code",
  "bat": "code",
  // 可执行文件
  "exe": "settings",
  "msi": "settings",
  "dll": "settings",
}

/** 提取文件扩展名（小写，无扩展名或点开头返回空串） */
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1 || lastDot === 0) return ""
  return filename.substring(lastDot + 1).toLowerCase()
}

const fullPath = computed(() => getFullPath(props.item))
const formattedSize = computed(() => formatFileSize(props.item.size))

const iconKey = computed<IconKey>(() => {
  if (props.item.type === "folder") return "folder"
  return EXT_ICON_KEY_MAP[getFileExtension(props.item.name)] || "file"
})

// 打开按钮提示文案："打开文件夹" / "打开文件"
const openButtonTitle = computed(() =>
  props.item.type === "folder" ? props.i18n.openFolder : props.i18n.openFile,
)

const handleOpen = () => emit("open", props.item)
const handleShowInFolder = () => emit("showInFolder", props.item)
const handleCopyPath = () => emit("copyPath", props.item)
const handleDelete = () => emit("delete", props.item)
</script>

<style scoped lang="scss">
@use "../styles/ResultItem.scss";
</style>
