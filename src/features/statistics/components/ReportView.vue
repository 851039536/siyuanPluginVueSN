<!-- 报告视图：年度/月度报告卡片 + 对比切换 + 明细条形图 -->
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
            {{ report.periodLabel }} 统计报告
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
            <span class="stat-icon"><IconWrapper
              name="edit"
              :size="16"
            /></span>
            <span class="stat-value">{{ formatNumber(report.totalWords) }}</span>
            <span class="stat-label">总字数</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="file"
              :size="16"
            /></span>
            <span class="stat-value">{{ formatNumber(report.totalNotesCreated) }}</span>
            <span class="stat-label">新增笔记</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="list"
              :size="16"
            /></span>
            <span class="stat-value">{{ report.avgDailyWords.toLocaleString() }}</span>
            <span class="stat-label">日均字数</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="star"
              :size="16"
            /></span>
            <span class="stat-value">{{ report.activeDays }}</span>
            <span class="stat-label">活跃天数</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="star"
              :size="16"
            /></span>
            <span class="stat-value">{{ report.longestStreak }}</span>
            <span class="stat-label">最长连续</span>
          </div>
          <div class="report-stat">
            <span class="stat-icon"><IconWrapper
              name="star"
              :size="16"
            /></span>
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
          <IconWrapper
            name="file"
            :size="14"
          /> 最高产笔记本：<strong>{{ report.mostProductiveNotebook.name }}</strong>
          （{{ formatNumber(report.mostProductiveNotebook.words) }} 字）
        </div>

        <div
          v-if="report.maxWordsDay.date"
          class="report-highlight"
        >
          最高产日：<strong>{{ report.maxWordsDay.date }}</strong>
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
                ></div>
              </div>
              <span class="breakdown-value">{{ item.words > 0 ? `${formatNumber(item.words)}字` : '' }}</span>
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
import IconWrapper from "@/components/IconWrapper.vue"
import { barPct, formatNumber } from "../utils"
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
@use "../styles/ReportView.scss";
</style>
