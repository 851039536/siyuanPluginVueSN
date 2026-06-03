<template>
  <CollapsibleSection
    :title="`📋 ${i18n.docChanges || '文档变化'} — ${rangeLabel}`"
    :default-expanded="true"
    :badge="docRange !== 'today' && rangeStats.length > 0 ? `${rangeTotalChanges}` : changedDocsCount > 0 ? `${changedDocsCount}` : ''"
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

    <!-- 范围模式：柱状图 -->
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
        v-else-if="changedDocs.newDocs.length > 0 || changedDocs.modifiedDocs.length > 0"
        class="changed-docs-content"
      >
        <div
          v-if="changedDocs.newDocs.length > 0"
          class="changed-docs-group"
        >
          <div class="changed-docs-group-title">
            🆕 {{ i18n.todayCreated || '新增' }}（{{ changedDocs.newDocs.length }}）
          </div>
          <div
            v-for="doc in changedDocs.newDocs"
            :key="doc.id"
            class="changed-doc-item new"
            title="点击打开文档"
            @click="openDoc(doc.id)"
          >
            <span class="changed-doc-icon">+</span>
            <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
          </div>
        </div>
        <div
          v-if="changedDocs.modifiedDocs.length > 0"
          class="changed-docs-group"
        >
          <div class="changed-docs-group-title">
            ✏️ {{ i18n.todayModified || '修改' }}（{{ changedDocs.modifiedDocs.length }}）
          </div>
          <div
            v-for="doc in changedDocs.modifiedDocs"
            :key="doc.id"
            class="changed-doc-item modified"
            title="点击打开文档"
            @click="openDoc(doc.id)"
          >
            <span class="changed-doc-icon">~</span>
            <span class="changed-doc-title">{{ doc.title || '无标题' }}</span>
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

    <!-- 范围模式下无数据 或 尚未选择 -->
    <div
      v-if="docRange !== 'today' && !selectedChartDate && rangeStats.length === 0"
      class="changed-docs-empty"
    >
      {{ rangeStatsLoading ? (i18n.loading || '加载中...') : (i18n.noDocChanges || '该范围无变更') }}
    </div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
import type {
  ChangedDoc,
  RangeStatItem,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import { padZero } from "../utils"
import CollapsibleSection from "./CollapsibleSection.vue"

interface Props {
  onGetDateChangedDocs?: (dateStr: string) => Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }>
  onGetDateRangeChangeStats?: (startStr: string, endStr: string) => Promise<RangeStatItem[]>
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

function openDoc(docId: string) {
  if (docId) {
    window.open(`siyuan://blocks/${docId}`)
  }
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`
}

const docChangeDate = ref(getTodayStr())
const changedDocs = ref<{ newDocs: ChangedDoc[], modifiedDocs: ChangedDoc[] }>({
  newDocs: [],
  modifiedDocs: [],
})
const changedDocsLoading = ref(false)

type DocRangeType = 'today' | '3d' | '7d' | '1m' | '6m'
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
])

const rangeStats = ref<RangeStatItem[]>([])
const rangeStatsLoading = ref(false)
const selectedChartDate = ref<string | null>(null)

const todayDateStr = computed(() => getTodayStr())

const rangeLabel = computed(() => {
  if (docRange.value === 'today') return formattedDocDate.value
  return dateRangeOptions.value.find((r) => r.value === docRange.value)?.label || ''
})

const rangeTotalChanges = computed(() =>
  rangeStats.value.reduce((s, i) => s + i.newCount + i.modifiedCount, 0),
)

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
  const startStr = `${start.getFullYear()}${padZero(start.getMonth() + 1)}${padZero(start.getDate())}`

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
}

async function drillIntoDate(dateStr: string) {
  if (!props.onGetDateChangedDocs) return
  selectedChartDate.value = dateStr
  changedDocsLoading.value = true
  try {
    changedDocs.value = await props.onGetDateChangedDocs(dateStr)
  } finally {
    changedDocsLoading.value = false
  }
}

async function loadDateChangedDocs(dateStr: string) {
  if (!props.onGetDateChangedDocs) return
  changedDocsLoading.value = true
  try {
    changedDocs.value = await props.onGetDateChangedDocs(dateStr)
  } catch (error) {
    console.error("加载文档变化失败:", error)
    changedDocs.value = {
      newDocs: [],
      modifiedDocs: [],
    }
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

<style scoped lang="scss">
@use "../styles/index.scss" as stats;

.changed-range-picker {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.changed-range-btn {
  @include stats.small-action-btn;
}

.range-chart-section {
  margin-bottom: 8px;
}

.range-chart-bar-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.range-chart-legend {
  display: flex;
  gap: 12px;
  padding: 2px 4px 6px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 4px;
  margin-right: 3px;
  vertical-align: middle;

  &.new { background: stats.$color-success; }
  &.modified { background: stats.$color-warning; }
}

.range-chart-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  &.active {
    background: var(--b3-theme-primary-lightest, rgba(59, 130, 246, 0.08));
  }
}

.range-chart-label {
  width: 32px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  flex-shrink: 0;
  text-align: right;
}

.range-chart-bars {
  flex: 1;
  display: flex;
  gap: 2px;
  align-items: center;
  height: 18px;
}

.range-chart-bar {
  height: 16px;
  border-radius: 4px;
  font-size: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  padding-left: 4px;
  min-width: 20px;
  font-weight: 600;

  &.new { background: stats.$color-success; }
  &.modified { background: stats.$color-warning; }
}

.changed-date-picker {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.changed-date-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.changed-date-today {
  @include stats.small-action-btn;
  white-space: nowrap;
  padding: 4px 12px;
}

.changed-docs-loading {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.changed-docs-empty {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.changed-docs-content {
  max-height: 240px;
  overflow-y: auto;
}

.changed-docs-group {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.changed-docs-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
  padding: 0 4px;
}

.changed-doc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  transition: background 0.15s;

  &:hover {
    background: var(--b3-list-hover);
  }

  .changed-doc-icon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }

  &.new .changed-doc-icon {
    background: rgba(stats.$color-success, 0.15);
    color: stats.$color-success;
  }

  &.modified .changed-doc-icon {
    background: rgba(stats.$color-warning, 0.15);
    color: stats.$color-warning;
  }

  .changed-doc-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
