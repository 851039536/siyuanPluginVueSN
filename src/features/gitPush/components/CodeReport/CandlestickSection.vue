<!-- gitPush 代码统计报告：提交趋势分区（日期数超限时先分桶压缩，再渲染 chart.js 蜡烛图 + 7日均线 + 工作时间底色 + 日提交标注 + 迷你节奏图 + 6 张摘要卡片） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："提交趋势" + 活跃天数徽章（悬浮说明统计口径；用原始 dailyStats 保证与聚合无关） -->
    <div class="gpr-section-title">
      {{ i18n.reportCandlestickTitle }}
      <span
        class="gpr-section-count"
        :title="i18n.reportCandlestickTotalDays"
      >{{ dailyStats.length }}</span>
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
        <!-- 聚合提示：日期数超上限时按连续天数分桶，提示"每根 K 线代表 N 天" -->
        <span
          v-if="aggregatedHint"
          class="gpc-legend-agg"
        >{{ aggregatedHint }}</span>
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
            <!-- 非激活 Tab 卸载 canvas：避免 chart.js 实例与画布内存常驻、且 display:none 下尺寸归零触发 resize 抖动 -->
            <Bar
              v-if="active"
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
// 提交趋势分区：dailyStats 分桶压缩（日期数超 MAX_CANDLES 时）→ chart.js 蜡烛图（实体=首末提交时刻跨度、影线=±0.5h 缓冲、颜色=提交量涨跌）+ 7日均线 + 工作时间底色 + 日提交标注 + 迷你节奏图 + 摘要卡片
import type { Plugin } from "chart.js"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { CodeReportData } from "../../types"
import { WEEKDAY_LABEL_KEYS } from "../../types/report"
import type { DailyCommitStat } from "../../types/report"
import { collapseDailyStats } from "../../reportMetrics"
import {
  buildCandleChartData,
  buildCandleChartOptions,
  createCandlestickPlugin,
  formatHour,
  MAX_CHART_WIDTH,
  MIN_WIDTH_PER_DAY,
} from "../../reportChart"
import { maxOf } from "../../utils"
import EmptyState from "../common/EmptyState.vue"

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip)

/** 单次点击滚动距离（px）：约 10 根蜡烛宽度，步长适中便于快速定位 */
const SCROLL_AMOUNT = 300

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 dailyStats / rhythm） */
  report: CodeReportData
  /** 所在 Tab 是否激活（非激活时卸载 canvas，避免 chart.js 实例与画布内存常驻） */
  active: boolean
}>()

/** 原始每日提交统计（按日期升序，来自报告聚合；节奏图与摘要卡片使用原始口径以保证语义准确） */
const dailyStats = computed(() => props.report.dailyStats)

/**
 * K 线数据（分桶压缩后）：日期数超过 MAX_CANDLES 时按连续天数聚合，
 * 使画布宽度有界（≤5400px）且不至于把 1800 根蜡烛挤成不可读的细条。
 */
const candles = computed(() => collapseDailyStats(props.report.dailyStats))

/** 图表实际消费的统计序列（压缩后的 K 线） */
const stats = computed(() => candles.value.list)

/** 聚合提示文案（bucketDays > 1 时提示每根 K 线代表的天数；未聚合时为空串，模板隐藏提示） */
const aggregatedHint = computed(() => {
  const days = candles.value.bucketDays
  if (days <= 1) return ""
  return props.i18n.reportChartAggregated.replace("{0}", String(days))
})

/** K 线图横向滚动容器 DOM 引用 */
const scrollRef = ref<HTMLElement | null>(null)

/** 左/右滚动按钮可用状态（滚动到边界时对应方向禁用） */
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

/** 滚动状态检测的 rAF 句柄（合并同一帧内的多次 scroll 事件，避免逐事件强制 layout + 重渲染） */
let scrollRaf = 0

/**
 * 已保存的横向滚动位置（px）。
 * 非激活 Tab 会卸载 canvas，容器内容宽度归零导致浏览器把 scrollLeft 重置为 0，
 * 切回时需在 canvas 重建后恢复，避免用户视角跳回最左端。
 */
let savedScrollLeft = 0

/** 依据滚动容器当前偏移量更新左右按钮可用状态（1px 容差避免浮点抖动） */
function updateScrollState() {
  const el = scrollRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
}

/** scroll 事件回调：合并到下一帧执行，一帧内最多读一次几何属性 */
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    updateScrollState()
  })
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
  el.addEventListener("scroll", onScroll, { passive: true })
  // 初始状态：图表可能尚未渲染完成，待 DOM 稳定后再检测一次滚动边界
  nextTick(updateScrollState)
})

// 卸载前移除监听与未执行的 rAF：Vue 3.5 在 unmounted 钩子执行前模板 ref 已被置空，用 unmounted 会静默移除失败
onBeforeUnmount(() => {
  scrollRef.value?.removeEventListener("scroll", onScroll)
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf)
    scrollRaf = 0
  }
})

// 切换项目/时间范围导致数据变化时：滚动回最左并重新检测边界状态，避免停留在旧数据位置
watch(dailyStats, () => {
  const el = scrollRef.value
  if (!el) return
  el.scrollLeft = 0
  savedScrollLeft = 0
  nextTick(updateScrollState)
})

/**
 * 图表最小宽度（px）：K 线根数 × 每根蜡烛占地宽，硬上限 MAX_CHART_WIDTH。
 * 超过容器宽度时外层滚动容器出现横向滚动条。
 */
const minChartWidth = computed(() => Math.min(stats.value.length * MIN_WIDTH_PER_DAY, MAX_CHART_WIDTH))

// Tab 切换导致 canvas 销毁/重建时保存与恢复滚动位置：
// 切走（active=false）时 watcher 先于 DOM 更新触发，此时 scrollLeft 仍有效，先存下；
// 切回（active=true）时 canvas 尚未重建，需等 nextTick 容器宽度恢复后再写回。
watch(() => props.active, (isActive) => {
  if (!isActive) {
    savedScrollLeft = scrollRef.value?.scrollLeft ?? 0
    return
  }
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollLeft = savedScrollLeft
    updateScrollState()
  })
})

/** chart.js 数据集（浮动条实体 + 7 日均线折线；构建细节见 reportChart 模块） */
const barData = computed(() => buildCandleChartData(stats.value))

/** chart.js 配置（左轴 0~24 时刻 + 右轴提交数量纲；构建细节见 reportChart 模块） */
const chartOptions = computed(() =>
  buildCandleChartOptions(stats.value, props.i18n, maxOf(stats.value.map((s) => s.count), 1)),
)

/**
 * K 线绘制插件数组（工作时间底色 + 影线 + 日提交数标注）。
 * 该 computed 读取不到任何响应式依赖，只会求值一次并常驻缓存，
 * 因此传给 vue-chartjs 的 plugins 数组引用稳定，不会触发图表重建。
 */
const chartPlugins = computed<Plugin[]>(() => [createCandlestickPlugin()])

/** 星期迷你柱（7 根，高度按该周提交数占比；isPeak 标记最活跃星期） */
const weekdayBars = computed(() => {
  const rhythm = props.report.rhythm
  const max = maxOf(rhythm.weekday.map((w) => w.count), 1)
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
  const max = maxOf(rhythm.hourly.map((h) => h.count), 1)
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
  // 用原始 dailyStats 而非压缩后的 K 线：摘要统计的是真实日历日口径，不应随图表分桶变化
  const list = dailyStats.value
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
