<!-- 文档变化统计区块：展示新增/修改文档列表、柱状图、最近更新 -->
<template>
  <div class="collapsible-section">
    <button
      class="collapse-header"
      @click="toggleExpanded"
    >
      <span class="collapse-icon">
        <IconWrapper
          :name="expanded ? 'chevronDown' : 'chevronRight'"
          :size="10"
        />
      </span>
      <span class="collapse-title">{{ `${i18n.docChanges || '文档变化'} — ${rangeLabel}` }}</span>
      <span
        v-if="badgeText"
        class="collapse-badge"
      >{{ badgeText }}</span>
    </button>
    <div
      v-if="expanded"
      class="collapse-body"
    >
      <!-- 范围选择按钮 -->
      <div class="changed-range-picker">
      <button
        v-for="r in dateRangeOptions"
        :key="r.value"
        class="changed-range-btn"
        :class="{ active: docRange === r.value }"
        @click="switchDocRange(r.value)"
      >
        {{ r.label }}
      </button>
    </div>

    <!-- ========== 最近更新模式 ========== -->
    <template v-if="docRange === 'recent'">
      <div
        v-if="recentDocsLoading"
        class="changed-docs-loading"
      >
        {{ i18n.loading || '加载中...' }}
      </div>

      <div
        v-else-if="recentDocs.length === 0"
        class="changed-docs-empty"
      >
        {{ i18n.noDocChanges || '暂无最近更新的文档' }}
      </div>

      <div
        v-else
        class="recent-docs-list"
      >
        <template
          v-for="group in recentGroupedDocs"
          :key="group.label"
        >
          <div class="recent-group-header">
            {{ group.label }}
          </div>
          <div
            v-for="doc in group.docs"
            :key="doc.id"
            class="recent-doc-item"
            :class="{ new: isDocCreatedToday(doc) }"
            @click="openDoc(doc.id)"
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
            <span class="recent-doc-title">{{ doc.title || '无标题' }}</span>
            <span class="recent-doc-time">{{ formatRelativeTime(doc.updated) }}</span>
          </div>
        </template>
      </div>
    </template>

    <!-- ========== 范围模式：柱状图 ========== -->
    <template v-else>
      <div
        v-if="docRange !== 'today' && rangeStats.length > 0"
        class="range-chart-section"
      >
        <div class="range-chart-bar-group">
          <div class="range-chart-legend">
            <span class="legend-dot new"></span>{{ i18n.todayCreated || '新增' }}
            <span class="legend-dot modified"></span>{{ i18n.todayModified || '修改' }}
          </div>
          <div
            v-for="item in sortByDate(rangeStats)"
            :key="item.date"
            class="range-chart-row"
            :class="{ active: selectedChartDate === item.date }"
            @click="drillIntoDate(item.date)"
          >
            <span class="range-chart-label">{{ formatChartDate(item.date) }}</span>
            <div class="range-chart-bars">
              <div
                v-if="item.newCount > 0"
                class="range-chart-bar new"
                :style="{ width: barWidth(item.newCount) }"
              >
                {{ item.newCount }}
              </div>
              <div
                v-if="item.modifiedCount > 0"
                class="range-chart-bar modified"
                :style="{ width: barWidth(item.modifiedCount) }"
              >
                {{ item.modifiedCount }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 单日详情（date 模式钻取 或 today 模式） -->
      <div v-if="selectedChartDate || docRange === 'today'">
        <div
          v-if="docRange === 'today'"
          class="changed-date-picker"
        >
          <input
            type="date"
            :value="docChangeDate"
            :max="todayDateStr"
            class="changed-date-input"
            @change="onDocDateChange"
          >
          <button
            class="changed-date-today"
            :class="{ active: docChangeDate === todayDateStr }"
            @click="setDocDateToday"
          >
            {{ i18n.today || '今天' }}
          </button>
        </div>

        <div
          v-if="changedDocsLoading"
          class="changed-docs-loading"
        >
          {{ i18n.loading || '加载中...' }}
        </div>

        <div
          v-else-if="changedDocs.newDocs.length > 0 || changedDocs.modifiedDocs.length > 0 || deletedDocs.length > 0"
          class="changed-docs-content"
        >
          <div
            v-if="changedDocs.newDocs.length > 0"
            class="changed-docs-group"
          >
            <div class="changed-docs-group-title">
              <IconWrapper
                name="success"
                :size="12"
              /> {{ i18n.todayCreated || '新增' }}（{{ changedDocs.newDocs.length }}）
            </div>
            <div
              v-for="doc in changedDocs.newDocs"
              :key="doc.id"
              class="changed-doc-item new"
              title="点击打开文档"
              @click="openDoc(doc.id)"
            >
              <span class="changed-doc-icon">
                <IconWrapper
                  name="plus"
                  :size="11"
                />
              </span>
              <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
              <span
                v-if="doc.time"
                class="changed-doc-time"
              >{{ doc.time }}</span>
            </div>
          </div>
          <div
            v-if="changedDocs.modifiedDocs.length > 0"
            class="changed-docs-group"
          >
            <div class="changed-docs-group-title">
              <IconWrapper
                name="edit"
                :size="12"
              /> {{ i18n.todayModified || '修改' }}（{{ changedDocs.modifiedDocs.length }}）
            </div>
            <div
              v-for="doc in changedDocs.modifiedDocs"
              :key="doc.id"
              class="changed-doc-item modified"
              title="点击打开文档"
              @click="openDoc(doc.id)"
            >
              <span class="changed-doc-icon">
                <IconWrapper
                  name="edit"
                  :size="11"
                />
              </span>
              <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
              <span
                v-if="doc.time"
                class="changed-doc-time"
              >{{ doc.time }}</span>
            </div>
          </div>
          <div
            v-if="deletedDocs.length > 0"
            class="changed-docs-group"
          >
            <div class="changed-docs-group-title">
              <IconWrapper
                name="delete"
                :size="12"
              /> {{ i18n.deletedTitle || '删除' }}（{{ deletedDocs.length }}）
            </div>
            <div
              v-for="(doc, idx) in deletedDocs"
              :key="idx"
              class="changed-doc-item deleted"
            >
              <span class="changed-doc-icon">
                <IconWrapper
                  name="delete"
                  :size="11"
                />
              </span>
              <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
              <span
                v-if="doc.time"
                class="changed-doc-time"
              >{{ doc.time }}</span>
            </div>
          </div>
        </div>
        <div
          v-else
          class="changed-docs-empty"
        >
          {{ i18n.noDocChanges || '当天无新增或修改' }}
        </div>
      </div>

      <!-- 范围模式下无数据 -->
      <div
        v-if="docRange !== 'today' && !selectedChartDate && rangeStats.length === 0"
        class="changed-docs-empty"
      >
        {{ rangeStatsLoading ? (i18n.loading || '加载中...') : (i18n.noDocChanges || '该范围无变更') }}
      </div>
    </template>

    <!-- 范围/最近模式：删除记录（数据历史） -->
    <div
      v-if="!selectedChartDate && rangeDeletedDocs.length > 0"
      class="changed-docs-group range-deleted-group"
    >
      <div class="changed-docs-group-title">
        <IconWrapper
          name="delete"
          :size="12"
        /> {{ i18n.deletedTitle || '删除' }}（{{ rangeDeletedDocs.length }}）
      </div>
      <div class="range-deleted-list">
        <div
          v-for="(doc, idx) in rangeDeletedDocs"
          :key="idx"
          class="changed-doc-item deleted"
        >
          <span class="changed-doc-icon">
            <IconWrapper
              name="delete"
              :size="11"
            />
          </span>
          <span
            v-if="doc.date"
            class="range-deleted-date"
          >{{ doc.date }}</span>
          <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
          <span
            v-if="doc.time"
            class="changed-doc-time"
          >{{ doc.time }}</span>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  ChangedDoc,
  DeletedDoc,
  RangeStatItem,
  RecentUpdatedDoc,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatYmd } from "../utils"
interface Props {
  onGetDateChangedDocs?: (dateStr: string) => Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }>
  onGetDateRangeChangeStats?: (startStr: string, endStr: string) => Promise<RangeStatItem[]>
  onGetRecentUpdatedDocs?: (limit: number) => Promise<RecentUpdatedDoc[]>
  onGetDeletedDocs?: (dateStr: string) => Promise<DeletedDoc[]>
  onGetDeletedDocsInRange?: (startStr: string, endStr: string) => Promise<DeletedDoc[]>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const expanded = ref(true)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function openDoc(docId: string) {
  if (docId) {
    window.open(`siyuan://blocks/${docId}`)
  }
}

function getTodayStr(): string {
  return formatYmd(new Date())
}

const docChangeDate = ref(getTodayStr())
const changedDocs = ref<{ newDocs: ChangedDoc[], modifiedDocs: ChangedDoc[] }>({
  newDocs: [],
  modifiedDocs: [],
})
const changedDocsLoading = ref(false)
const deletedDocs = ref<DeletedDoc[]>([])
const rangeDeletedDocs = ref<DeletedDoc[]>([])

type DocRangeType = 'today' | '3d' | '7d' | '1m' | '6m' | 'recent'
const docRange = ref<DocRangeType>('today')
const dateRangeOptions = computed<Array<{ value: DocRangeType, label: string }>>(() => [
  {
    value: 'today',
    label: props.i18n.today || '今天',
  },
  {
    value: '3d',
    label: props.i18n.days3 || '近3天',
  },
  {
    value: '7d',
    label: props.i18n.days7 || '近7天',
  },
  {
    value: '1m',
    label: props.i18n.oneMonth || '近1月',
  },
  {
    value: '6m',
    label: props.i18n.halfYear || '近半年',
  },
  {
    value: 'recent',
    label: props.i18n.recentUpdated || '最近更新',
  },
])

const rangeStats = ref<RangeStatItem[]>([])
const rangeStatsLoading = ref(false)
const selectedChartDate = ref<string | null>(null)

// ---- 最近更新模式 ----
const recentDocs = ref<RecentUpdatedDoc[]>([])
const recentDocsLoading = ref(false)

function isDocCreatedToday(doc: RecentUpdatedDoc): boolean {
  return doc.created.substring(0, 8) === getTodayStr()
}

type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'earlier'

function getYesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatYmd(d)
}

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

const recentGroupedDocs = computed<DocGroup[]>(() => {
  const groups: Record<TimeGroup, RecentUpdatedDoc[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  }
  for (const doc of recentDocs.value) {
    groups[getTimeGroup(doc.updated)].push(doc)
  }
  const result: DocGroup[] = []
  for (const key of ['today', 'yesterday', 'thisWeek', 'earlier'] as TimeGroup[]) {
    if (groups[key].length > 0) {
      result.push({
        label: groupLabels[key],
        docs: groups[key],
      })
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

// ---- 现有逻辑 ----

const todayDateStr = computed(() => getTodayStr())

const rangeLabel = computed(() => {
  if (docRange.value === 'recent') return dateRangeOptions.value.find((r) => r.value === 'recent')?.label || ''
  if (docRange.value === 'today') return formattedDocDate.value
  return dateRangeOptions.value.find((r) => r.value === docRange.value)?.label || ''
})

const rangeTotalChanges = computed(() =>
  rangeStats.value.reduce((s, i) => s + i.newCount + i.modifiedCount, 0),
)

const badgeText = computed(() => {
  if (docRange.value === 'recent') return recentDocs.value.length > 0 ? `${recentDocs.value.length}` : ''
  if (docRange.value !== 'today' && rangeStats.value.length > 0) return `${rangeTotalChanges.value}`
  if (docRange.value === 'today' && changedDocsCount.value > 0) return `${changedDocsCount.value}`
  return ''
})

const formattedDocDate = computed(() => {
  const d = docChangeDate.value
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`
})

const changedDocsCount = computed(() =>
  changedDocs.value.newDocs.length + changedDocs.value.modifiedDocs.length,
)

const maxBarCount = computed(() => {
  let max = 1
  for (const item of rangeStats.value) {
    max = Math.max(max, item.newCount, item.modifiedCount)
  }
  return max
})

function formatChartDate(dateStr: string): string {
  return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`
}

function barWidth(count: number): string {
  return `${Math.max((count / maxBarCount.value) * 100, 4)}%`
}

function sortByDate(items: RangeStatItem[]) {
  return [...items].sort((a, b) => a.date.localeCompare(b.date))
}

async function switchDocRange(range: DocRangeType) {
  docRange.value = range
  selectedChartDate.value = null
  changedDocs.value = {
    newDocs: [],
    modifiedDocs: [],
  }
  deletedDocs.value = []
  rangeDeletedDocs.value = []

  if (range === 'recent') {
    await loadRecentDocs()
    // 最近更新：展示最近 30 天的删除记录
    const recentStart = new Date()
    recentStart.setDate(recentStart.getDate() - 29)
    await loadRangeDeletedDocs(formatYmd(recentStart), getTodayStr())
    return
  }

  if (range === 'today') {
    loadDateChangedDocs(docChangeDate.value)
    return
  }

  const today = new Date()
  const start = new Date(today)
  const endStr = getTodayStr()

  switch (range) {
    case '3d': start.setDate(today.getDate() - 2); break
    case '7d': start.setDate(today.getDate() - 6); break
    case '1m': start.setMonth(today.getMonth() - 1); break
    case '6m': start.setMonth(today.getMonth() - 6); break
  }
  const startStr = formatYmd(start)

  rangeStatsLoading.value = true
  try {
    rangeStats.value = props.onGetDateRangeChangeStats
      ? await props.onGetDateRangeChangeStats(startStr, endStr)
      : []
  } catch (e) {
    console.error("加载范围统计失败:", e)
  } finally {
    rangeStatsLoading.value = false
  }

  await loadRangeDeletedDocs(startStr, endStr)
}

async function loadRecentDocs() {
  if (!props.onGetRecentUpdatedDocs) return
  recentDocsLoading.value = true
  try {
    recentDocs.value = await props.onGetRecentUpdatedDocs(20)
  } catch (e) {
    console.error("加载最近更新文档失败:", e)
    recentDocs.value = []
  } finally {
    recentDocsLoading.value = false
  }
}

async function loadRangeDeletedDocs(startStr: string, endStr: string) {
  if (!props.onGetDeletedDocsInRange) {
    rangeDeletedDocs.value = []
    return
  }
  try {
    rangeDeletedDocs.value = await props.onGetDeletedDocsInRange(startStr, endStr)
  } catch (e) {
    console.error("加载范围删除文档失败:", e)
    rangeDeletedDocs.value = []
  }
}

async function drillIntoDate(dateStr: string) {
  selectedChartDate.value = dateStr
  await loadDateChangedDocs(dateStr)
}

async function loadDateChangedDocs(dateStr: string) {
  if (!props.onGetDateChangedDocs) return
  changedDocsLoading.value = true
  try {
    changedDocs.value = await props.onGetDateChangedDocs(dateStr)
    deletedDocs.value = (await props.onGetDeletedDocs?.(dateStr)) ?? []
  } catch (error) {
    console.error("加载文档变化失败:", error)
    changedDocs.value = {
      newDocs: [],
      modifiedDocs: [],
    }
    deletedDocs.value = []
  } finally {
    changedDocsLoading.value = false
  }
}

function onDocDateChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.value) return
  docChangeDate.value = input.value.replace(/-/g, "")
  loadDateChangedDocs(docChangeDate.value)
}

function setDocDateToday() {
  docChangeDate.value = getTodayStr()
  loadDateChangedDocs(docChangeDate.value)
}
</script>

<style lang="scss" scoped>
@use '../styles/DocChangeSection.scss';
@use '../styles/index.scss' as stats;
</style>
