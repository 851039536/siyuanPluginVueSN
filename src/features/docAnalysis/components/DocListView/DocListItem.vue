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
        :class="timeInfo.class"
      >
        <Icon
          icon="mdi:clock-outline"
          class="badge-icon"
        />
        {{ timeInfo.label }}
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
        v-if="(doc.refCount ?? 0) > 0"
        class="badge ref-badge"
      >
        <Icon
          icon="mdi:link-variant"
          class="badge-icon"
        />
        {{ doc.refCount }}引用
      </span>
      <span
        v-if="(doc.imageCount ?? 0) > 0"
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
import type { DocI18n, DocInfo } from "../../types/index"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import {
  formatBytes,
  formatWordCount,
} from "../../utils/format"

interface Props {
  doc: DocInfo
  /** docAnalysis 分片 i18n（提供字数单位模板等文案） */
  i18n: DocI18n
}

const props = defineProps<Props>()

defineEmits<{
  (e: "open", docId: string): void
  (e: "attrs", docId: string): void
}>()

const formatSize = computed(() => formatBytes(props.doc.contentSize))
// 字数文案模板：wordCountNormal="{count} 字"、wordCountLarge="{countTenK} 万字"
const formatWords = computed(() => formatWordCount(props.doc.wordCount, props.i18n.wordCountNormal, props.i18n.wordCountLarge))

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

/** 更新时间派生信息（样式类 + 可读标签），一次解析时间避免重复计算 */
const timeInfo = computed<{ class: string, label: string }>(() => {
  const ts = props.doc.updated
  if (!ts) return { class: "", label: "" }
  const date = parseSiyuanTime(ts)
  if (!date) return { class: "", label: ts }
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffDays = diffMs / 86400000

  let cls = ""
  if (diffDays <= 7) cls = "time-green"
  else if (diffDays <= 30) cls = "time-yellow"
  else if (diffDays > 180) cls = "time-red"

  let label: string
  if (diffSec < 60) label = "刚刚"
  else if (diffSec < 3600) label = `${Math.floor(diffSec / 60)}分钟前`
  else if (diffSec < 86400) label = `${Math.floor(diffSec / 3600)}小时前`
  else if (diffDays < 30) label = `${Math.floor(diffDays)}天前`
  else if (diffDays < 180) label = `${Math.floor(diffDays / 30)}月前`
  else {
    label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }
  return { class: cls, label }
})
</script>

<style lang="scss" scoped>
@use "../../styles/DocListItem.scss";
</style>
