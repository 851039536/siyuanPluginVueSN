<!-- 最近更新文档列表：按今天/昨天/本周/更早分组 + 相对时间展示 -->
<template>
  <div
    v-if="loading"
    class="changed-docs-loading"
  >
    <!-- 加载提示："加载中..." -->
    {{ i18n.loading }}
  </div>

  <div
    v-else-if="docs.length === 0"
    class="changed-docs-empty"
  >
    <!-- 空状态："暂无最近更新的文档" -->
    {{ i18n.noDocChanges }}
  </div>

  <div
    v-else
    class="recent-docs-list"
  >
    <template
      v-for="group in recentGroupedDocs"
      :key="group.label"
    >
      <!-- 分组标题："今天" / "昨天" / "本周" / "更早" -->
      <div class="recent-group-header">
        {{ group.label }}
      </div>
      <div
        v-for="doc in group.docs"
        :key="doc.id"
        class="recent-doc-item"
        :class="{ new: isDocCreatedToday(doc) }"
        @click="openDocById(doc.id)"
      >
        <span class="recent-doc-badge">
          <IconWrapper
            :name="isDocCreatedToday(doc) ? 'plus' : 'edit'"
            :size="11"
          />
        </span>
        <span
          v-if="doc.notebookName"
          class="recent-doc-notebook"
        >{{ doc.notebookName }}</span>
        <!-- 文档标题（空标题显示"无标题"） -->
        <span class="recent-doc-title">{{ doc.title || i18n.untitled }}</span>
        <span class="recent-doc-time">{{ formatRelativeTime(doc.updated) }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { RecentUpdatedDoc } from "../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatYmd, openDocById } from "../utils"

interface Props {
  docs?: RecentUpdatedDoc[]
  loading?: boolean
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  docs: () => [],
  loading: false,
  i18n: () => ({}),
})

function getTodayStr(): string {
  return formatYmd(new Date())
}

function getYesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatYmd(d)
}

function isDocCreatedToday(doc: RecentUpdatedDoc): boolean {
  return doc.created.substring(0, 8) === getTodayStr()
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

// 分组标签（今天/昨天/本周/更早）
const groupLabels = computed<Record<TimeGroup, string>>(() => ({
  today: props.i18n.today,
  yesterday: props.i18n.yesterdayLabel,
  thisWeek: props.i18n.thisWeekLabel,
  earlier: props.i18n.earlierLabel,
}))

interface DocGroup {
  label: string
  docs: RecentUpdatedDoc[]
}

const recentGroupedDocs = computed<DocGroup[]>(() => {
  const groups: Record<TimeGroup, RecentUpdatedDoc[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }
  for (const doc of props.docs) {
    groups[getTimeGroup(doc.updated)].push(doc)
  }
  const result: DocGroup[] = []
  for (const key of ['today', 'yesterday', 'thisWeek', 'earlier'] as TimeGroup[]) {
    if (groups[key].length > 0) {
      result.push({
        label: groupLabels.value[key],
        docs: groups[key],
      })
    }
  }
  return result
})

// 相对时间文案（走 i18n 占位符替换）
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

  const fill = (tpl: string, n: number) => String(tpl || "").replace("{n}", String(n))
  if (diffMin < 1) return props.i18n.justNow
  if (diffMin < 60) return fill(props.i18n.minutesAgo, diffMin)
  if (diffHour < 24) return fill(props.i18n.hoursAgo, diffHour)
  if (diffDay < 7) return fill(props.i18n.daysAgo, diffDay)
  if (diffDay < 30) return fill(props.i18n.weeksAgo, Math.floor(diffDay / 7))
  if (diffDay < 365) return fill(props.i18n.monthsAgo, Math.floor(diffDay / 30))
  return fill(props.i18n.yearsAgo, Math.floor(diffDay / 365))
}
</script>

<style lang="scss" scoped>
@use '../styles/DocChangeSection.scss';
@use '../styles/index.scss' as stats;
</style>
