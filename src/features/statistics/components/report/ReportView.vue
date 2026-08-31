<!-- 报告视图：年度/月度报告卡片 + 对比切换 + 明细条形图 -->
<template>
  <div class="report-view">
    <!-- Mode toggle -->
    <div class="report-mode-toggle">
      <button
        class="mode-btn"
        :class="[{ active: reportMode === 'single' }]"
        @click="reportMode = 'single'"
      >
        <!-- 模式按钮："单期报告" -->
        {{ i18n.reportSingleMode }}
      </button>
      <button
        class="mode-btn"
        :class="[{ active: reportMode === 'compare' }]"
        @click="reportMode = 'compare'"
      >
        <!-- 模式按钮："对比分析" -->
        {{ i18n.reportCompareMode }}
      </button>
    </div>

    <!-- Comparison view -->
    <ComparisonView
      v-if="reportMode === 'compare'"
      :on-get-comparison-data="onGetComparisonData"
      :i18n="i18n"
    />

    <!-- Single report view -->
    <template v-else>
      <div class="report-controls">
        <div class="report-selector">
          <select
            v-model="reportYear"
            class="report-select"
          >
            <option
              v-for="y in yearOptions"
              :key="y"
              :value="y"
            >
              {{ yearText(y) }}
            </option>
          </select>
          <select
            v-model="reportMonth"
            class="report-select"
          >
            <option :value="0">
              <!-- 月份选项："全年报告" -->
              {{ i18n.fullYearReport }}
            </option>
            <option
              v-for="m in 12"
              :key="m"
              :value="m"
            >
              {{ monthText(m) }}
            </option>
          </select>
          <button
            class="report-generate-btn"
            @click="generate"
          >
            <!-- 按钮："生成报告" -->
            {{ i18n.generateReport }}
          </button>
        </div>
      </div>

      <div
        v-if="reports.length === 0 && !loading"
        class="report-prompt"
      >
        <!-- 空态提示："选择年份/月份，点击"生成报告"" -->
        {{ i18n.reportPrompt }}
      </div>

      <div
        v-if="loading"
        class="report-loading"
      >
        <!-- 加载提示："生成中..." -->
        {{ i18n.generating }}
      </div>

      <div
        v-for="(report, ri) in reports"
        :key="ri"
        class="report-card"
      >
        <div class="report-card-header">
          <h3 class="report-title">
            <!-- 报告标题："2024年 统计报告" -->
            {{ reportTitle(report) }}
          </h3>
          <button
            class="report-close-btn"
            @click="removeReport(ri)"
          >
            <IconWrapper
              name="close"
              :size="14"
            />
          </button>
        </div>

        <div class="report-stats-grid">
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="edit"
              :size="16"
            /></span>
            <span class="stat-value">{{ formatNumber(report.totalWords) }}</span>
            <!-- 指标标签："总字数" -->
            <span class="stat-label">{{ i18n.totalWords }}</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="file"
              :size="16"
            /></span>
            <span class="stat-value">{{ formatNumber(report.totalNotesCreated) }}</span>
            <!-- 指标标签："新增笔记" -->
            <span class="stat-label">{{ i18n.notesCreated }}</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="chartLine"
              :size="16"
            /></span>
            <span class="stat-value">{{ report.avgDailyWords.toLocaleString() }}</span>
            <!-- 指标标签："日均字数" -->
            <span class="stat-label">{{ i18n.dailyAvgWords }}</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="calendarCheck"
              :size="16"
            /></span>
            <span class="stat-value">{{ report.activeDays }}</span>
            <!-- 指标标签："活跃天数" -->
            <span class="stat-label">{{ i18n.activeDaysLabel }}</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="fire"
              :size="16"
            /></span>
            <span class="stat-value">{{ report.longestStreak }}</span>
            <!-- 指标标签："最长连续" -->
            <span class="stat-label">{{ i18n.longestStreak }}</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="trophy"
              :size="16"
            /></span>
            <span class="stat-value">{{ formatNumber(report.maxWordsDay.words) }}</span>
            <!-- 指标标签："最高单日" -->
            <span class="stat-label">{{ i18n.maxWordsDayLabel }}</span>
            <template v-if="report.maxWordsDay.words">
              <span
                class="stat-sub"
              >{{ report.maxWordsDay.date }}</span>
            </template>
          </div>
        </div>

        <div
          v-if="report.mostProductiveNotebook.name"
          class="report-highlight"
        >
          <IconWrapper
            name="file"
            :size="14"
          />
          <!-- 亮点提示："最高产笔记本：xxx（n 字）" -->
          {{ nbHint(report) }}
        </div>

        <div
          v-if="report.maxWordsDay.date"
          class="report-highlight"
        >
          <!-- 亮点提示："最高产日：xxxx-xx-xx（n 字）" -->
          {{ maxDayHint(report) }}
        </div>

        <div
          v-if="report.monthlyBreakdown.length > 0"
          class="report-breakdown"
        >
          <h4 class="breakdown-title">
            <!-- 区块标题："各时段明细" -->
            {{ i18n.reportBreakdownTitle }}
          </h4>
          <!-- 各子时段字数以单序列面积折线呈现，峰值高亮，新增数走悬浮提示 -->
          <ReportTrendChart
            :points="report.monthlyBreakdown"
            :i18n-words-unit="i18n.wordsUnit"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  ComparisonData,
  ReportData,
} from "../../types"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatNumber,
  formatReportPeriod,
} from "../../utils"
import ReportTrendChart from "./ReportTrendChart.vue"
import ComparisonView from "./ComparisonView.vue"

interface Props {
  onGetReportData?: (year?: number, month?: number) => Promise<ReportData>
  onGetComparisonData?: (yearA: number, monthA: number | undefined, yearB: number, monthB: number | undefined) => Promise<ComparisonData>
  i18n?: Record<string, any>
}

const props = defineProps<Props>()

const i18n = computed(() => props.i18n || {})

/** 年份选项文案（{year} 占位符模板） */
function yearText(y: number): string {
  return String(i18n.value.yearLabel ?? "").replace("{year}", String(y))
}

/** 月份选项文案（{m} 占位符模板） */
function monthText(m: number): string {
  return String(i18n.value.reportMonthOption ?? "").replace("{m}", String(m))
}

/** 报告卡片标题：本地化期间 + 「统计报告」模板 */
function reportTitle(report: ReportData): string {
  const label = formatReportPeriod(report.period, i18n.value)
  return String(i18n.value.reportCardTitle ?? "").replace("{label}", label)
}

/** 最高产笔记本提示（模板含 {name}/{words} 占位符） */
function nbHint(report: ReportData): string {
  return String(i18n.value.mostProductiveNbHint ?? "")
    .replace("{name}", report.mostProductiveNotebook.name)
    .replace("{words}", formatNumber(report.mostProductiveNotebook.words))
}

/** 最高产日提示（模板含 {date}/{words} 占位符） */
function maxDayHint(report: ReportData): string {
  return String(i18n.value.maxDayHint ?? "")
    .replace("{date}", report.maxWordsDay.date)
    .replace("{words}", formatNumber(report.maxWordsDay.words))
}

const now = new Date()
const reportMode = ref<'single' | 'compare'>('single')
const reportYear = ref(now.getFullYear())
const reportMonth = ref(0)
const loading = ref(false)
const reports = ref<ReportData[]>([])

const yearOptions = computed(() => {
  const currentYear = now.getFullYear()
  const years = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y)
  }
  return years
})

function removeReport(idx: number) {
  reports.value.splice(idx, 1)
}

async function generate() {
  if (!props.onGetReportData) return
  loading.value = true
  try {
    const data = await props.onGetReportData(
      reportYear.value,
      reportMonth.value || undefined,
    )
    reports.value.unshift(data)
    if (reports.value.length > 3) {
      reports.value.splice(3)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../../styles/ReportView.scss";
@use '../../styles/index.scss' as stats;
</style>
