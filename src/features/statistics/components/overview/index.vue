<!-- 概览 Tab 入口容器：编排核心指标卡、文档变化、视图模式与图表区块 -->
<template>
  <div class="overview-tab">
    <!-- 核心指标横幅（常驻） -->
    <StatsCardsCompact
      :total-notes="stats?.totalNotes ?? 0"
      :total-words="stats?.totalWords ?? 0"
      :total-blocks="stats?.totalBlocks ?? 0"
      :total-assets="stats?.totalAssets ?? 0"
      :total-images="stats?.totalImages ?? 0"
      :total-tags="stats?.totalTags ?? 0"
      :total-backlinks="stats?.totalBacklinks ?? 0"
      :today-created="stats?.todayCreated ?? 0"
      :today-modified="stats?.todayModified ?? 0"
      :avg-words-per-doc="stats?.avgWordsPerDoc ?? 0"
      :created-change="changes?.createdChange ?? null"
      :modified-change="changes?.modifiedChange ?? null"
      :notes-change="changes?.notesChange ?? null"
      :words-change="changes?.wordsChange ?? null"
      :i18n="i18n"
    />

    <!-- 文档变化详情（日期范围 + 柱状图 + 详情列表 + 最近更新） -->
    <DocChangeSection
      class="doc-change-section"
      :on-get-date-changed-docs="queries?.getDateChangedDocs"
      :on-get-date-range-change-stats="queries?.getDateRangeChangeStats"
      :on-get-recent-updated-docs="queries?.getRecentUpdatedDocs"
      :on-get-deleted-docs="queries?.getDeletedDocs"
      :on-get-deleted-docs-in-range="queries?.getDeletedDocsInRange"
      :i18n="i18n"
    />

    <!-- 视图模式切换 + 时段统计 + 图表 -->
    <ViewModeSection
      :model-value="modelValue"
      :day-range="dayRange"
      :month-year-range="monthYearRange"
      :selected-year="selectedYear"
      :period-avg-words="periodAvgWords"
      :period-total-words="stats?.periodTotalWords ?? 0"
      :i18n="i18n"
      @update:modelValue="emit('update:modelValue', $event)"
      @update:dayRange="emit('update:dayRange', $event)"
      @update:monthYearRange="emit('update:monthYearRange', $event)"
      @update:selectedYear="emit('update:selectedYear', $event)"
    />

    <div class="chart-section">
      <h3 class="section-title">
        {{ chartTitle }}
      </h3>
      <BarChart
        :title="chartTitle"
        :chart-data="stats?.dailyStats ?? []"
        :i18n="i18n"
      />

      <WordRanking
        :chart-data="stats?.dailyStats ?? []"
        :i18n="i18n"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// 概览 Tab 入口容器：接收主面板下放的核心统计数据，编排概览区块
import {
  computed,
} from "vue"
import type {
  ChangedDoc,
  DeletedDoc,
  RangeStatItem,
  RecentUpdatedDoc,
  StatisticsData,
} from "../../types"
import BarChart from "./BarChart.vue"
import DocChangeSection from "./DocChangeSection.vue"
import StatsCardsCompact from "./StatsCardsCompact.vue"
import ViewModeSection from "./ViewModeSection.vue"
import WordRanking from "./WordRanking.vue"

interface Changes {
  createdChange: number | null
  modifiedChange: number | null
  notesChange: number | null
  wordsChange: number | null
}

interface OverviewQueries {
  getDateChangedDocs: (dateStr: string) => Promise<{
    newDocs: ChangedDoc[]
    modifiedDocs: ChangedDoc[]
  }>
  getDateRangeChangeStats: (startStr: string, endStr: string) => Promise<RangeStatItem[]>
  getRecentUpdatedDocs: (limit: number) => Promise<RecentUpdatedDoc[]>
  getDeletedDocs: (dateStr: string) => Promise<DeletedDoc[]>
  getDeletedDocsInRange: (startStr: string, endStr: string) => Promise<DeletedDoc[]>
}

interface Props {
  stats?: StatisticsData | null
  changes?: Changes
  modelValue?: "day" | "week" | "month" | "year"
  dayRange?: 7 | 15 | 30 | 90 | 180 | 365
  monthYearRange?: 1 | 2 | 3
  selectedYear?: number
  periodAvgWords?: number
  queries?: OverviewQueries
  i18n?: Record<string, any>
}

interface Emits {
  (e: "update:modelValue", value: "day" | "week" | "month" | "year"): void
  (e: "update:dayRange", value: 7 | 15 | 30 | 90 | 180 | 365): void
  (e: "update:monthYearRange", value: 1 | 2 | 3): void
  (e: "update:selectedYear", value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  stats: null,
  modelValue: "day",
  dayRange: 7,
  monthYearRange: 1,
  selectedYear: new Date().getFullYear(),
  periodAvgWords: 0,
  i18n: () => ({}),
})

const emit = defineEmits<Emits>()

const i18n = computed(() => props.i18n || {})

// 图表标题：查询层返回周期 i18n 键，此处映射为文案（年视图带年份占位符）
const chartTitle = computed(() => {
  const key = props.stats?.currentPeriod
  if (!key) return ""
  if (key === "periodYears") {
    return String(i18n.value.periodYears || "")
      .replace("{start}", String(props.selectedYear - 4))
      .replace("{end}", String(props.selectedYear))
  }
  return i18n.value[key] || ""
})
</script>

<style scoped lang="scss">
@use '../../styles/index.scss' as stats;
</style>
