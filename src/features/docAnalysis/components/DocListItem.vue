<template>
  <div
    class="doc-list-item"
    @click="$emit('open', doc.id)"
  >
    <div class="doc-info">
      <div class="doc-title">
        <Icon
          icon="mdi:file-document-outline"
          class="doc-icon"
        />
        <span class="title-text">{{ doc.title }}</span>
      </div>
      <div class="doc-meta">
        <span class="meta-notebook">
          <Icon
            icon="mdi:book-outline"
            class="meta-icon"
          />
          {{ doc.notebookName }}
        </span>
        <span
          v-if="doc.hpath"
          class="meta-path"
        >{{ doc.hpath }}</span>
      </div>
    </div>
    <div class="doc-badges">
      <span
        v-if="doc.publishStatus === 'published'"
        class="badge publish-badge published"
      >
        <Icon
          icon="mdi:check-circle"
          class="badge-icon"
        />
        已发布{{ doc.publishedPlatformCount ? `(${doc.publishedPlatformCount})` : '' }}
      </span>
      <span
        v-if="doc.updated"
        class="badge time-badge"
        :class="timeClass"
      >
        <Icon
          icon="mdi:clock-outline"
          class="badge-icon"
        />
        {{ formatTime(doc.updated) }}
      </span>
      <span
        v-if="doc.depth !== undefined && doc.depth >= 3"
        class="badge depth-badge"
      >
        <Icon
          icon="mdi:sitemap-outline"
          class="badge-icon"
        />
        {{ doc.depth }}层
      </span>
      <span
        v-if="doc.refCount && doc.refCount > 0"
        class="badge ref-badge"
      >
        <Icon
          icon="mdi:link-variant"
          class="badge-icon"
        />
        {{ doc.refCount }}引用
      </span>
      <span
        v-if="doc.imageCount && doc.imageCount > 0"
        class="badge img-badge"
      >
        <Icon
          icon="mdi:image-outline"
          class="badge-icon"
        />
        {{ doc.imageCount }}
      </span>
      <span
        v-if="doc.bookmark"
        class="badge bookmark-badge"
      >
        <Icon
          icon="mdi:bookmark"
          class="badge-icon"
        />
        {{ doc.bookmark }}
      </span>
    </div>
    <div class="doc-actions">
      <button
        class="publish-action-btn"
        title="发布此文档"
        @click.stop="$emit('publish', doc.id, doc.title)"
      >
        <Icon icon="mdi:publish" />
      </button>
    </div>
    <div class="doc-size">
      <span
        v-if="doc.wordCount > 0"
        class="wordcount-value"
      >{{ formatWords }}</span>
      <span class="size-value">{{ formatSize }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocInfo } from "../types/index"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import {
  formatBytes,
  formatWordCount,
} from "../types/storage"

interface Props {
  doc: DocInfo
}

const props = defineProps<Props>()

defineEmits<{
  (e: "open", docId: string): void
  (e: "publish", docId: string, docTitle: string): void
}>()

const formatSize = computed(() => formatBytes(props.doc.contentSize))
const formatWords = computed(() => formatWordCount(props.doc.wordCount))

/** 解析思源 yyyyMMddHHmmss 格式时间字符串为 Date */
function parseSiyuanTime(ts: string): Date | null {
  if (!ts || ts.length < 8) return null
  const year = Number.parseInt(ts.substring(0, 4))
  const month = Number.parseInt(ts.substring(4, 6)) - 1
  const day = Number.parseInt(ts.substring(6, 8))
  const hour = ts.length >= 10 ? Number.parseInt(ts.substring(8, 10)) : 0
  const min = ts.length >= 12 ? Number.parseInt(ts.substring(10, 12)) : 0
  const sec = ts.length >= 14 ? Number.parseInt(ts.substring(12, 14)) : 0
  return new Date(year, month, day, hour, min, sec)
}

/** 根据更新时间判断样式 */
const timeClass = computed(() => {
  if (!props.doc.updated) return ""
  const date = parseSiyuanTime(props.doc.updated)
  if (!date) return ""
  const diffDays = (Date.now() - date.getTime()) / 86400000
  if (diffDays <= 7) return "time-green"
  if (diffDays <= 30) return "time-yellow"
  if (diffDays > 180) return "time-red"
  return ""
})

/** 格式化时间为可读字符串 */
function formatTime(ts: string): string {
  const date = parseSiyuanTime(ts)
  if (!date) return ts
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "刚刚"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
  const diffDays = Math.floor(diffSec / 86400)
  if (diffDays < 30) return `${diffDays}天前`
  if (diffDays < 180) return `${Math.floor(diffDays / 30)}月前`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
</script>

<style lang="scss" scoped>
.doc-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--b3-border-color);

  &:hover {
    background-color: var(--b3-list-hover);
  }

  .doc-info {
    flex: 1;
    min-width: 0;
  }

  .doc-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--b3-theme-on-background);
    font-weight: 500;

    .doc-icon {
      font-size: 16px;
      color: var(--b3-theme-primary);
      flex-shrink: 0;
    }

    .title-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .doc-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);

    .meta-notebook {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
    }

    .meta-icon {
      font-size: 12px;
    }

    .meta-path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
  }

  .doc-badges {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    flex-shrink: 0;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    background: var(--b3-theme-surface-light);
    color: var(--b3-theme-on-surface-variant);
    white-space: nowrap;

    .badge-icon {
      font-size: 11px;
    }

    &.time-green {
      color: #22c55e;
      background: rgba(34, 197, 94, 0.1);
    }

    &.time-yellow {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
    }

    &.time-red {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    &.depth-badge {
      color: #06b6d4;
      background: rgba(6, 182, 212, 0.1);
    }

    &.ref-badge {
      color: #8b5cf6;
      background: rgba(139, 92, 246, 0.1);
    }

    &.img-badge {
      color: #f97316;
      background: rgba(249, 115, 22, 0.1);
    }

    &.bookmark-badge {
      color: #eab308;
      background: rgba(234, 179, 8, 0.1);
    }

    &.publish-badge {
      &.published {
        color: #22c55e;
        background: rgba(34, 197, 94, 0.1);
      }
    }
  }

  .doc-actions {
    flex-shrink: 0;
    margin-left: 4px;
  }

  .publish-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--b3-theme-on-surface-variant);
    cursor: pointer;
    font-size: 16px;

    &:hover {
      background: var(--b3-theme-primary-lightest, rgba(53, 120, 226, 0.08));
      color: var(--b3-theme-primary);
    }
  }

  .doc-size {
    flex-shrink: 0;
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;

    .wordcount-value {
      font-size: 12px;
      color: var(--b3-theme-on-surface-variant);
      background: var(--b3-theme-surface-light);
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .size-value {
      font-size: 11px;
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.7;
      white-space: nowrap;
    }
  }
}
</style>
