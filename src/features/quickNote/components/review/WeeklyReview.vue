<template>
  <div class="qn-review">
    <!-- 周切换头（← 更早 / 周标签 + 日期范围 / → 更近） -->
    <div class="qn-review__week-bar">
      <button
        class="qn-icon-btn"
        :disabled="weekOffset >= maxWeekOffset"
        :title="i18n.reviewPrevWeek"
        @click="weekOffset++"
      >
        <IconWrapper
          name="chevronLeft"
          :size="12"
        />
      </button>
      <div class="qn-review__week-info">
        <!-- 周标签："本周 / 上周 / N 周前" -->
        <span class="qn-review__week-label">{{ weekLabelText }}</span>
        <!-- 周日期范围："MM/DD - MM/DD" -->
        <span class="qn-review__week-range">{{ weekRangeText }}</span>
      </div>
      <button
        class="qn-icon-btn"
        :disabled="weekOffset === 0"
        :title="i18n.reviewNextWeek"
        @click="weekOffset--"
      >
        <IconWrapper
          name="chevronRight"
          :size="12"
        />
      </button>
    </div>

    <!-- 统计卡片行（本期完成 / 环比上周 / 日均完成） -->
    <div class="qn-review__stats">
      <div class="qn-review__stat">
        <!-- 统计标签："本期完成" -->
        <span class="qn-review__stat-label">{{ i18n.statCompleted }}</span>
        <span class="qn-review__stat-value">{{ weekTotal }}</span>
      </div>
      <div class="qn-review__stat">
        <!-- 统计标签："较上周" -->
        <span class="qn-review__stat-label">{{ i18n.statVsLast }}</span>
        <span
          class="qn-review__stat-value qn-review__stat-value--trend"
          :class="trendClass"
        >{{ trendText }}</span>
      </div>
      <div class="qn-review__stat">
        <!-- 统计标签："日均完成" -->
        <span class="qn-review__stat-label">{{ i18n.statAvgDaily }}</span>
        <span class="qn-review__stat-value">{{ avgText }}</span>
      </div>
    </div>

    <!-- 双图表区 -->
    <div class="qn-review__charts">
      <!-- 优先级分布环形图 -->
      <div class="qn-review__chart-col">
        <!-- 辅助文字："优先级分布" -->
        <span class="qn-review__chart-title">{{ i18n.priorityChartTitle }}</span>
        <div class="qn-review__chart-box">
          <Chart
            v-if="hasPriorityData"
            type="doughnut"
            :data="priorityChartData"
            :height="120"
            :options="doughnutOptions"
          />
          <div
            v-else
            class="qn-review__chart-empty"
          >{{ i18n.noData }}</div>
        </div>
      </div>
      <!-- 项目精力分布条形图 -->
      <div class="qn-review__chart-col">
        <!-- 辅助文字："精力分布" -->
        <span class="qn-review__chart-title">{{ i18n.effortChartTitle }}</span>
        <div class="qn-review__chart-box">
          <Chart
            v-if="hasEffortData"
            type="bar"
            :data="projectEffort"
            :height="120"
            :options="barOptions"
          />
          <div
            v-else
            class="qn-review__chart-empty"
          >{{ i18n.noData }}</div>
        </div>
      </div>
    </div>

    <!-- 卡点汇总（实时状态快照，非所选周历史） -->
    <div class="qn-review__blocks">
      <div class="qn-review__section-head">
        <!-- 区块标题："卡点汇总" -->
        <span class="qn-review__section-title">{{ i18n.blockSummaryTitle }}</span>
        <!-- 实时状态徽章："当前" -->
        <span class="qn-review__block-now">{{ i18n.blockersCurrent }}</span>
      </div>
      <ul
        v-if="blockSummary.length > 0"
        class="qn-review__block-list"
      >
        <li
          v-for="b in blockSummary"
          :key="b.projectId"
          class="qn-review__block-item"
        >
          <IconWrapper
            name="alertCircle"
            :size="11"
          />
          <span class="qn-review__block-name">{{ b.projectName }}</span>
          <span class="qn-review__block-text">{{ b.blocker }}</span>
        </li>
      </ul>
      <!-- 无卡点时柔和提示 -->
      <div
        v-else
        class="qn-review__block-empty"
      >{{ i18n.blockEmpty }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 每周复盘面板（完整重构版）
 * 顶部周切换头（本周/上周/…最近 7 周，纯派生回溯）；统计卡片行（本期完成/环比上周/日均完成）；
 * 中部优先级分布环形图 + 项目精力分布条形图（随周切换）；底部卡点汇总（实时状态快照）；
 * 数据由 useWeeklyReview 从待办 doneAt 实时派生，经 props 注入
 */
import type { ChartData, ChartOptions } from "@/components/chart.types"
import type { useWeeklyReview } from "../../composables/useWeeklyReview"
import { computed } from "vue"
import Chart from "@/components/Chart.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PRIORITY_META } from "../../types"

type ReviewApi = ReturnType<typeof useWeeklyReview>

const props = defineProps<{
  /** 复盘数据 API（weekOffset 周切换 + 派生统计） */
  review: ReviewApi
  i18n: Record<string, string>
}>()

// 解构出响应式引用（模板中顶层 ref 自动解包，可直接 weekOffset++ 切换周）
const { weekOffset, maxWeekOffset, weekStart, weekEnd, weekTotal, trend, weekAvg, priorityDistribution, projectEffort, blockSummary } = props.review

// ==================== 周切换文案 ====================

/** 周标签："本周 / 上周 / N 周前" */
const weekLabelText = computed(() => {
  if (weekOffset.value === 0) return props.i18n.reviewThisWeek
  if (weekOffset.value === 1) return props.i18n.reviewLastWeek
  return props.i18n.reviewWeeksAgo.replace("{n}", String(weekOffset.value))
})

/** 时间戳 → "MM/DD" 短格式 */
const formatMD = (ts: number): string => {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

/** 周日期范围："MM/DD - MM/DD"（weekEnd 为下周一零点，不含） */
const weekRangeText = computed(() => `${formatMD(weekStart.value)} - ${formatMD(weekEnd.value - 1)}`)

// ==================== 统计卡片 ====================

/** 环比文案：正数带 + 号，负数自然带 - 号，零显示持平 */
const trendText = computed(() => {
  if (trend.value === 0) return props.i18n.trendFlat
  return trend.value > 0 ? `+${trend.value}` : String(trend.value)
})

/** 环比涨跌样式（升绿 / 降红 / 平灰） */
const trendClass = computed(() => {
  if (trend.value > 0) return "qn-review__trend--up"
  if (trend.value < 0) return "qn-review__trend--down"
  return "qn-review__trend--flat"
})

/** 日均文案：整数不带小数点 */
const avgText = computed(() => String(Number(weekAvg.value.toFixed(1))))

// ==================== 图表 ====================

/** 环形图是否存在数据（任一优先级有完成数） */
const hasPriorityData = computed(() => priorityDistribution.value.some((d) => d.value > 0))

/** 环形图数据：label 经 PRIORITY_META 转 i18n 文案（未知优先级原样显示） */
const priorityChartData = computed<ChartData[]>(() =>
  priorityDistribution.value.map((d) => {
    const meta = PRIORITY_META[d.label as keyof typeof PRIORITY_META]
    return {
      label: meta ? props.i18n[meta.labelKey] || d.label : d.label,
      value: d.value,
      color: d.color,
    }
  }),
)

/** 条形图是否存在数据（任一项目有完成数） */
const hasEffortData = computed(() => projectEffort.value.some((d) => d.value > 0))

// 环形图选项：显示图例与提示
const doughnutOptions: ChartOptions = {
  showLegend: true,
  showTooltip: true,
}

// 条形图选项：显示网格与标签，不显示图例
const barOptions: ChartOptions = {
  showLegend: false,
  showGrid: true,
  showTooltip: true,
}
</script>

<style scoped lang="scss">
@use "../../styles/WeeklyReview.scss";
@use "../../styles/index.scss";
</style>
