<template>
  <div class="qn-review">
    <!-- 本周完成数字卡片 -->
    <div class="qn-review__stat">
      <!-- 辅助文字："本周完成" -->
      <span class="qn-review__stat-label">{{ i18n.weekCompleted }}</span>
      <span class="qn-review__stat-value">{{ weekTotal }}</span>
      <!-- 辅助文字："件事" -->
      <span class="qn-review__stat-unit">{{ i18n.weekUnit }}</span>
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
            :data="effortChartData"
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

    <!-- 卡点汇总 -->
    <div class="qn-review__blocks">
      <!-- 区块标题："卡点汇总" -->
      <span class="qn-review__section-title">{{ i18n.blockSummaryTitle }}</span>
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
 * 速记功能 — 每周复盘面板
 * 顶部本周完成数字卡片；左侧优先级分布环形图 + 右侧项目精力分布条形图（Chart.vue 渲染）；
 * 底部卡点汇总清单；数据由 useWeeklyReview 纯计算派生，经 props 注入
 */
import type { ChartData } from "@/components/Chart.vue"
import type { ChartOptions } from "@/components/Chart.vue"
import type { BlockSummary } from "../../composables/useWeeklyReview"
import { computed } from "vue"
import Chart from "@/components/Chart.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PRIORITY_META } from "../../types"

const props = defineProps<{
  /** 本周完成事项总数 */
  weekTotal: number
  /** 优先级分布数据（label 为优先级类型字符串，需经 PRIORITY_META 转 i18n 文案） */
  priorityDistribution: Array<{ label: string, value: number, color: string }>
  /** 项目精力分布数据 */
  projectEffort: ChartData[]
  /** 卡点汇总清单 */
  blockSummary: BlockSummary[]
  i18n: Record<string, string>
}>()

/** 环形图是否存在数据（任一优先级有完成数） */
const hasPriorityData = computed(() => props.priorityDistribution.some((d) => d.value > 0))

/** 环形图数据：label 经 PRIORITY_META 转 i18n 文案（未知优先级原样显示） */
const priorityChartData = computed<ChartData[]>(() =>
  props.priorityDistribution.map((d) => {
    const meta = PRIORITY_META[d.label as keyof typeof PRIORITY_META]
    return {
      label: meta ? props.i18n[meta.labelKey] || d.label : d.label,
      value: d.value,
      color: d.color,
    }
  }),
)

/** 条形图是否存在数据（任一项目有完成数） */
const hasEffortData = computed(() => props.projectEffort.some((d) => d.value > 0))

const effortChartData = computed<ChartData[]>(() => props.projectEffort)

// 环形图选项：紧凑布局，隐藏图例改由小图例自行标注（简单起见显示图例）
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
