<template>
  <div
    ref="containerRef"
    :class="chartClasses"
    :style="chartStyle"
  >
    <Bar
      v-if="type === 'bar'"
      ref="chartRef"
      :data="barData"
      :options="mergedOptions as ChartJsOptions<'bar'>"
    />
    <Line
      v-else-if="type === 'line' || type === 'area'"
      ref="chartRef"
      :data="lineData"
      :options="mergedOptions as ChartJsOptions<'line'>"
    />
    <Pie
      v-else-if="type === 'pie'"
      ref="chartRef"
      :data="pieData as ChartJsData<'pie'>"
      :options="mergedOptions as ChartJsOptions<'pie'>"
    />
    <Doughnut
      v-else-if="type === 'doughnut'"
      ref="chartRef"
      :data="pieData as ChartJsData<'doughnut'>"
      :options="mergedOptions as ChartJsOptions<'doughnut'>"
    />
    <div
      v-if="loading"
      class="si-chart__loading"
    >
      <div class="si-chart__spinner" />
    </div>
    <div
      v-if="!loading && !hasData"
      class="si-chart__empty"
    >
      <slot name="empty">
        <p>{{ emptyText }}</p>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  ChartData as ChartJsData,
  ChartOptions as ChartJsOptions,
} from "chart.js"
import type { ChartData, ChartOptions } from "./chart.types"
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from "chart.js"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import {
  Bar,
  Doughnut,
  Line,
  Pie,
} from "vue-chartjs"

type ChartType = "line" | "bar" | "pie" | "doughnut" | "area"
type ChartSize = "xsmall" | "small" | "medium" | "large" | "full"

// 类型定义迁移至 ./chart.types.ts，保留 re-export 兼容既有导入路径
export type { ChartData, ChartOptions }

interface Props {
  type?: ChartType
  data: ChartData[]
  size?: ChartSize
  title?: string
  width?: number | string
  height?: number
  loading?: boolean
  emptyText?: string
  options?: ChartOptions
  /** 主题：auto = 跟随思源当前明暗模式（默认），light/dark = 强制指定 */
  theme?: "light" | "dark" | "auto"
}

const props = withDefaults(defineProps<Props>(), {
  type: "bar",
  size: "small",
  loading: false,
  emptyText: "暂无数据",
  theme: "auto",
  options: () => ({}),
})

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  ArcElement,
  PieController,
  DoughnutController,
  Tooltip,
  Legend,
  Filler,
)

const containerRef = ref<HTMLDivElement>()
const chartRef = ref()

const hasData = computed(() => props.data && props.data.length > 0)

const defaultColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
]

const getColors = () => props.options?.colors || defaultColors

const getColor = (index: number) => {
  const colors = getColors()
  return props.data[index]?.color || colors[index % colors.length]
}

const chartClasses = computed(() => [
  "si-chart",
  `si-chart--${props.size}`,
  `si-chart--${props.type}`,
  {
    "si-chart--loading": props.loading,
    "si-chart--empty": !props.loading && !hasData.value,
  },
])

const chartStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) {
    style.width = typeof props.width === "number" ? `${props.width}px` : props.width
  }
  if (props.height) {
    style.height = `${props.height}px`
  }
  return style
})

/** 检测思源当前是否暗色模式（data-theme-mode / 主题 class 三重判定，与 themeColor 模块一致） */
function isSiYuanDarkMode(): boolean {
  const html = document.documentElement
  return html.getAttribute("data-theme-mode") === "dark"
    || html.classList.contains("theme-dark")
    || html.classList.contains("b3-theme-dark")
}

/** 主题切换 tick（MutationObserver 触发递增，驱动 isDark 重算实现图表配色实时跟随主题） */
const themeTick = ref(0)
let themeObserver: MutationObserver | null = null

onMounted(() => {
  themeObserver = new MutationObserver(() => {
    themeTick.value++
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-mode", "class"],
  })
})

onUnmounted(() => {
  themeObserver?.disconnect()
  themeObserver = null
})

/** 实际生效的暗色判定（auto 跟随思源模式，light/dark 强制指定） */
const isDark = computed(() => {
  void themeTick.value // 主题切换时触发重算
  if (props.theme === "auto") return isSiYuanDarkMode()
  return props.theme === "dark"
})

const textColor = computed(() =>
  isDark.value ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
)

const gridColor = computed(() =>
  isDark.value ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
)

const baseOptions = computed<ChartJsOptions>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: props.options?.animationDuration ?? 800,
  },
  plugins: {
    legend: {
      display: props.options?.showLegend ?? (props.type === "pie" || props.type === "doughnut"),
      labels: { color: textColor.value },
    },
    tooltip: {
      enabled: props.options?.showTooltip !== false,
    },
  },
}))

const mergedOptions = computed(() => {
  const base = baseOptions.value

  if (props.type === "bar" || props.type === "line" || props.type === "area") {
    return {
      ...base,
      scales: {
        x: {
          ticks: { color: textColor.value },
          grid: {
            display: props.options?.showGrid !== false,
            color: gridColor.value,
          },
        },
        y: {
          min: props.options?.minY,
          max: props.options?.maxY,
          ticks: { color: textColor.value },
          grid: {
            display: props.options?.showGrid !== false,
            color: gridColor.value,
          },
        },
      },
    } as ChartJsOptions
  }

  return base
})

const barData = computed<ChartJsData<"bar">>(() => ({
  labels: props.data.map((d) => d.label),
  datasets: [{
    data: props.data.map((d) => d.value),
    backgroundColor: props.data.map((_, i) => getColor(i)),
    borderRadius: 4,
  }],
}))

const lineData = computed<ChartJsData<"line">>(() => ({
  labels: props.data.map((d) => d.label),
  datasets: [{
    data: props.data.map((d) => d.value),
    borderColor: getColor(0),
    backgroundColor: props.type === "area" ? `${getColor(0)}40` : undefined,
    fill: props.type === "area",
    tension: 0.3,
    pointBackgroundColor: props.data.map((_, i) => getColor(i)),
    pointRadius: 4,
  }],
}))

const pieData = computed<ChartJsData<"pie" | "doughnut">>(() => ({
  labels: props.data.map((d) => d.label),
  datasets: [{
    data: props.data.map((d) => d.value),
    backgroundColor: props.data.map((_, i) => getColor(i)),
  }],
}))
</script>

<style scoped lang="scss">
@use './styles/Chart.scss';
</style>
