<!-- gitPush 代码统计报告：提交趋势分区（日期数超限时先分桶压缩，再渲染 chart.js 蜡烛图 + 7日均线 + 工作时间底色 + 日提交标注 + 节奏迷你图 + 6 张摘要卡片） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："提交趋势"（活跃天数由分区 Tab 角标承担，此处不重复渲染同一计数） -->
    <div class="gpr-section-title">
      {{ i18n.reportCandlestickTitle }}
    </div>

    <!-- 空状态：范围内无提交 -->
    <EmptyState
      v-if="stats.length === 0"
      icon="mdi:chart-finance"
      :text="i18n.reportNoData"
    />

    <template v-else>
      <!-- Period totals 头（chart-first 重排，对齐 GitHub Insights 的 Commit activity 布局：区间总计置顶） -->
      <div class="gpc-cards gpc-cards--totals">
        <div
          v-for="card in totalCards"
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

      <!-- 提交节奏迷你图：星期分布（7 根柱）+ 时段热力条（24h 色块）+ streak/peak 徽章 -->
      <RhythmSection
        :i18n="i18n"
        :rhythm="report.rhythm"
      />

      <!-- 节奏摘要卡片：最活跃星期/高峰时段（period totals 已置顶，此处只留节奏维度） -->
      <div class="gpc-cards">
        <div
          v-for="card in rhythmCards"
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
// 提交趋势分区：dailyStats 分桶压缩（日期数超 MAX_CANDLES 时）→ chart.js 蜡烛图（实体=首末提交时刻跨度、影线=±0.5h 缓冲、颜色=提交量涨跌）+ 7日均线 + 工作时间底色 + 日提交标注 + 节奏迷你图 + 摘要卡片
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
import { computed, ref, toRef } from "vue"
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
import { fmtTemplate } from "../../utils/i18nFormat"
import { useChartScroll } from "../../composables/useChartScroll"
import EmptyState from "../common/EmptyState.vue"
import RhythmSection from "./RhythmSection.vue"

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

/** 原始每日提交统计（按日期升序，来自报告聚合；摘要卡片使用原始口径以保证语义准确） */
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
  return fmtTemplate(props.i18n.reportChartAggregated, String(days))
})

/** K 线图横向滚动（状态机迁至 useChartScroll：按钮可用态 / rAF 合并 / Tab 切换滚动位置保持） */
const scrollRef = ref<HTMLElement | null>(null)
const { canScrollLeft, canScrollRight, handleScrollLeft, handleScrollRight } = useChartScroll({
  scrollRef,
  active: toRef(props, "active"),
  dataSource: dailyStats,
  scrollAmount: SCROLL_AMOUNT,
})

/**
 * 图表最小宽度（px）：K 线根数 × 每根蜡烛占地宽，硬上限 MAX_CHART_WIDTH。
 * 超过容器宽度时外层滚动容器出现横向滚动条。
 */
const minChartWidth = computed(() => Math.min(stats.value.length * MIN_WIDTH_PER_DAY, MAX_CHART_WIDTH))

/** chart.js 数据集（浮动条实体 + 7 日均线折线；构建细节见 reportChart 模块） */
const barData = computed(() => buildCandleChartData(stats.value))

/** chart.js 配置（左轴 0~24 时刻 + 右轴提交数量纲；构建细节见 reportChart 模块） */
const chartOptions = computed(() =>
  buildCandleChartOptions(stats.value, props.i18n, maxOf(stats.value.map((s) => s.count), 1)),
)

/**
 * K 线绘制插件数组（工作时间底色 + 今日标记虚线 + 影线 + 日提交数标注）。
 * bucketDays/todayLabel 变化时才重建插件实例（对应数据集重建，语义一致）；
 * 其余时段数组引用稳定，不会触发图表重建。
 */
const chartPlugins = computed<Plugin[]>(() => [
  createCandlestickPlugin(candles.value.bucketDays, props.i18n.reportTodayMarker),
])

/** Period totals 头（提交天数/总提交/日均提交/最高单日；真实日历日口径，不随图表分桶变化） */
const totalCards = computed(() => {
  const list = dailyStats.value
  const total = list.reduce((sum, s) => sum + s.count, 0)
  const avg = list.length > 0 ? (total / list.length).toFixed(1) : "0"
  let peak: DailyCommitStat | undefined
  for (const s of list) {
    if (!peak || s.count > peak.count) peak = s
  }
  return [
    { value: list.length, label: props.i18n.reportCandlestickTotalDays, tip: "" },
    { value: total, label: props.i18n.reportCandlestickTotalCommits, tip: "" },
    { value: avg, label: props.i18n.reportCandlestickAvgDaily, tip: "" },
    { value: peak ? peak.count : 0, label: props.i18n.reportCandlestickMaxDaily, tip: peak ? peak.date : "" },
  ]
})

/** 节奏摘要卡片（最活跃星期/高峰时段，值悬浮显示计数） */
const rhythmCards = computed(() => {
  const rhythm = props.report.rhythm
  const topWeekdayLabel = props.i18n[WEEKDAY_LABEL_KEYS[rhythm.topWeekday.dow]] ?? ""
  const peakHoursText = `${formatHour(rhythm.peakHours.start)}-${formatHour(rhythm.peakHours.end)}`
  return [
    { value: topWeekdayLabel, label: props.i18n.reportTopWeekday, tip: `${props.i18n.reportCandlestickCount}: ${rhythm.topWeekday.count}` },
    { value: peakHoursText, label: props.i18n.reportPeakHours, tip: `${props.i18n.reportCandlestickCount}: ${rhythm.peakHours.count}` },
  ]
})
</script>

<style lang="scss">
@use "../../styles/CandlestickSection.scss";
@use "../../styles/index.scss";
</style>
