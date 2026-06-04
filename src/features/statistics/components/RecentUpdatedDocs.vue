<template>
  <CollapsibleSection
    :title="title"
    :default-expanded="true"
    :badge="loading ? '' : docs.length > 0 ? `${docs.length}` : ''"
  >
    <!-- 加载状态 -->
    <div
      v-if="loading"
      class="rd-loading"
    >
      <span class="rd-loading-dot" />
      {{ i18n.loading || '加载中...' }}
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="docs.length === 0"
      class="rd-empty"
    >
      <svg class="rd-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span>{{ emptyText }}</span>
    </div>

    <!-- 文档列表（按时间分组） -->
    <div
      v-else
      class="rd-list"
    >
      <template v-for="group in groupedDocs" :key="group.label">
        <div class="rd-group-header">{{ group.label }}</div>
        <div
          v-for="doc in group.docs"
          :key="doc.id"
          class="rd-item"
          @click="openDoc(doc.id)"
        >
          <!-- 文档图标 -->
          <svg class="rd-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>

          <!-- 主体内容 -->
          <div class="rd-item-body">
            <div class="rd-item-path">
              <span
                v-if="doc.notebookName"
                class="rd-notebook"
              >{{ doc.notebookName }}</span>
              <span class="rd-separator">/</span>
            </div>
            <div class="rd-item-title">{{ doc.title || '无标题' }}</div>
          </div>

          <!-- 时间 -->
          <span class="rd-time">{{ formatRelativeTime(doc.updated) }}</span>
        </div>
      </template>
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
import type { RecentUpdatedDoc } from "../types"
import { computed, ref } from "vue"
import { padZero } from "../utils"
import CollapsibleSection from "./CollapsibleSection.vue"

interface Props {
  title?: string
  emptyText?: string
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  title: "最近更新",
  emptyText: "暂无最近更新的文档",
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

function getYesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`
}

type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

function getTimeGroup(updated: string): TimeGroup {
  if (!updated || updated.length < 8) return 'earlier'
  const date8 = updated.substring(0, 8)
  if (date8 === getTodayStr()) return 'today'
  if (date8 === getYesterdayStr()) return 'yesterday'

  const today = new Date()
  const y = Number.parseInt(updated.substring(0, 4))
  const mo = Number.parseInt(updated.substring(4, 6)) - 1
  const d = Number.parseInt(updated.substring(6, 8))
  const docDate = new Date(y, mo, d)
  const diffDay = Math.floor((today.getTime() - docDate.getTime()) / 86400000)
  if (diffDay < 7) return 'thisWeek'
  return 'earlier'
}

const groupLabels: Record<TimeGroup, string> = {
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本周',
  earlier: '更早',
}

interface DocGroup {
  label: string
  docs: RecentUpdatedDoc[]
}

const groupedDocs = computed<DocGroup[]>(() => {
  const groups: Record<TimeGroup, RecentUpdatedDoc[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }
  for (const doc of docs.value) {
    groups[getTimeGroup(doc.updated)].push(doc)
  }
  const result: DocGroup[] = []
  for (const key of ['today', 'yesterday', 'thisWeek', 'earlier'] as TimeGroup[]) {
    if (groups[key].length > 0) {
      result.push({ label: groupLabels[key], docs: groups[key] })
    }
  }
  return result
})

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
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} 个月前`
  return `${Math.floor(diffDay / 365)} 年前`
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
@use "@/variables" as *;

.rd-loading,
.rd-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 12px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  font-family: $font-body;
}

.rd-loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  animation: rd-pulse 1.2s ease-in-out infinite;
}

@keyframes rd-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.rd-empty-icon {
  width: 28px;
  height: 28px;
  opacity: 0.35;
}

.rd-list {
  display: flex;
  flex-direction: column;
  max-height: 180px;
  overflow-y: auto;
}

// ---- group header ----
.rd-group-header {
  padding: 10px 12px 4px;
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

// ---- item row ----
.rd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
  font-family: $font-body;

  &:hover {
    background: var(--b3-list-hover);
  }
}

.rd-item-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.25;
}

.rd-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.rd-item-path {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.rd-notebook {
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rd-separator {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.2;
  margin: 0 3px;
}

.rd-item-title {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rd-time {
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>
