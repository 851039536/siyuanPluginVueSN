<template>
  <div class="report-view">
    <!-- Mode toggle -->
    <div class="report-mode-toggle">
      <button
        class="mode-btn"
        :class="[{ active: reportMode === 'single' }]"
        @click="reportMode = 'single'"
      >单期报告</button>
      <button
        class="mode-btn"
        :class="[{ active: reportMode === 'compare' }]"
        @click="reportMode = 'compare'"
      >对比分析</button>
    </div>

    <!-- Comparison view -->
    <ComparisonView
      v-if="reportMode === 'compare'"
      :on-get-comparison-data="onGetComparisonData"
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
              {{ y }}年
            </option>
          </select>
          <select
            v-model="reportMonth"
            class="report-select"
          >
            <option :value="0">
              全年报告
            </option>
            <option
              v-for="m in 12"
              :key="m"
              :value="m"
            >
              {{ m }}月
            </option>
          </select>
          <button
            class="report-generate-btn"
            @click="generate"
          >
            生成报告
          </button>
        </div>
      </div>

      <div
        v-if="reports.length === 0 && !loading"
        class="report-prompt"
      >
        选择年份/月份，点击"生成报告"
      </div>

      <div
        v-if="loading"
        class="report-loading"
      >
        生成中...
      </div>

      <div
        v-for="(report, ri) in reports"
        :key="ri"
        class="report-card"
      >
        <div class="report-card-header">
          <h3 class="report-title">
            📊 {{ report.periodLabel }} 统计报告
          </h3>
          <button
            class="report-close-btn"
            @click="removeReport(ri)"
          >
            ✕
          </button>
        </div>

        <div class="report-stats-grid">
          <div class="report-stat">
            <span class="stat-icon">✍️</span>
            <span class="stat-value">{{ formatNumber(report.totalWords) }}</span>
            <span class="stat-label">总字数</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon">📄</span>
            <span class="stat-value">{{ formatNumber(report.totalNotesCreated) }}</span>
            <span class="stat-label">新增笔记</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon">📅</span>
            <span class="stat-value">{{ report.avgDailyWords.toLocaleString() }}</span>
            <span class="stat-label">日均字数</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon">🔥</span>
            <span class="stat-value">{{ report.activeDays }}</span>
            <span class="stat-label">活跃天数</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon">💪</span>
            <span class="stat-value">{{ report.longestStreak }}</span>
            <span class="stat-label">最长连续</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon">🏆</span>
            <span class="stat-value">{{ formatNumber(report.maxWordsDay.words) }}</span>
            <span class="stat-label">最高单日</span>
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
          📓 最高产笔记本：<strong>{{ report.mostProductiveNotebook.name }}</strong>
          （{{ formatNumber(report.mostProductiveNotebook.words) }} 字）
        </div>

        <div
          v-if="report.maxWordsDay.date"
          class="report-highlight"
        >
          🚀 最高产日：<strong>{{ report.maxWordsDay.date }}</strong>
          （{{ formatNumber(report.maxWordsDay.words) }} 字）
        </div>

        <div
          v-if="report.monthlyBreakdown.length > 0"
          class="report-breakdown"
        >
          <h4 class="breakdown-title">
            各时段明细
          </h4>
          <div class="breakdown-list">
            <div
              v-for="item in report.monthlyBreakdown"
              :key="item.month"
              class="breakdown-row"
            >
              <span class="breakdown-month">{{ item.month }}</span>
              <div class="breakdown-bars">
                <div
                  class="breakdown-bar words"
                  :style="{ width: barPct(item.words, maxBreakWords) }"
                >
                  {{ item.words > 0 ? `${formatNumber(item.words)}字` : '' }}
                </div>
              </div>
              <span class="breakdown-created">{{ item.created > 0 ? `+${item.created}` : '' }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  ComparisonData,
  ReportData,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import { formatNumber } from "../utils"
import ComparisonView from "./ComparisonView.vue"

interface Props {
  onGetReportData?: (year?: number, month?: number) => Promise<ReportData>
  onGetComparisonData?: (yearA: number, monthA: number | undefined, yearB: number, monthB: number | undefined) => Promise<ComparisonData>
}

const props = defineProps<Props>()

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

const maxBreakWords = computed(() => {
  let max = 1
  for (const r of reports.value) {
    for (const item of r.monthlyBreakdown) {
      max = Math.max(max, item.words)
    }
  }
  return max
})

function barPct(val: number, max: number): string {
  return `${Math.max((val / max) * 100, 1)}%`
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
@use "../styles/index.scss" as stats;

.report-view {
  padding: 4px 0;
}

.report-mode-toggle {
  display: flex;
  gap: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 3px;
  width: fit-content;
  margin-bottom: 12px;
}

.mode-btn {
  padding: 4px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: var(--b3-theme-on-surface);
    background: var(--b3-list-hover);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-weight: 600;
  }
}

.report-controls {
  margin-bottom: 10px;
}

.report-selector {
  display: flex;
  gap: 6px;
  align-items: center;
}

.report-select {
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  outline: none;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.report-generate-btn {
  @include stats.small-action-btn;
  font-weight: 600;
}

.report-prompt,
.report-loading {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.report-card {
  @include stats.stats-card-base;
  padding: 12px;
  margin-bottom: 10px;
}

.report-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.report-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.report-close-btn {
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;

  &:hover {
    opacity: 0.8;
    background: var(--b3-list-hover);
  }
}

.report-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.report-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  background: var(--b3-theme-background);
  border-radius: 6px;
}

.stat-icon {
  font-size: 16px;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
}

.stat-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  margin-top: 1px;
}

.stat-sub {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  margin-top: 1px;
}

.report-highlight {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  padding: 6px 8px;
  background: rgba(var(--b3-theme-primary-rgb), 0.05);
  border-radius: 6px;
  margin-bottom: 6px;

  strong {
    color: var(--b3-theme-primary);
  }
}

.report-breakdown {
  margin-top: 8px;
}

.breakdown-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0 0 6px 0;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 200px;
  overflow-y: auto;
}

.breakdown-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.breakdown-month {
  width: 48px;
  flex-shrink: 0;
  text-align: right;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-size: 10px;
}

.breakdown-bars {
  flex: 1;
  height: 14px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.04);
  border-radius: 3px;
  overflow: hidden;
}

.breakdown-bar {
  height: 100%;
  border-radius: 3px;
  font-size: 9px;
  color: #fff;
  display: flex;
  align-items: center;
  padding-left: 4px;
  min-width: 4px;
  font-weight: 500;

  &.words {
    background: linear-gradient(90deg, var(--b3-theme-primary), var(--b3-theme-primary-light, #5d87ff));
  }
}

.breakdown-created {
  width: 28px;
  flex-shrink: 0;
  font-size: 10px;
  color: #22c55e;
  font-weight: 600;
}
</style>
