<!-- 文档列表项组件 - 标题/元信息/徽章/发布状态 -->
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
      <div class="attrs-btn-wrapper">
        <button
          class="action-btn attrs-btn"
          title="查看属性"
          @click.stop="$emit('attrs', doc.id)"
        >
          <Icon icon="mdi:information-outline" />
        </button>
        <div
          v-if="doc.unpublishedPlatforms"
          class="unpublished-tooltip"
        >
          <div class="tooltip-header">
            未发布平台
          </div>
          <div
            v-for="name in doc.unpublishedPlatforms"
            :key="name"
            class="tooltip-item"
          >{{ name }}</div>
        </div>
        <div
          v-else
          class="unpublished-tooltip published-all"
        >
          <div class="tooltip-header">
            全部已发布
          </div>
        </div>
      </div>
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
} from "../utils/format"

interface Props {
  doc: DocInfo
}

const props = defineProps<Props>()

defineEmits<{
  (e: "open", docId: string): void
  (e: "attrs", docId: string): void
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
@use "../styles/DocListItem.scss";
</style>
