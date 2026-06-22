<template>
  <div
    class="vp-result-item"
    @click="handleClick"
    @dblclick="handleDblClick"
  >
    <!-- 类型图标 -->
    <div class="vp-result-item__icon" :class="iconClass">
      <IconWrapper :name="iconKey" :size="14" />
    </div>

    <!-- 文件信息 -->
    <div class="vp-result-item__info">
      <div class="vp-result-item__name" :title="item.name">
        {{ item.name }}
      </div>
      <div class="vp-result-item__path" :title="fullPath">
        {{ item.path }}
      </div>
    </div>

    <!-- 元数据 -->
    <div class="vp-result-item__meta">
      <span v-if="item.type === 'file'" class="vp-result-item__size">{{ formattedSize }}</span>
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
  (e: "click", item: EverythingSearchResult): void
  (e: "dblClick", item: EverythingSearchResult): void
  (e: "open", item: EverythingSearchResult): void
  (e: "showInFolder", item: EverythingSearchResult): void
  (e: "copyPath", item: EverythingSearchResult): void
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

const handleClick = () => emit("click", props.item)
const handleDblClick = () => emit("dblClick", props.item)
const handleOpen = () => emit("open", props.item)
const handleShowInFolder = () => emit("showInFolder", props.item)
const handleCopyPath = () => emit("copyPath", props.item)
</script>

<style scoped lang="scss">
@use "@/variables" as *;

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

.vp-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  cursor: pointer;

  &:hover {
    background: rgba(201, 122, 93, 0.06);

    .vp-result-item__actions {
      opacity: 1;
    }
  }

  // 类型图标 — Codex 边框格子
  &__icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-surface);
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  // 文件名 — 中等权重 + 普通字体（非等宽，避免中文文件名阅读困难）
  &__name {
    font-size: 12px;
    font-weight: 600;
    font-family: $font-heading;
    color: var(--b3-theme-on-background);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // 路径 — Codex 等宽字体
  &__path {
    font-size: 10px;
    font-family: $vp-mono;
    color: var(--b3-theme-on-surface);
    opacity: 0.45;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  // 元数据 — Codex 等宽字体
  &__meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  &__size {
    font-size: 10px;
    font-weight: 600;
    font-family: $vp-mono;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }

  &__date {
    font-size: 9px;
    font-family: $vp-mono;
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }

  // 操作按钮 — hover 显示
  &__actions {
    display: flex;
    gap: 4px;
    opacity: 0;
  }

  &__action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);

    svg {
      width: 12px;
      height: 12px;
    }

    &:hover {
      background: $brand-orange;
      border-color: $brand-orange;
      color: $brand-light;
    }
  }
}
</style>
