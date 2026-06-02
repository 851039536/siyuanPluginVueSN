<template>
  <div class="comparison-view">
    <!-- Period selectors -->
    <div class="comparison-controls">
      <div class="period-picker">
        <span class="period-label">A</span>
        <select
          v-model="yearA"
          class="period-select"
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
          v-model="monthA"
          class="period-select"
        >
          <option :value="0">
            全年
          </option>
          <option
            v-for="m in 12"
            :key="m"
            :value="m"
          >
            {{ m }}月
          </option>
        </select>
      </div>
      <span class="vs-text">vs</span>
      <div class="period-picker">
        <span class="period-label">B</span>
        <select
          v-model="yearB"
          class="period-select"
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
          v-model="monthB"
          class="period-select"
        >
          <option :value="0">
            全年
          </option>
          <option
            v-for="m in 12"
            :key="m"
            :value="m"
          >
            {{ m }}月
          </option>
        </select>
      </div>
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
                <div
                  class="bar-fill bar-a"
                  :style="{ width: barPct(item.aWords, maxBreakVal) }"
                >{{ item.aWords > 0 ? fmtN(item.aWords) : '' }}</div>
              </div>
              <div class="bar-row">
                <div
                  class="bar-fill bar-b"
                  :style="{ width: barPct(item.bWords, maxBreakVal) }"
                >{{ item.bWords > 0 ? fmtN(item.bWords) : '' }}</div>
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
  </div>
</template>

<script setup lang="ts">
import type { ComparisonData } from "../types"
import {
  computed,
  ref,
} from "vue"
import { formatNumber } from "../utils"

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

function barPct(val: number, max: number): string {
  return `${Math.max((val / max) * 100, 1)}%`
}

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

<style scoped lang="scss">
.comparison-view {
  padding: 4px 0;
}

.comparison-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.period-picker {
  display: flex;
  gap: 4px;
  align-items: center;
}

.period-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  width: 14px;
}

.period-select {
  padding: 4px 6px;
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

.vs-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.5;
}

.compare-btn {
  padding: 4px 14px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
}

.compare-loading {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.compare-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compare-table-wrap {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  overflow: hidden;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    padding: 8px 10px;
    text-align: right;

    &.col-metric {
      text-align: left;
    }
  }

  th {
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface-light);
    font-weight: 600;
    font-size: 11px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  td {
    border-bottom: 1px solid rgba(var(--b3-theme-on-surface-rgb), 0.04);
    color: var(--b3-theme-on-surface);
    font-weight: 500;
  }

  .col-metric {
    color: var(--b3-theme-on-surface-light);
    font-weight: 400;
    font-size: 11px;
  }

  .delta-up {
    color: #22c55e;
    font-weight: 700;
  }

  .delta-down {
    color: #ef4444;
    font-weight: 700;
  }

  .delta-flat {
    color: var(--b3-theme-on-surface-light);
  }
}

.compare-breakdown {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 10px;
  padding: 12px;
}

.breakdown-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin: 0 0 8px 0;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.breakdown-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.breakdown-label {
  width: 52px;
  flex-shrink: 0;
  text-align: right;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
}

.breakdown-bars-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.bar-row {
  height: 10px;
  background: rgba(var(--b3-theme-on-surface-rgb), 0.04);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
  font-size: 8px;
  color: #fff;
  display: flex;
  align-items: center;
  padding-left: 3px;
  min-width: 3px;
  font-weight: 500;
  white-space: nowrap;

  &.bar-a {
    background: var(--b3-theme-primary);
    opacity: 0.6;
  }

  &.bar-b {
    background: var(--b3-theme-primary);
  }
}

.breakdown-legend {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 3px;

  &.legend-a {
    background: var(--b3-theme-primary);
    opacity: 0.6;
  }

  &.legend-b {
    background: var(--b3-theme-primary);
  }
}
</style>
