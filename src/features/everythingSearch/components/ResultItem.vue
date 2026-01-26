<template>
  <div class="result-item" @click="handleClick" @dblclick="handleDblClick">
    <!-- 图标 -->
    <div class="item-icon" :class="iconClass" :aria-label="item.type">
      {{ iconEmoji }}
    </div>

    <!-- 文件信息 -->
    <div class="item-info">
      <div class="item-name" :title="item.name">{{ item.name }}</div>
      <div class="item-path" :title="fullPath">{{ item.path }}</div>
    </div>

    <!-- 元数据 -->
    <div class="item-meta">
      <span v-if="item.type === 'file'" class="item-size">{{ formattedSize }}</span>
      <span class="item-date">{{ item.dateModified }}</span>
    </div>

    <!-- 操作按钮 -->
    <div class="item-actions">
      <button class="action-btn" @click.stop="handleOpen" :title="openButtonTitle" :aria-label="openButtonTitle">
        <svg class="action-icon"><use xlink:href="#iconOpen"></use></svg>
      </button>
      <button class="action-btn" @click.stop="handleShowInFolder" title="在资源管理器中显示" aria-label="在资源管理器中显示">
        <svg class="action-icon"><use xlink:href="#iconFolder"></use></svg>
      </button>
      <button class="action-btn" @click.stop="handleCopyPath" title="复制路径" aria-label="复制路径">
        <svg class="action-icon"><use xlink:href="#iconCopy"></use></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EverythingSearchResult } from '../api'
import { formatFileSize, getFileIconType } from '../api'

interface Props {
  /** 搜索结果项 */
  item: EverythingSearchResult
}

interface Emits {
  (e: 'click', item: EverythingSearchResult): void
  (e: 'dblClick', item: EverythingSearchResult): void
  (e: 'open', item: EverythingSearchResult): void
  (e: 'showInFolder', item: EverythingSearchResult): void
  (e: 'copyPath', item: EverythingSearchResult): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 完整路径 */
const fullPath = computed(() => {
  return props.item.path ? `${props.item.path}\\${props.item.name}` : props.item.name
})

/** 格式化大小 */
const formattedSize = computed(() => formatFileSize(props.item.size))

/** 图标类 */
const iconClass = computed(() => `icon-${getFileIconType(props.item.name, props.item.type === 'folder')}`)

/** 图标 emoji */
const iconEmoji = computed(() => {
  if (props.item.type === 'folder') return '📁'

  const iconType = getFileIconType(props.item.name, false)
  const emojiMap: Record<string, string> = {
    pdf: '📕',
    word: '📘',
    excel: '📗',
    ppt: '📙',
    text: '📄',
    markdown: '📝',
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    archive: '📦',
    code: '💻',
    executable: '⚙️',
    siyuan: '📔',
    file: '📄'
  }
  return emojiMap[iconType] || '📄'
})

/** 打开按钮标题 */
const openButtonTitle = computed(() => {
  return props.item.type === 'folder' ? '打开文件夹' : '打开文件'
})

/** 处理点击 */
const handleClick = () => {
  emit('click', props.item)
}

/** 处理双击 */
const handleDblClick = () => {
  emit('dblClick', props.item)
}

/** 处理打开 */
const handleOpen = () => {
  emit('open', props.item)
}

/** 处理在文件夹中显示 */
const handleShowInFolder = () => {
  emit('showInFolder', props.item)
}

/** 处理复制路径 */
const handleCopyPath = () => {
  emit('copyPath', props.item)
}
</script>

<style scoped lang="scss">
@use "../../../index.scss" as *;

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  cursor: pointer;
  transition: background 0.15s;
}

.result-item:hover {
  background: rgba(217, 119, 87, 0.06);
}

.result-item:hover .item-actions {
  opacity: 1;
}

.item-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 12px;
  font-weight: 500;
  font-family: $font-heading;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-path {
  font-size: 10px;
  font-family: $font-body;
  color: $brand-mid-gray;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex-shrink: 0;
}

.item-size {
  font-size: 10px;
  font-family: $font-body;
  color: var(--b3-theme-on-surface);
  font-weight: 500;
}

.item-date {
  font-size: 9px;
  font-family: $font-body;
  color: $brand-mid-gray;
}

.item-actions {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.action-btn {
  padding: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.15s;
}

.action-btn:hover {
  background: $brand-orange;
  border-color: $brand-orange;
  color: $brand-light;
}

.action-icon {
  width: 11px;
  height: 11px;
}
</style>
