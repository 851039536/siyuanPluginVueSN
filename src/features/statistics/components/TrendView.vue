<!-- 趋势分析视图：趋势折线图 + 周期对比卡 + 历史数据表格 -->
<template>
  <div class="trend-view">
    <!-- 标题行：包含标题和日均统计 -->
    <div class="section-header">
      <h3 class="section-title">
        {{ i18n.title }}
      </h3>
      <div
        v-if="trendStats"
        class="trend-stats-inline"
      >
        <span class="stat-item"><IconWrapper
          name="list"
          :size="12"
        /> {{ i18n.avgDailyCreated }} <strong>{{ trendStats.avgDailyCreated }}</strong></span>
        <span class="stat-item"><IconWrapper
          name="edit"
          :size="12"
        /> {{ i18n.avgDailyModified }} <strong>{{ trendStats.avgDailyModified }}</strong></span>
      </div>
    </div>

    <!-- 周期对比汇总 -->
    <div
      v-if="comparisonStats"
      class="comparison-section"
    >
      <div
        v-for="card in comparisonCards"
        :key="card.title"
        class="comparison-card"
      >
        <div class="comparison-header">
          <IconWrapper
            class="comparison-icon"
            :name="card.icon"
            :size="14"
          />
          <span class="comparison-title">{{ card.title }}</span>
        </div>
        <div class="comparison-body">
          <div
            v-for="item in card.items"
            :key="item.label"
            class="comparison-item"
          >
            <span class="item-label">{{ item.label }}</span>
            <span class="item-values">
              <span class="current-value">{{ item.formatCurrent }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ item.formatPrev }}</span>
            </span>
            <span
              v-if="item.change !== null"
              class="change-tag"
              :class="getChangeClass(item.change)"
            >
              {{ formatChange(item.change) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 趋势图表 -->
    <div
      v-if="historicalData.length > 1"
      class="trend-chart-section"
    >
      <div class="chart-header">
        <h4 class="subsection-title">
          {{ i18n.historicalData }}
        </h4>
        <div class="chart-metric-tabs">
          <button
            v-for="tab in metricTabs"
            :key="tab.key"
            class="metric-tab"
            :class="{ active: activeMetric === tab.key }"
            @click="activeMetric = tab.key"
          >
            <IconWrapper
              :name="tab.icon"
              :size="12"
            /> {{ tab.label }}
          </button>
        </div>
      </div>
      <div class="trend-chart-container">
        <svg
          class="trend-chart-svg"
          :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        >
          <!-- 网格线 -->
          <line
            v-for="i in gridLines"
            :key="`grid-${i}`"
            :x1="chartPaddingLeft"
            :y1="i"
            :x2="chartWidth - chartPaddingRight"
            :y2="i"
            class="chart-grid-line"
          />
          <!-- Y轴标签 -->
          <text
            v-for="(label, idx) in yAxisLabels"
            :key="`ylabel-${idx}`"
            :x="chartPaddingLeft - 6"
            :y="label.y"
            class="chart-y-label"
            text-anchor="end"
          >{{ label.text }}</text>
          <!-- 面积填充 -->
          <path
            :d="areaPath"
            class="chart-area"
          />
          <!-- 折线 -->
          <path
            :d="linePath"
            class="chart-line"
            fill="none"
          />
          <!-- 数据点 -->
          <circle
            v-for="(pt, idx) in chartPoints"
            :key="`pt-${idx}`"
            :cx="pt.x"
            :cy="pt.y"
            :r="isLastPoint(idx) ? 4 : 2.5"
            class="chart-dot"
            :class="[{ 'chart-dot-today': isLastPoint(idx) }]"
          />
          <!-- X轴日期标签 -->
          <text
            v-for="(pt, idx) in chartPoints"
            :key="`xlabel-${idx}`"
            :x="pt.x"
            :y="chartHeight - 4"
            class="chart-x-label"
            text-anchor="middle"
          >{{ getXLabel(idx) }}</text>
          <!-- Tooltip 悬浮 -->
          <rect
            v-for="(pt, idx) in chartPoints"
            :key="`hover-${idx}`"
            :x="pt.x - hitWidth / 2"
            :y="0"
            :width="hitWidth"
            :height="chartHeight - 20"
            class="chart-hit-area"
            @mouseenter="hoveredIndex = idx"
            @mouseleave="hoveredIndex = -1"
          />
          <!-- Tooltip 竖线 -->
          <line
            v-if="hoveredIndex >= 0 && chartPoints[hoveredIndex]"
            :x1="chartPoints[hoveredIndex].x"
            :y1="chartPaddingTop"
            :x2="chartPoints[hoveredIndex].x"
            :y2="chartHeight - 20"
            class="chart-hover-line"
          />
        </svg>
        <!-- Tooltip 内容 -->
        <div
          v-if="hoveredIndex >= 0 && chartPoints[hoveredIndex]"
          class="chart-tooltip"
        >
          <div class="tooltip-date">
            {{ historicalData[hoveredIndex]?.dateLabel || historicalData[hoveredIndex]?.date }}
          </div>
          <div class="tooltip-value">
            <IconWrapper
              class="tooltip-metric-icon"
              :name="activeMetricObj.icon"
              :size="12"
            />
            <strong>{{ formatNumber(chartPoints[hoveredIndex].value) }}</strong>
            <span class="tooltip-unit">{{ activeMetricObj.unit }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史数据列表 -->
    <div class="historical-data-list">
      <h4 class="subsection-title">
        {{ i18n.historicalData }}
      </h4>
      <div class="historical-table-container">
        <table class="historical-table">
          <thead>
            <tr>
              <th class="col-date">
                {{ i18n.date }}
              </th>
              <th class="col-notes">
                <IconWrapper
                  name="file"
                  :size="12"
                />
                {{ i18n.notes }}
              </th>
              <th class="col-words">
                <IconWrapper
                  name="edit"
                  :size="12"
                />
                {{ i18n.words }}
              </th>
              <th class="col-blocks">
                <IconWrapper
                  name="format"
                  :size="12"
                />
                {{ i18n.blocks || '块' }}
              </th>
              <th class="col-created">
                <IconWrapper
                  name="list"
                  :size="12"
                />
                {{ i18n.created }}
              </th>
              <th class="col-modified">
                <IconWrapper
                  name="edit"
                  :size="12"
                />
                {{ i18n.modified }}
              </th>
              <th class="col-change">
                {{ i18n.change }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in historicalRows"
              :key="row.item.date"
              class="historical-row"
              :class="{ today: row.isToday }"
            >
              <td class="col-date">
                {{ row.item.dateLabel }}
              </td>
              <td class="col-notes">
                {{ formatNumber(row.item.totalNotes) }}
              </td>
              <td class="col-words">
                {{ formatNumber(row.item.totalWords) }}
              </td>
              <td class="col-blocks">
                {{ formatNumber(row.item.totalBlocks) }}
              </td>
              <td class="col-created">
                {{ row.item.todayCreated }}
              </td>
              <td class="col-modified">
                {{ row.item.todayModified }}
              </td>
              <td class="col-change">
                <template v-if="row.hasPrevious">
                  <span
                    v-if="row.wordDiff !== 0"
                    class="diff-tag"
                    :class="row.wordDiff > 0 ? 'success' : 'danger'"
                  >
                    {{ `${(row.wordDiff > 0 ? '+' : '') + formatShortNumber(row.wordDiff)} ${i18n.wordsUnit || '字'}` }}
                  </span>
                  <span
                    v-if="row.noteDiff !== 0"
                    class="diff-tag"
                    :class="row.noteDiff > 0 ? 'success' : 'danger'"
                  >
                    {{ `${(row.noteDiff > 0 ? '+' : '') + row.noteDiff} ${i18n.notesUnit || '笔记'}` }}
                  </span>
                  <span
                    v-if="row.blockDiff !== 0"
                    class="diff-tag"
                    :class="row.blockDiff > 0 ? 'success' : 'danger'"
                  >
                    {{ `${(row.blockDiff > 0 ? '+' : '') + formatShortNumber(row.blockDiff)} 块` }}
                  </span>
                </template>
                <span
                  v-else
                  class="diff-tag secondary"
                >-</span>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatDate,
  formatNumber,
  formatShortNumber,
} from "../utils"

interface HistoricalDataItem {
  date: string
  dateLabel: string
  totalNotes: number
  totalWords: number
  totalBlocks: number
  todayCreated: number
  todayModified: number
}

interface Props {
  historicalData?: HistoricalDataItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({
    title: "趋势分析",
    avgDailyCreated: "日均新增",
    avgDailyModified: "日均修改",
    historicalData: "历史数据",
    date: "日期",
    notes: "笔记",
    words: "字数",
    blocks: "块",
    created: "新增",
    modified: "修改",
    change: "变化",
    wordsUnit: "字",
    notesUnit: "笔记",
    dayOverDay: "日环比",
    weekOverWeek: "周环比",
    monthOverMonth: "月环比",
  }),
})

// ===== 趋势图表状态 =====
const activeMetric = ref<"totalWords" | "totalNotes" | "totalBlocks" | "todayCreated" | "todayModified">("totalWords")
const hoveredIndex = ref(-1)

const metricTabs = computed(() => [
  {
    key: "totalWords" as const,
    icon: "edit" as const,
    label: props.i18n.words,
    unit: props.i18n.wordsUnit,
  },
  {
    key: "totalNotes" as const,
    icon: "file" as const,
    label: props.i18n.notes,
    unit: props.i18n.notesUnit,
  },
  {
    key: "totalBlocks" as const,
    icon: "format" as const,
    label: props.i18n.blocks || "块",
    unit: "个",
  },
  {
    key: "todayCreated" as const,
    icon: "list" as const,
    label: props.i18n.created,
    unit: props.i18n.notesUnit,
  },
  {
    key: "todayModified" as const,
    icon: "edit" as const,
    label: props.i18n.modified,
    unit: props.i18n.notesUnit,
  },
])

const activeMetricObj = computed(() => metricTabs.value.find((t) => t.key === activeMetric.value) || metricTabs.value[0])

// 图表尺寸参数
const chartHeight = 200
const chartPaddingTop = 16
const chartPaddingBottom = 24
const chartPaddingLeft = 42
const chartPaddingRight = 10
const MIN_POINT_SPACING = 14

const chartWidth = computed(() => {
  const plotWidth = props.historicalData.length * MIN_POINT_SPACING
  return Math.max(600, chartPaddingLeft + plotWidth + chartPaddingRight)
})

const hitWidth = computed(() => {
  const count = props.historicalData.length
  if (count <= 1) return 20
  const availWidth = chartWidth.value - chartPaddingLeft - chartPaddingRight
  return Math.max(10, availWidth / count)
})

// 从历史数据提取当前指标的值数组
const chartValues = computed(() =>
  props.historicalData.map((item) => item[activeMetric.value]),
)

const chartMin = computed(() => {
  const vals = chartValues.value
  if (vals.length === 0) return 0
  const min = Math.min(...vals)
  // 给一些底部留白
  return Math.max(0, min - (Math.max(...vals) - min) * 0.1)
})

const chartMax = computed(() => {
  const vals = chartValues.value
  if (vals.length === 0) return 100
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  if (max === min) return max + 10
  return max + (max - min) * 0.1
})

// 计算图表绘制区域
const drawArea = computed(() => ({
  x: chartPaddingLeft,
  y: chartPaddingTop,
  w: chartWidth.value - chartPaddingLeft - chartPaddingRight,
  h: chartHeight - chartPaddingTop - chartPaddingBottom,
}))

// 计算每个数据点的坐标
const chartPoints = computed(() => {
  const data = props.historicalData
  if (data.length === 0) return []

  const {
    x: sx,
    y: sy,
    w,
    h,
  } = drawArea.value
  const min = chartMin.value
  const max = chartMax.value
  const range = max - min || 1

  return data.map((item, idx) => {
    const val = item[activeMetric.value]
    const px = data.length === 1 ? sx + w / 2 : sx + (idx / (data.length - 1)) * w
    const py = sy + h - ((val - min) / range) * h
    return {
      x: px,
      y: py,
      value: val,
    }
  })
})

// 折线路径
const linePath = computed(() => {
  const pts = chartPoints.value
  if (pts.length === 0) return ""
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
})

// 面积路径（折线 + 底部封闭）
const areaPath = computed(() => {
  const pts = chartPoints.value
  if (pts.length === 0) return ""
  const {
    y: sy,
    h,
  } = drawArea.value
  const bottom = sy + h
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  return `${line} L${pts[pts.length - 1].x},${bottom} L${pts[0].x},${bottom} Z`
})

// Y 轴刻度
const yAxisLabels = computed(() => {
  const {
    y: sy,
    h,
  } = drawArea.value
  const min = chartMin.value
  const max = chartMax.value
  const steps = 4
  const labels = []
  for (let i = 0; i <= steps; i++) {
    const val = min + ((max - min) * i) / steps
    const py = sy + h - (i / steps) * h
    labels.push({
      text: formatShortNumber(Math.round(val)),
      y: py + 3,
    })
  }
  return labels
})

// 网格线 Y 坐标
const gridLines = computed(() => {
  const {
    y: sy,
    h,
  } = drawArea.value
  const steps = 4
  const lines = []
  for (let i = 0; i <= steps; i++) {
    lines.push(sy + h - (i / steps) * h)
  }
  return lines
})

// X 轴标签（稀疏显示，避免重叠）
function getXLabel(idx: number): string {
  const data = props.historicalData
  const total = data.length
  if (total <= 8) return data[idx]?.dateLabel?.split(" ")[0] || ""
  // 间隔显示
  const step = Math.ceil(total / 8)
  if (idx % step === 0 || idx === total - 1) {
    return data[idx]?.dateLabel?.split(" ")[0] || ""
  }
  return ""
}

function isLastPoint(idx: number): boolean {
  return idx === props.historicalData.length - 1
}


// 计算周期对比数据
const comparisonStats = computed(() => {
  if (props.historicalData.length === 0) return null

  const today = new Date()
  const todayStr = formatDate(today)

  // 获取今日数据
  const todayData = props.historicalData.find((item) => item.date === todayStr)

  // 获取昨日数据
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDate(yesterday)
  const yesterdayData = props.historicalData.find(
    (item) => item.date === yesterdayStr,
  )

  // 获取本周数据 (周一到今天)
  const weekStart = new Date(today)
  const dayOfWeek = weekStart.getDay() || 7 // 周日为0，转为7
  weekStart.setDate(weekStart.getDate() - dayOfWeek + 1)
  const thisWeekData = getRangeData(weekStart, today)

  // 获取上周数据
  const lastWeekEnd = new Date(weekStart)
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
  const lastWeekStart = new Date(lastWeekEnd)
  lastWeekStart.setDate(lastWeekStart.getDate() - 6)
  const lastWeekData = getRangeData(lastWeekStart, lastWeekEnd)

  // 获取本月数据
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthData = getRangeData(monthStart, today)

  // 获取上月数据
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const lastMonthStart = new Date(
    lastMonthEnd.getFullYear(),
    lastMonthEnd.getMonth(),
    1,
  )
  const lastMonthData = getRangeData(lastMonthStart, lastMonthEnd)

  return {
    today: {
      created: todayData?.todayCreated ?? 0,
      modified: todayData?.todayModified ?? 0,
      words: todayData?.totalWords ?? 0,
    },
    yesterday: {
      created: yesterdayData?.todayCreated ?? 0,
      modified: yesterdayData?.todayModified ?? 0,
      words: yesterdayData?.totalWords ?? 0,
    },
    dayChange: {
      created: calcChange(
        todayData?.todayCreated ?? 0,
        yesterdayData?.todayCreated ?? 0,
      ),
      modified: calcChange(
        todayData?.todayModified ?? 0,
        yesterdayData?.todayModified ?? 0,
      ),
      words: calcChange(
        todayData?.totalWords ?? 0,
        yesterdayData?.totalWords ?? 0,
      ),
    },
    thisWeek: {
      created: thisWeekData.created,
      modified: thisWeekData.modified,
      words: thisWeekData.words,
    },
    lastWeek: {
      created: lastWeekData.created,
      modified: lastWeekData.modified,
      words: lastWeekData.words,
    },
    weekChange: {
      created: calcChange(thisWeekData.created, lastWeekData.created),
      modified: calcChange(thisWeekData.modified, lastWeekData.modified),
      words: calcChange(thisWeekData.words, lastWeekData.words),
    },
    thisMonth: {
      created: thisMonthData.created,
      modified: thisMonthData.modified,
      words: thisMonthData.words,
    },
    lastMonth: {
      created: lastMonthData.created,
      modified: lastMonthData.modified,
      words: lastMonthData.words,
    },
    monthChange: {
      created: calcChange(thisMonthData.created, lastMonthData.created),
      modified: calcChange(thisMonthData.modified, lastMonthData.modified),
      words: calcChange(thisMonthData.words, lastMonthData.words),
    },
  }
})

// 对比卡片数据驱动
const comparisonCards = computed(() => {
  if (!comparisonStats.value) return []
  const stats = comparisonStats.value
  return [
    {
      icon: "list" as const,
      title: props.i18n.dayOverDay,
      current: stats.today,
      prev: stats.yesterday,
      change: stats.dayChange,
    },
    {
      icon: "list" as const,
      title: props.i18n.weekOverWeek,
      current: stats.thisWeek,
      prev: stats.lastWeek,
      change: stats.weekChange,
    },
    {
      icon: "list" as const,
      title: props.i18n.monthOverMonth,
      current: stats.thisMonth,
      prev: stats.lastMonth,
      change: stats.monthChange,
    },
  ].map((card) => ({
    ...card,
    items: ([
      {
        key: "created",
        label: props.i18n.created,
        useFormat: false,
      },
      {
        key: "modified",
        label: props.i18n.modified,
        useFormat: false,
      },
      {
        key: "words",
        label: props.i18n.words,
        useFormat: true,
      },
    ] as const).map((m) => ({
      label: m.label,
      formatCurrent: m.useFormat ? formatNumber(card.current[m.key]) : String(card.current[m.key]),
      formatPrev: m.useFormat ? formatNumber(card.prev[m.key]) : String(card.prev[m.key]),
      change: card.change[m.key],
    })),
  }))
})

function getRangeData(
  startDate: Date,
  endDate: Date,
): { created: number, modified: number, words: number } {
  let created = 0
  let modified = 0
  let words = 0

  const startStr = formatDate(startDate)
  const endStr = formatDate(endDate)

  for (const item of props.historicalData) {
    if (item.date >= startStr && item.date <= endStr) {
      created += item.todayCreated
      modified += item.todayModified
      words = item.totalWords // 取最后一天的总字数
    }
  }

  return {
    created,
    modified,
    words,
  }
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}

function getChangeClass(change: number | null): string {
  if (change === null || change === 0) return "neutral"
  return change > 0 ? "positive" : "negative"
}

function formatChange(change: number | null): string {
  if (change === null) return "-"
  const prefix = change > 0 ? "+" : ""
  return `${prefix}${change.toFixed(1)}%`
}

const trendStats = computed(() => {
  if (props.historicalData.length === 0) return null

  const totalCreated = props.historicalData.reduce(
    (sum, item) => sum + item.todayCreated,
    0,
  )
  const totalModified = props.historicalData.reduce(
    (sum, item) => sum + item.todayModified,
    0,
  )

  return {
    totalCreated,
    totalModified,
    avgDailyCreated: Math.round(totalCreated / props.historicalData.length),
    avgDailyModified: Math.round(totalModified / props.historicalData.length),
  }
})

const historicalRows = computed(() => {
  const today = new Date()
  const todayStr = formatDate(today)
  return props.historicalData.map((item, index) => {
    const previous = props.historicalData[index + 1]
    return {
      item,
      wordDiff: previous ? getDiff(item, previous, "totalWords") : 0,
      noteDiff: previous ? getDiff(item, previous, "totalNotes") : 0,
      blockDiff: previous ? getDiff(item, previous, "totalBlocks") : 0,
      hasPrevious: Boolean(previous),
      isToday: item.date === todayStr,
    }
  })
})

function getDiff(
  current: HistoricalDataItem,
  previous: HistoricalDataItem,
  field: "totalWords" | "totalNotes" | "totalBlocks",
): number {
  if (!current || !previous) return 0
  // 累计值的差值即为该周期内的净变化
  return current[field] - previous[field]
}
</script>


<style scoped lang="scss">
@use "../styles/TrendView.scss";
</style>
