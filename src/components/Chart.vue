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
      :options="mergedOptions"
    />
    <Line
      v-else-if="type === 'line' || type === 'area'"
      ref="chartRef"
      :data="lineData"
      :options="mergedOptions"
    />
    <Pie
      v-else-if="type === 'pie'"
      ref="chartRef"
      :data="pieData"
      :options="mergedOptions"
    />
    <Doughnut
      v-else-if="type === 'doughnut'"
      ref="chartRef"
      :data="pieData"
      :options="mergedOptions"
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

export interface ChartData {
  label: string
  value: number
  color?: string
}

export interface ChartOptions {
  showLegend?: boolean
  showGrid?: boolean
  showLabels?: boolean
  showTooltip?: boolean
  animationDuration?: number
  minY?: number
  maxY?: number
  colors?: string[]
}

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
  theme?: "light" | "dark"
}

const props = withDefaults(defineProps<Props>(), {
  type: "bar",
  size: "small",
  loading: false,
  emptyText: "暂无数据",
  theme: "light",
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

const textColor = computed(() =>
  props.theme === "dark" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
)

const gridColor = computed(() =>
  props.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
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
