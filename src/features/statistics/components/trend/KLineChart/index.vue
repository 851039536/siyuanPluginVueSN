<!-- K 线图（蜡烛图）：历史快照指标按日绘制，实体=开盘/收盘、影线=最高/最低，叠加收盘 7 日均线 -->
<template>
  <div class="kline-chart">
    <!-- 图例：涨/跌/平色块 + 7 日均线 + 近似数据提示 -->
    <div class="kline-legend">
      <span class="kline-legend-item">
        <span class="kline-legend-dot kline-legend-dot--up" />
        <!-- 图例文案："涨" -->
        {{ i18n.klineUp }}
      </span>
      <span class="kline-legend-item">
        <span class="kline-legend-dot kline-legend-dot--down" />
        <!-- 图例文案："跌" -->
        {{ i18n.klineDown }}
      </span>
      <span class="kline-legend-item">
        <span class="kline-legend-dot kline-legend-dot--flat" />
        <!-- 图例文案："平" -->
        {{ i18n.klineFlat }}
      </span>
      <span class="kline-legend-item">
        <span class="kline-legend-line" />
        <!-- 图例文案："7日均线" -->
        {{ i18n.klineMa7 }}
      </span>
      <!-- 近似提示：存在无日内采样的历史日时显示 -->
      <span
        v-if="hasApprox"
        class="kline-legend-approx"
      >{{ i18n.klineApproxHint }}</span>
    </div>

    <!-- K 线图（chart.js 浮动条 + 影线插件；外层滚动容器保证日期多时可横向滑动；
         挂载/卸载由父组件模式分支控制，切走折线模式即销毁 canvas） -->
    <div class="kline-chart-scroll">
      <div
        class="kline-chart-wrap"
        :style="{ minWidth: `${minChartWidth}px` }"
      >
        <Bar
          :data="barData"
          :options="chartOptions"
          :plugins="chartPlugins"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// K 线图组件：历史快照 → 蜡烛序列 → chart.js 浮动条渲染（数据/配置/插件见 chartConfig 模块）
import type { Plugin } from "chart.js"
import type { HistoricalDataItem } from "../../../types"
import type { KLineMetric } from "../../../types/storage"
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
import { computed } from "vue"
import { buildStatCandles } from "../../../utils/candlestick"
import {
  buildStatCandleChartData,
  buildStatCandleChartOptions,
  createStatWickPlugin,
  MIN_WIDTH_PER_CANDLE,
} from "./chartConfig"

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip)

interface Props {
  historicalData: HistoricalDataItem[]
  /** K 线主体指标（仅支持累计型指标） */
  metric: KLineMetric
  i18n: Record<string, any>
}

const props = defineProps<Props>()

/** 蜡烛序列（按日历升序构建，超过上限时仅保留最近日期，构建细节见 candlestick 模块） */
const ascendingCandles = computed(() => buildStatCandles(props.historicalData, props.metric))

/** 显示顺序：最新日期在左（与趋势折线图方向一致） */
const candles = computed(() => [...ascendingCandles.value].reverse())

/** 是否存在近似蜡烛（无日内采样的历史日） */
const hasApprox = computed(() => candles.value.some((c) => c.approx))

/** 图表最小宽度（px）：蜡烛根数 × 每根占地宽，超出容器宽度时横向滚动 */
const minChartWidth = computed(() => candles.value.length * MIN_WIDTH_PER_CANDLE)

/** chart.js 数据集（浮动条实体 + 7 日均线折线） */
const barData = computed(() => buildStatCandleChartData(candles.value))

/** chart.js 配置（单 y 轴指标数值 + tooltip OHLC） */
const chartOptions = computed(() => buildStatCandleChartOptions(candles.value, props.i18n))

/**
 * K 线影线插件数组。
 * 该 computed 读取不到任何响应式依赖，只会求值一次并常驻缓存，
 * 因此传给 vue-chartjs 的 plugins 数组引用稳定，不会触发图表重建。
 */
const chartPlugins = computed<Plugin[]>(() => [createStatWickPlugin()])
</script>

<style scoped lang="scss">
@use "../../../styles/KLineChart.scss";
@use "../../../styles/index.scss" as stats;
</style>
