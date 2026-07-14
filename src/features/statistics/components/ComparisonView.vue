/**
 * ComparisonView — 期间对比视图
 * 选择两个时间段（年/月），对比统计指标（字数、笔记数、活跃天数等），
 * 展示差异表格和各时段明细柱状图。
 */
<template>
  <div class="comparison-view">
    <!-- Period selectors -->
    <div class="comparison-controls">
      <PeriodPicker
        v-model:year="yearA"
        v-model:month="monthA"
        label="A"
        :year-options="yearOptions"
      />
      <span class="vs-text">vs</span>
      <PeriodPicker
        v-model:year="yearB"
        v-model:month="monthB"
        label="B"
        :year-options="yearOptions"
      />
      <button
        class="compare-btn"
        @click="compare"
      >
        对比
      </button>
    </div>

    <div
      v-if="loading"
      class="compare-loading"
    >
      对比中...
    </div>

    <!-- Comparison result -->
    <div
      v-if="data"
      class="compare-result"
    >
      <!-- Metric table -->
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="col-metric">
                指标
              </th>
              <th class="col-value">
                {{ data.periodALabel }}
              </th>
              <th class="col-value">
                {{ data.periodBLabel }}
              </th>
              <th class="col-delta">
                变化
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in metrics"
              :key="m.key"
            >
              <td class="col-metric">
                {{ m.label }}
              </td>
              <td class="col-value">
                {{ m.format(data.a) }}
              </td>
              <td class="col-value">
                {{ m.format(data.b) }}
              </td>
              <td
                class="col-delta"
                :class="[deltaClass(m.key)]"
              >
                {{ deltaText(m.key) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Merged breakdown -->
      <div
        v-if="mergedBreakdown.length > 0"
        class="compare-breakdown"
      >
        <h4 class="breakdown-title">
          各时段明细对比
        </h4>
        <div class="breakdown-list">
          <div
            v-for="item in mergedBreakdown"
            :key="item.label"
            class="breakdown-row"
          >
            <span class="breakdown-label">{{ item.label }}</span>
            <div class="breakdown-bars-wrap">
              <div class="bar-row">
                <div class="bar-track">
                  <div
                    class="bar-fill bar-a"
                    :style="{ width: barPct(item.aWords, maxBreakVal) }"
                  ></div>
                </div>
                <span class="bar-value">{{ item.aWords > 0 ? fmtN(item.aWords) : '' }}</span>
              </div>
              <div class="bar-row">
                <div class="bar-track">
                  <div
                    class="bar-fill bar-b"
                    :style="{ width: barPct(item.bWords, maxBreakVal) }"
                  ></div>
                </div>
                <span class="bar-value">{{ item.bWords > 0 ? fmtN(item.bWords) : '' }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="breakdown-legend">
          <span class="legend-dot legend-a"></span>{{ data.periodALabel }}
          <span class="legend-dot legend-b"></span>{{ data.periodBLabel }}
        </div>
      </div>
    </div>

    <div
      v-else-if="!loading"
      class="compare-empty"
    >
      选择两个期间并点击"对比"
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComparisonData } from "../types"
import {
  computed,
  ref,
} from "vue"
import { barPct, formatNumber } from "../utils"
import PeriodPicker from "./PeriodPicker.vue"
import "../styles/comparison-view.scss"

interface Props {
  onGetComparisonData?: (yearA: number, monthA: number | undefined, yearB: number, monthB: number | undefined) => Promise<ComparisonData>
}

const props = defineProps<Props>()

const now = new Date()
const curYear = now.getFullYear()
const curMonth = now.getMonth() + 1

const yearA = ref(curYear)
const monthA = ref(curMonth === 1 ? 12 : curMonth - 1)
const yearB = ref(curYear)
const monthB = ref(curMonth)

const data = ref<ComparisonData | null>(null)
const loading = ref(false)

const yearOptions = computed(() => {
  const years = []
  for (let y = curYear; y >= curYear - 5; y--) years.push(y)
  return years
})

interface MetricDef {
  key: string
  label: string
  format: (r: ComparisonData['a']) => string
}

const metrics: MetricDef[] = [
  {
    key: 'totalWords',
    label: '总字数',
    format: (r) => formatNumber(r.totalWords),
  },
  {
    key: 'totalNotesCreated',
    label: '新增笔记',
    format: (r) => String(r.totalNotesCreated),
  },
  {
    key: 'avgDailyWords',
    label: '日均字数',
    format: (r) => r.avgDailyWords.toLocaleString(),
  },
  {
    key: 'activeDays',
    label: '活跃天数',
    format: (r) => String(r.activeDays),
  },
  {
    key: 'longestStreak',
    label: '最长连续',
    format: (r) => String(r.longestStreak),
  },
]

function deltaClass(key: string): string {
  const d = data.value?.deltas?.[key as keyof typeof data.value.deltas] ?? 0
  if (d > 0) return 'delta-up'
  if (d < 0) return 'delta-down'
  return 'delta-flat'
}

function deltaText(key: string): string {
  const d = data.value?.deltas?.[key as keyof typeof data.value.deltas] ?? 0
  if (d === 0) return '—'
  const sign = d > 0 ? '+' : ''
  const aVal = (data.value!.a as any)[key] as number
  const pct = aVal !== 0 ? Math.round((d / aVal) * 100) : 0
  return `${sign}${formatNumber(d)} (${sign}${pct}%)`
}

const mergedBreakdown = computed(() => {
  if (!data.value) return []
  const aItems = data.value.a.monthlyBreakdown
  const bItems = data.value.b.monthlyBreakdown
  const maxLen = Math.max(aItems.length, bItems.length)
  const result: Array<{ label: string, aWords: number, bWords: number }> = []
  for (let i = 0; i < maxLen; i++) {
    result.push({
      label: aItems[i]?.month || bItems[i]?.month || '',
      aWords: aItems[i]?.words || 0,
      bWords: bItems[i]?.words || 0,
    })
  }
  return result
})

const maxBreakVal = computed(() => {
  let max = 1
  for (const item of mergedBreakdown.value) {
    max = Math.max(max, item.aWords, item.bWords)
  }
  return max
})

function fmtN(n: number): string {
  return formatNumber(n)
}

async function compare() {
  if (!props.onGetComparisonData) return
  loading.value = true
  try {
    data.value = await props.onGetComparisonData(
      yearA.value,
      monthA.value || undefined,
      yearB.value,
      monthB.value || undefined,
    )
  } finally {
    loading.value = false
  }
}
</script>


