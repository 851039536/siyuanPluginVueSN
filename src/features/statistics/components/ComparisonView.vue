<!-- ComparisonView — 期间对比视图：选择两个时间段对比统计指标，展示差异表格与明细柱状图 -->
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
        <!-- 按钮："对比" -->
        {{ i18n.compareBtn }}
      </button>
    </div>

    <div
      v-if="loading"
      class="compare-loading"
    >
      <!-- 加载提示："对比中..." -->
      {{ i18n.comparing }}
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
                <!-- 表头："指标" -->
                {{ i18n.metricLabel }}
              </th>
              <th class="col-value">
                {{ data.periodALabel }}
              </th>
              <th class="col-value">
                {{ data.periodBLabel }}
              </th>
              <th class="col-delta">
                <!-- 表头："变化" -->
                {{ i18n.change }}
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
          <!-- 区块标题："各时段明细对比" -->
          {{ i18n.breakdownTitle }}
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
                <span class="bar-value">{{ item.aWords > 0 ? formatNumber(item.aWords) : '' }}</span>
              </div>
              <div class="bar-row">
                <div class="bar-track">
                  <div
                    class="bar-fill bar-b"
                    :style="{ width: barPct(item.bWords, maxBreakVal) }"
                  ></div>
                </div>
                <span class="bar-value">{{ item.bWords > 0 ? formatNumber(item.bWords) : '' }}</span>
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
      <!-- 空状态提示："选择两个期间并点击"对比"" -->
      {{ i18n.comparisonHint }}
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

interface Props {
  onGetComparisonData?: (yearA: number, monthA: number | undefined, yearB: number, monthB: number | undefined) => Promise<ComparisonData>
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  onGetComparisonData: undefined,
  i18n: () => ({}),
})

const i18n = computed(() => props.i18n)

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

// 对比指标定义（标签走 i18n：总字数/新增笔记/日均字数/活跃天数/最长连续）
const metrics = computed<MetricDef[]>(() => [
  {
    key: 'totalWords',
    label: i18n.value.totalWords,
    format: (r) => formatNumber(r.totalWords),
  },
  {
    key: 'totalNotesCreated',
    label: i18n.value.notesCreated,
    format: (r) => String(r.totalNotesCreated),
  },
  {
    key: 'avgDailyWords',
    label: i18n.value.dailyAvgWords,
    format: (r) => r.avgDailyWords.toLocaleString(),
  },
  {
    key: 'activeDays',
    label: i18n.value.activeDaysLabel,
    format: (r) => String(r.activeDays),
  },
  {
    key: 'longestStreak',
    label: i18n.value.longestStreak,
    format: (r) => String(r.longestStreak),
  },
])

/** 取指定指标的 delta 值（B−A 差值，即 B 相对 A 的变化），无数据时返回 0 */
function getDelta(key: string): number {
  return data.value?.deltas?.[key as keyof typeof data.value.deltas] ?? 0
}

function deltaClass(key: string): string {
  const d = getDelta(key)
  if (d > 0) return 'delta-up'
  if (d < 0) return 'delta-down'
  return 'delta-flat'
}

function deltaText(key: string): string {
  const d = getDelta(key)
  if (d === 0) return '—'
  const sign = d > 0 ? '+' : ''
  const aVal = (data.value!.a as any)[key] as number
  const pct = aVal !== 0 ? Math.round((d / aVal) * 100) : 0
  return `${sign}${formatNumber(d)} (${sign}${pct}%)`
}

/** 提取对齐键：年度 label 形如 `2024/01` 取月份 `01`；日度 label 形如 `01/15` 原样返回 */
function alignKey(label: string): string {
  const m = label.match(/^\d{4}\/(\d{2})$/)
  return m ? m[1] : label
}

const mergedBreakdown = computed(() => {
  if (!data.value) return []
  const aItems = data.value.a.monthlyBreakdown
  const bItems = data.value.b.monthlyBreakdown
  // 用 Map 按 alignKey 合并：A 先插入保持顺序，B 命中同键则回填 bWords，否则追加
  const map = new Map<string, { label: string, aWords: number, bWords: number }>()
  for (const item of aItems) {
    const key = alignKey(item.month)
    map.set(key, { label: item.month, aWords: item.words, bWords: 0 })
  }
  for (const item of bItems) {
    const key = alignKey(item.month)
    const existing = map.get(key)
    if (existing) {
      existing.bWords = item.words
    } else {
      map.set(key, { label: item.month, aWords: 0, bWords: item.words })
    }
  }
  return [...map.values()]
})

const maxBreakVal = computed(() => {
  let max = 1
  for (const item of mergedBreakdown.value) {
    max = Math.max(max, item.aWords, item.bWords)
  }
  return max
})

let reqSeq = 0

async function compare() {
  if (!props.onGetComparisonData) return
  const seq = ++reqSeq
  loading.value = true
  try {
    const result = await props.onGetComparisonData(
      yearA.value,
      monthA.value || undefined,
      yearB.value,
      monthB.value || undefined,
    )
    // 时序控制：若已有更新的请求发出，丢弃本次过期响应（loading 交由最新请求复位）
    if (seq !== reqSeq) return
    data.value = result
  } catch (e) {
    console.error('[ComparisonView] compare failed:', e)
  } finally {
    // 仅最新请求负责复位 loading，避免过期响应提前关闭加载态
    if (seq === reqSeq) loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use '../styles/ComparisonView.scss';
@use '../styles/index.scss';
</style>
