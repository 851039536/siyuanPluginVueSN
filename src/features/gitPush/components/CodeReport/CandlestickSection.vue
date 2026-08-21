<!-- gitPush 代码统计报告：提交趋势分区（chart.js 蜡烛图 + 7日均线 + 工作时间底色 + 日提交标注 + 迷你节奏图 + 6 张摘要卡片） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："提交趋势" + 活跃天数徽章（悬浮说明统计口径） -->
    <div class="gpr-section-title">
      {{ i18n.reportCandlestickTitle }}
      <span
        class="gpr-section-count"
        :title="i18n.reportCandlestickTotalDays"
      >{{ stats.length }}</span>
    </div>

    <!-- 空状态：范围内无提交 -->
    <EmptyState
      v-if="stats.length === 0"
      icon="mdi:chart-finance"
      :text="i18n.reportNoData"
    />

    <template v-else>
      <!-- 图例：涨/跌/平色块 + 7日均线 + K 线语义说明 -->
      <div class="gpc-legend">
        <span class="gpc-legend-item">
          <span class="gpc-legend-dot gpc-legend-dot--up" />
          {{ i18n.reportCandlestickUp }}
        </span>
        <span class="gpc-legend-item">
          <span class="gpc-legend-dot gpc-legend-dot--down" />
          {{ i18n.reportCandlestickDown }}
        </span>
        <span class="gpc-legend-item">
          <span class="gpc-legend-dot gpc-legend-dot--flat" />
          {{ i18n.reportCandlestickFlat }}
        </span>
        <!-- 7 日均线图例（琥珀色横线，叠于蜡烛图上的短期趋势） -->
        <span class="gpc-legend-item">
          <span class="gpc-legend-line" />
          {{ i18n.reportAvg7 }}
        </span>
        <span class="gpc-legend-hint">{{ i18n.reportCandlestickHint }}</span>
      </div>

      <!-- K 线图（chart.js 浮动条 + 影线插件：实体=首末提交时刻跨度，影线=±0.5h 缓冲，底色=工作时间区；外层滚动容器保证日期多时可横向滑动，两侧中部提供滚动箭头按钮） -->
      <div class="gpc-chart-scroll-area">
        <div
          ref="scrollRef"
          class="gpc-chart-scroll"
        >
          <div
            class="gpc-chart-wrap"
            :style="{ minWidth: `${minChartWidth}px` }"
          >
            <Bar
              :data="barData"
              :options="chartOptions"
              :plugins="chartPlugins"
            />
          </div>
        </div>
        <!-- 左滚动按钮：查看更早日期数据 -->
        <button
          type="button"
          class="gpc-scroll-btn gpc-scroll-btn--left"
          :class="{ 'is-disabled': !canScrollLeft }"
          :disabled="!canScrollLeft"
          :title="i18n.reportScrollLeft"
          :aria-label="i18n.reportScrollLeft"
          @click="handleScrollLeft"
        >
          <Icon icon="mdi:chevron-left" />
        </button>
        <!-- 右滚动按钮：查看最新日期数据 -->
        <button
          type="button"
          class="gpc-scroll-btn gpc-scroll-btn--right"
          :class="{ 'is-disabled': !canScrollRight }"
          :disabled="!canScrollRight"
          :title="i18n.reportScrollRight"
          :aria-label="i18n.reportScrollRight"
          @click="handleScrollRight"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>

      <!-- 提交节奏迷你图：星期分布（7 根柱）+ 时段热力条（24h 色块） -->
      <div class="gpc-rhythm">
        <!-- 星期分布卡片 -->
        <div class="gpc-rhythm-card">
          <!-- 卡片标题："星期分布" + 最长连续提交徽章（悬浮说明统计口径） -->
          <div class="gpc-rhythm-title">
            {{ i18n.reportWeekdayTitle }}
            <span
              class="gpc-rhythm-badge"
              :title="i18n.reportStreakTip"
            >{{ i18n.reportStreak }}: {{ report.rhythm.maxStreak }}</span>
          </div>
          <!-- 7 根迷你柱（高度按提交数占比，最活跃星期高亮主题色） -->
          <div class="gpc-weekdays">
            <div
              v-for="w in weekdayBars"
              :key="w.dow"
              class="gpc-weekday"
              :title="`${w.label}: ${w.count}`"
            >
              <div class="gpc-weekday-track">
                <div
                  class="gpc-weekday-bar"
                  :class="{ 'gpc-weekday-bar--peak': w.isPeak }"
                  :style="{ height: w.heightPct + '%' }"
                />
              </div>
              <span class="gpc-weekday-label">{{ w.label }}</span>
              <span class="gpc-weekday-count">{{ w.count }}</span>
            </div>
          </div>
        </div>

        <!-- 时段热力卡片 -->
        <div class="gpc-rhythm-card">
          <!-- 卡片标题："时段分布" + 高峰时段徽章 -->
          <div class="gpc-rhythm-title">
            {{ i18n.reportHourlyTitle }}
            <span class="gpc-rhythm-badge gpc-rhythm-badge--accent">
              {{ i18n.reportPeakHours }}: {{ peakHoursText }}
            </span>
          </div>
          <!-- 24h 热力色条（每格 2 小时，颜色深浅=提交频率，hover 显示具体时段） -->
          <div class="gpc-hourly">
            <div
              v-for="h in hourlyHeat"
              :key="h.start"
              class="gpc-hour-cell"
              :class="{ 'gpc-hour-cell--peak': h.isPeak }"
              :style="{ background: h.color }"
              :title="`${h.startLabel}-${h.endLabel}: ${h.count}`"
            />
          </div>
          <!-- 时间轴刻度（0/6/12/18/24 时） -->
          <div class="gpc-hourly-scale">
            <span>0</span><span>6</span><span>12</span><span>18</span><span>24</span>
          </div>
        </div>
      </div>

      <!-- 摘要卡片：提交天数/总提交/日均提交/最高单日/最活跃星期/高峰时段 -->
      <div class="gpc-cards">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="gpc-card"
        >
          <div class="gpc-card-value">
            {{ card.value }}
          </div>
          <div
            class="gpc-card-label"
            :title="card.tip"
          >
            {{ card.label }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 提交趋势分区：聚合 dailyStats → chart.js 蜡烛图（实体=首末提交时刻跨度、影线=±0.5h 缓冲、颜色=提交量涨跌）+ 7日均线 + 工作时间底色 + 日提交标注 + 迷你节奏图 + 摘要卡片
import type { Chart, ChartData, ChartOptions, Plugin } from "chart.js"
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js"
import { Bar } from "vue-chartjs"
import { Icon } from "@iconify/vue"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import type { CodeReportData } from "../../types"
import { WEEKDAY_LABEL_KEYS } from "../../types/report"
import type { DailyCommitStat } from "../../types/report"
import { calcMovingAverage7 } from "../../reportMetrics"
import EmptyState from "../common/EmptyState.vue"

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip)

/** K 线涨跌色：较前一活跃日提交量增加=绿（涨），减少=红（跌），持平/首日=灰 */
const UP_COLOR = "#10b981"
const DOWN_COLOR = "#ef4444"
const FLAT_COLOR = "#64748b"
/** 7 日均线颜色（琥珀色，与 K 线实体形成对比） */
const MA_COLOR = "#f59e0b"
/** 工作时间区（08:00-18:00）底色：极淡中性色，canvas 不支持 CSS var 故用固定色 */
const WORK_START_HOUR = 8
const WORK_END_HOUR = 18
const WORK_BG_COLOR = "rgba(148, 163, 184, 0.08)"
/** 坐标轴刻度色（半透明灰，浅/深主题均可见；canvas 不支持 CSS var 故用固定色） */
const AXIS_COLOR = "rgba(128, 128, 128, 0.8)"
/** 网格线色 */
const GRID_COLOR = "rgba(128, 128, 128, 0.12)"

/** 最低实体高度（小时）：单条提交（open==close）时外扩到该厚度保证实体可见 */
const MIN_BODY_HOURS = 0.3

/** 每根蜡烛最小占地宽度（px）：实体 16px + 左右间距，保证多日期时不被挤压 */
const MIN_WIDTH_PER_DAY = 30

/** 单次点击滚动距离（px）：约 10 根蜡烛宽度，步长适中便于快速定位 */
const SCROLL_AMOUNT = 300

/** 日提交数标注字号（canvas 字体不受 CSS Token 约束，取与 10px 标签接近的小字号） */
const LABEL_FONT = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 dailyStats / rhythm） */
  report: CodeReportData
}>()

/** 每日提交统计（按日期升序，来自报告聚合） */
const stats = computed(() => props.report.dailyStats)

/** K 线图横向滚动容器 DOM 引用 */
const scrollRef = ref<HTMLElement | null>(null)

/** 左/右滚动按钮可用状态（滚动到边界时对应方向禁用） */
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

/** 依据滚动容器当前偏移量更新左右按钮可用状态（1px 容差避免浮点抖动） */
function updateScrollState() {
  const el = scrollRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
}

/** 向左平滑滚动 300px（查看更早日期数据） */
function handleScrollLeft() {
  scrollRef.value?.scrollBy({ left: -SCROLL_AMOUNT, behavior: "smooth" })
}

/** 向右平滑滚动 300px（查看最新日期数据） */
function handleScrollRight() {
  scrollRef.value?.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" })
}

onMounted(() => {
  const el = scrollRef.value
  if (!el) return
  el.addEventListener("scroll", updateScrollState, { passive: true })
  // 初始状态：图表可能尚未渲染完成，待 DOM 稳定后再检测一次滚动边界
  nextTick(updateScrollState)
})

onUnmounted(() => {
  scrollRef.value?.removeEventListener("scroll", updateScrollState)
})

// 切换项目/时间范围导致数据变化时：滚动回最左并重新检测边界状态，避免停留在旧数据位置
watch(stats, () => {
  const el = scrollRef.value
  if (!el) return
  el.scrollLeft = 0
  nextTick(updateScrollState)
})

/** 图表最小宽度（px）：日期数 × 每根蜡烛占地宽；超过容器宽度时外层滚动容器出现横向滚动条 */
const minChartWidth = computed(() => stats.value.length * MIN_WIDTH_PER_DAY)

/** 当日相对前一活跃日的提交量涨跌（首日视为持平） */
function trendOf(list: DailyCommitStat[], i: number): "up" | "down" | "flat" {
  if (i === 0) return "flat"
  const prev = list[i - 1].count
  const cur = list[i].count
  if (cur > prev) return "up"
  if (cur < prev) return "down"
  return "flat"
}

/** 实体/影线颜色（按涨跌语义） */
function colorOf(list: DailyCommitStat[], i: number): string {
  const t = trendOf(list, i)
  if (t === "up") return UP_COLOR
  if (t === "down") return DOWN_COLOR
  return FLAT_COLOR
}

/** 实体柱范围 [下沿, 上沿]：正常取 [min(open,close), max(open,close)]，跨度过小时外扩保证可见 */
function bodyRange(s: DailyCommitStat): [number, number] {
  const lo = Math.min(s.open, s.close)
  const hi = Math.max(s.open, s.close)
  if (hi - lo >= MIN_BODY_HOURS) return [lo, hi]
  return [Math.max(0, lo - MIN_BODY_HOURS), Math.min(24, hi + MIN_BODY_HOURS)]
}

/** 小时小数 → "HH:mm"（分钟四舍五入，如 9.25 → 09:15） */
function formatHour(h: number): string {
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

/** chart.js 数据集：浮动条（实体）+ 7日均线折线（右侧独立 yCount 轴），影线数据经 candlestick 字段供插件读取 */
const barData = computed<ChartData<"bar">>(() => {
  const list = stats.value
  const barDataset = {
    data: list.map((s) => bodyRange(s)),
    backgroundColor: list.map((_, i) => colorOf(list, i)),
    borderColor: list.map((_, i) => colorOf(list, i)),
    borderWidth: 1,
    maxBarThickness: 16,
    // 自定义字段：影线插件从数据集读取原始统计（避免闭包快照）
    candlestick: list,
  } as ChartData<"bar">["datasets"][number] & { candlestick: DailyCommitStat[] }
  // 7 日均线：与蜡烛共用 x 类别轴，量纲（提交数）挂到右侧 yCount 轴避免干扰时刻刻度
  const maDataset = {
    type: "line" as const,
    data: calcMovingAverage7(list),
    yAxisID: "yCount",
    borderColor: MA_COLOR,
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.35,
    fill: false,
    spanGaps: true,
  } as unknown as ChartData<"bar">["datasets"][number]
  return {
    labels: list.map((s) => s.date),
    datasets: [barDataset, maDataset],
  }
})

/** chart.js 配置：y 轴 0~24 小时 + 右侧 yCount 提交数量纲，x 轴日期自动抽样，tooltip 展示提交数/首末时刻 */
const chartOptions = computed<ChartOptions<"bar">>(() => {
  const list = stats.value
  const maxCount = Math.max(1, ...list.map((s) => s.count))
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1f2937",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
        padding: 8,
        callbacks: {
          title: (items) => {
            const s = list[items[0].dataIndex]
            return s ? s.date : ""
          },
          label: (item) => {
            const s = list[item.dataIndex]
            if (!s) return ""
            return [
              `${props.i18n.reportCandlestickCount}: ${s.count}`,
              `${props.i18n.reportCandlestickOpen}: ${formatHour(s.open)}`,
              `${props.i18n.reportCandlestickClose}: ${formatHour(s.close)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 0,
          autoSkip: true,
          color: AXIS_COLOR,
          // 紧凑日期标签（去掉年份前缀，完整日期在 tooltip 中展示）
          callback: (value) => String(value).slice(5),
        },
        grid: { display: false },
      },
      y: {
        min: 0,
        max: 24,
        ticks: {
          stepSize: 6,
          color: AXIS_COLOR,
          callback: (value) => `${value}:00`,
        },
        grid: { color: GRID_COLOR },
      },
      yCount: {
        position: "right",
        min: 0,
        max: maxCount,
        ticks: {
          maxTicksLimit: 4,
          color: AXIS_COLOR,
          callback: (value) => `${value}`,
        },
        grid: { display: false },
        border: { display: false },
      },
    },
  }
})

/** 图表插件：①beforeDatasetsDraw 画工作时间（08:00-18:00）底色 ②afterDatasetsDraw 画影线 + 日提交数标注 */
const chartPlugins = computed<Plugin[]>(() => [
  {
    id: "gpcWick",
    beforeDatasetsDraw(chart: Chart) {
      const yScale = chart.scales.y
      const { left, right, top } = chart.chartArea
      if (!yScale || !left || !right) return
      const yTop = yScale.getPixelForValue(WORK_START_HOUR)
      const yBottom = yScale.getPixelForValue(WORK_END_HOUR)
      if (yTop < top) return
      const ctx = chart.ctx
      ctx.save()
      ctx.fillStyle = WORK_BG_COLOR
      ctx.fillRect(left, yTop, right - left, yBottom - yTop)
      ctx.restore()
    },
    afterDatasetsDraw(chart: Chart) {
      const dataset = chart.data.datasets[0] as { candlestick?: DailyCommitStat[] } | undefined
      const list = dataset?.candlestick
      if (!list || list.length === 0) return
      const meta = chart.getDatasetMeta(0)
      if (!meta.data || meta.data.length === 0) return
      const yScale = chart.scales.y
      const ctx = chart.ctx
      ctx.save()
      ctx.lineWidth = 1
      list.forEach((s, i) => {
        const bar = meta.data[i]
        if (!bar) return
        const x = bar.x
        const yHigh = yScale.getPixelForValue(s.high)
        const yLow = yScale.getPixelForValue(s.low)
        const color = colorOf(list, i)
        ctx.strokeStyle = color
        // 影线竖线（low → high）
        ctx.beginPath()
        ctx.moveTo(x, yHigh)
        ctx.lineTo(x, yLow)
        ctx.stroke()
        // 影线端点横线（K 线细节，上下各 2px）
        ctx.beginPath()
        ctx.moveTo(x - 2, yHigh)
        ctx.lineTo(x + 2, yHigh)
        ctx.moveTo(x - 2, yLow)
        ctx.lineTo(x + 2, yLow)
        ctx.stroke()
      })
      // 日提交数标注（仅 >1 条时显示，避免单日提交时画面过挤）
      ctx.textAlign = "center"
      ctx.textBaseline = "bottom"
      ctx.font = LABEL_FONT
      list.forEach((s, i) => {
        if (s.count <= 1) return
        const bar = meta.data[i]
        if (!bar) return
        const yBodyTop = yScale.getPixelForValue(Math.max(s.open, s.close))
        ctx.fillStyle = colorOf(list, i)
        ctx.fillText(String(s.count), bar.x, yBodyTop - 3)
      })
      ctx.restore()
    },
  },
])

/** 星期迷你柱（7 根，高度按该周提交数占比；isPeak 标记最活跃星期） */
const weekdayBars = computed(() => {
  const rhythm = props.report.rhythm
  const max = Math.max(1, ...rhythm.weekday.map((w) => w.count))
  return rhythm.weekday.map((w) => ({
    dow: w.dow,
    count: w.count,
    label: props.i18n[WEEKDAY_LABEL_KEYS[w.dow]] ?? "",
    // 高度与数值严格成正比：零值星期 0%（仅保留 2px 基线），非零值至少 4% 保证可见
    heightPct: w.count === 0 ? 0 : Math.max(4, Math.round((w.count / max) * 100)),
    isPeak: w.dow === rhythm.topWeekday.dow && rhythm.topWeekday.count > 0,
  }))
})

/** 时段热力格（12 格，每格 2 小时；颜色透明度按提交频率，isPeak 标记高峰桶） */
const hourlyHeat = computed(() => {
  const rhythm = props.report.rhythm
  const max = Math.max(1, ...rhythm.hourly.map((h) => h.count))
  return rhythm.hourly.map((h) => ({
    start: h.start,
    count: h.count,
    startLabel: formatHour(h.start),
    endLabel: formatHour(h.end),
    color: h.count === 0 ? "transparent" : `rgba(16, 185, 129, ${0.12 + 0.88 * (h.count / max)})`,
    isPeak: h.start === rhythm.peakHours.start && rhythm.peakHours.count > 0,
  }))
})

/** 高峰时段文本（如 "14:00-16:00"） */
const peakHoursText = computed(() => {
  const p = props.report.rhythm.peakHours
  return `${formatHour(p.start)}-${formatHour(p.end)}`
})

/** 摘要卡片：提交天数/总提交/日均提交/最高单日/最活跃星期/高峰时段（最高单日与最活跃星期值悬浮显示明细） */
const summaryCards = computed(() => {
  const list = stats.value
  const total = list.reduce((sum, s) => sum + s.count, 0)
  const avg = list.length > 0 ? (total / list.length).toFixed(1) : "0"
  let peak: DailyCommitStat | undefined
  for (const s of list) {
    if (!peak || s.count > peak.count) peak = s
  }
  const rhythm = props.report.rhythm
  const topWeekdayLabel = props.i18n[WEEKDAY_LABEL_KEYS[rhythm.topWeekday.dow]] ?? ""
  return [
    { value: list.length, label: props.i18n.reportCandlestickTotalDays, tip: "" },
    { value: total, label: props.i18n.reportCandlestickTotalCommits, tip: "" },
    { value: avg, label: props.i18n.reportCandlestickAvgDaily, tip: "" },
    { value: peak ? peak.count : 0, label: props.i18n.reportCandlestickMaxDaily, tip: peak ? peak.date : "" },
    { value: topWeekdayLabel, label: props.i18n.reportTopWeekday, tip: `${props.i18n.reportCandlestickCount}: ${rhythm.topWeekday.count}` },
    { value: peakHoursText.value, label: props.i18n.reportPeakHours, tip: `${props.i18n.reportCandlestickCount}: ${rhythm.peakHours.count}` },
  ]
})
</script>

<style lang="scss">
@use "../../styles/CandlestickSection.scss";
@use "../../styles/index.scss";
</style>
