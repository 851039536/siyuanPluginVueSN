<template>
  <CollapsibleSection
    :title="`📝 ${title}`"
    :default-expanded="true"
    :badge="loading ? '' : docs.length > 0 ? `${docs.length}` : ''"
  >
    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="recent-docs-loading"
    >
      {{ i18n.loading || '加载中...' }}
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="docs.length === 0"
      class="recent-docs-empty"
    >
      {{ emptyText }}
    </div>

    <!-- 文档列表 -->
    <div
      v-else
      class="recent-docs-list"
    >
      <div
        v-for="(doc, index) in docs"
        :key="doc.id"
        class="recent-doc-item"
        :class="{ 'is-today': isToday(doc.updated), 'is-recent': isRecent(doc.updated) }"
        title="点击打开文档"
        @click="openDoc(doc.id)"
      >
        <!-- 序号 -->
        <span class="recent-doc-index">{{ index + 1 }}</span>

        <!-- 文档信息 -->
        <div class="recent-doc-body">
          <div class="recent-doc-top">
            <span class="recent-doc-title">{{ doc.title || '无标题' }}</span>
            <span
              v-if="doc.notebookName"
              class="recent-doc-notebook"
            >{{ doc.notebookName }}</span>
          </div>
          <div class="recent-doc-bottom">
            <span class="recent-doc-time-full">{{ doc.timeLabel }}</span>
            <span class="recent-doc-relative">{{ formatRelativeTime(doc.updated) }}</span>
          </div>
        </div>

        <!-- 今日标记 -->
        <span
          v-if="isToday(doc.updated)"
          class="recent-doc-today-badge"
        >今天</span>
      </div>
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
import type { RecentUpdatedDoc } from "../types"
import { ref } from "vue"
import { padZero } from "../utils"
import CollapsibleSection from "./CollapsibleSection.vue"

interface Props {
  title?: string
  emptyText?: string
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  title: "最近更新",
  emptyText: "暂无数据",
  i18n: () => ({}),
})

const docs = ref<RecentUpdatedDoc[]>([])
const loading = ref(false)

function openDoc(docId: string) {
  if (docId) {
    window.open(`siyuan://blocks/${docId}`)
  }
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`
}

/**
 * 判断是否为今天更新的文档
 */
function isToday(updated: string): boolean {
  if (!updated || updated.length < 8) return false
  return updated.substring(0, 8) === getTodayStr()
}

/**
 * 判断是否为最近 3 天更新的文档
 */
function isRecent(updated: string): boolean {
  if (!updated || updated.length < 8) return false
  const today = new Date()
  const y = Number.parseInt(updated.substring(0, 4))
  const mo = Number.parseInt(updated.substring(4, 6)) - 1
  const d = Number.parseInt(updated.substring(6, 8))
  const docDate = new Date(y, mo, d)
  const diffDay = Math.floor((today.getTime() - docDate.getTime()) / 86400000)
  return diffDay >= 0 && diffDay < 3
}

/**
 * 计算相对时间描述
 * 输入 updated 为 YYYYMMDDHHmmss 格式字符串
 */
function formatRelativeTime(updated: string): string {
  if (!updated || updated.length < 8) return ""

  const y = Number.parseInt(updated.substring(0, 4))
  const mo = Number.parseInt(updated.substring(4, 6)) - 1
  const d = Number.parseInt(updated.substring(6, 8))
  const h = updated.length >= 10 ? Number.parseInt(updated.substring(8, 10)) : 0
  const mi = updated.length >= 12 ? Number.parseInt(updated.substring(10, 12)) : 0

  const docDate = new Date(y, mo, d, h, mi)
  const now = new Date()
  const diffMs = now.getTime() - docDate.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`
  return `${Math.floor(diffDay / 365)}年前`
}

async function loadDocs(fetchFn: () => Promise<RecentUpdatedDoc[]>) {
  loading.value = true
  try {
    docs.value = await fetchFn()
  } catch (e) {
    console.error("加载最近更新文档失败:", e)
    docs.value = []
  } finally {
    loading.value = false
  }
}

defineExpose({ loadDocs, docs })
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.recent-docs-loading,
.recent-docs-empty {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.recent-docs-list {
  max-height: 420px;
  overflow-y: auto;
}

.recent-doc-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  & + & {
    border-top: 1px solid rgba(128, 128, 128, 0.08);
  }

  // 今天更新的高亮
  &.is-today {
    background: rgba(var(--b3-theme-primary-rgb), 0.04);
    border-left: 2px solid var(--b3-theme-primary);
    padding-left: 6px;
  }

  &.is-recent:not(.is-today) {
    background: rgba(var(--b3-theme-primary-rgb), 0.015);
  }
}

.recent-doc-index {
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  opacity: 0.3;
  min-width: 16px;
  text-align: center;
  line-height: 20px;
  flex-shrink: 0;
}

.recent-doc-body {
  flex: 1;
  min-width: 0;
}

.recent-doc-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recent-doc-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.recent-doc-notebook {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  background: rgba(128, 128, 128, 0.08);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-doc-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}

.recent-doc-time-full {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.recent-doc-relative {
  font-size: 10px;
  color: var(--b3-theme-primary);
  opacity: 0.65;
  font-weight: 500;
}

.recent-doc-today-badge {
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  background: var(--b3-theme-primary);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 16px;
}
</style>
