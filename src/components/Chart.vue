<template>
  <div
    ref="containerRef"
    :class="chartClasses"
    :style="chartStyle"
  >
    <canvas ref="canvasRef" />
    <div
      v-if="loading"
      class="si-chart__loading"
    >
      <div class="si-chart__spinner"></div>
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
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"

type ChartType = "line" | "bar" | "pie" | "doughnut" | "area"
type ChartSize = "small" | "medium" | "large" | "full"

export interface ChartData {
  label: string
  value: number
  color?: string
}

export interface ChartOptions {
  /** 是否显示图例 */
  showLegend?: boolean
  /** 是否显示网格线 */
  showGrid?: boolean
  /** 是否显示数值标签 */
  showLabels?: boolean
  /** 是否显示工具提示 */
  showTooltip?: boolean
  /** 动画持续时间（毫秒） */
  animationDuration?: number
  /** Y轴最小值 */
  minY?: number
  /** Y轴最大值 */
  maxY?: number
  /** 颜色列表 */
  colors?: string[]
}

interface Props {
  /** 图表类型 */
  type?: ChartType
  /** 图表数据 */
  data: ChartData[]
  /** 图表尺寸 */
  size?: ChartSize
  /** 图表标题 */
  title?: string
  /** 宽度 */
  width?: number | string
  /** 高度 */
  height?: number
  /** 是否加载中 */
  loading?: boolean
  /** 空状态文本 */
  emptyText?: string
  /** 图表选项 */
  options?: ChartOptions
  /** 主题 */
  theme?: "light" | "dark"
}

const props = withDefaults(defineProps<Props>(), {
  type: "bar",
  size: "medium",
  loading: false,
  emptyText: "暂无数据",
  theme: "light",
  options: () => ({}),
})

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const animationFrameId = ref<number>()

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
    style.width =
      typeof props.width === "number" ? `${props.width}px` : props.width
  }
  if (props.height) {
    style.height = `${props.height}px`
  }
  return style
})

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

// 绘制图表
const drawChart = () => {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container || !hasData.value) return

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  // 设置 canvas 尺寸
  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  ctx.scale(dpr, dpr)

  // 清空画布
  ctx.clearRect(0, 0, rect.width, rect.height)

  // 根据类型绘制图表
  switch (props.type) {
    case "line":
      drawLineChart(ctx, rect.width, rect.height)
      break
    case "bar":
      drawBarChart(ctx, rect.width, rect.height)
      break
    case "pie":
      drawPieChart(ctx, rect.width, rect.height, false)
      break
    case "doughnut":
      drawPieChart(ctx, rect.width, rect.height, true)
      break
    case "area":
      drawAreaChart(ctx, rect.width, rect.height)
      break
  }
}

// 绘制折线图
const drawLineChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const maxValue = Math.max(
    ...props.data.map((d) => d.value),
    props.options?.maxY || 0,
  )
  const minValue = props.options?.minY || 0
  const valueRange = maxValue - minValue || 1

  // 绘制网格线
  if (props.options?.showGrid !== false) {
    ctx.strokeStyle =
      props.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }
  }

  // 绘制折线
  ctx.beginPath()
  ctx.strokeStyle = getColor(0)
  ctx.lineWidth = 2

  const points: { x: number, y: number }[] = []

  props.data.forEach((item, index) => {
    const x = padding + (chartWidth / (props.data.length - 1 || 1)) * index
    const y =
      padding
      + chartHeight
      - ((item.value - minValue) / valueRange) * chartHeight
    points.push({
      x,
      y,
    })

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()

  // 绘制数据点
  points.forEach((point, index) => {
    ctx.beginPath()
    ctx.fillStyle = getColor(index)
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
    ctx.fill()

    // 绘制数值标签
    if (props.options?.showLabels) {
      ctx.fillStyle = props.theme === "dark" ? "#fff" : "#333"
      ctx.font = "11px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(props.data[index].value.toString(), point.x, point.y - 10)
    }
  })

  // 绘制 X 轴标签
  if (chartWidth / props.data.length > 40) {
    ctx.fillStyle =
      props.theme === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)"
    ctx.font = "11px sans-serif"
    ctx.textAlign = "center"

    props.data.forEach((item, index) => {
      const x = padding + (chartWidth / (props.data.length - 1 || 1)) * index
      ctx.save()
      ctx.translate(x, height - padding + 15)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(item.label, 0, 0)
      ctx.restore()
    })
  }
}

// 绘制柱状图
const drawBarChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const maxValue = Math.max(
    ...props.data.map((d) => d.value),
    props.options?.maxY || 0,
  )
  const minValue = props.options?.minY || 0
  const valueRange = maxValue - minValue || 1

  const barWidth = (chartWidth / props.data.length) * 0.7
  const barGap = (chartWidth / props.data.length) * 0.3

  // 绘制网格线
  if (props.options?.showGrid !== false) {
    ctx.strokeStyle =
      props.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }
  }

  // 绘制柱子
  props.data.forEach((item, index) => {
    const x = padding + (barWidth + barGap) * index + barGap / 2
    const barHeight = ((item.value - minValue) / valueRange) * chartHeight
    const y = padding + chartHeight - barHeight

    // 绘制柱子
    ctx.fillStyle = getColor(index)
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0])
    ctx.fill()

    // 绘制数值标签
    if (props.options?.showLabels) {
      ctx.fillStyle = props.theme === "dark" ? "#fff" : "#333"
      ctx.font = "11px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(item.value.toString(), x + barWidth / 2, y - 5)
    }

    // 绘制 X 轴标签
    if (chartWidth / props.data.length > 40) {
      ctx.fillStyle =
        props.theme === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)"
      ctx.font = "11px sans-serif"
      ctx.textAlign = "center"
      ctx.save()
      ctx.translate(x + barWidth / 2, height - padding + 15)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(item.label, 0, 0)
      ctx.restore()
    }
  })
}

// 绘制饼图/环形图
const drawPieChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDoughnut: boolean,
) => {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2 - 20
  const innerRadius = isDoughnut ? radius * 0.6 : 0
  const total = props.data.reduce((sum, item) => sum + item.value, 0)

  let startAngle = -Math.PI / 2

  props.data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * Math.PI * 2
    const endAngle = startAngle + sliceAngle

    // 绘制扇形
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)

    if (isDoughnut) {
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true)
    } else {
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    }

    ctx.closePath()
    ctx.fillStyle = getColor(index)
    ctx.fill()

    // 绘制数值标签
    if (props.options?.showLabels && sliceAngle > 0.2) {
      const labelAngle = startAngle + sliceAngle / 2
      const labelRadius = isDoughnut
        ? (radius + innerRadius) / 2
        : radius * 0.7
      const labelX = centerX + Math.cos(labelAngle) * labelRadius
      const labelY = centerY + Math.sin(labelAngle) * labelRadius

      ctx.fillStyle = "#fff"
      ctx.font = "bold 12px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const percentage = ((item.value / total) * 100).toFixed(1)
      ctx.fillText(`${percentage}%`, labelX, labelY)
    }

    startAngle = endAngle
  })
}

// 绘制面积图
const drawAreaChart = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const maxValue = Math.max(
    ...props.data.map((d) => d.value),
    props.options?.maxY || 0,
  )
  const minValue = props.options?.minY || 0
  const valueRange = maxValue - minValue || 1

  // 绘制网格线
  if (props.options?.showGrid !== false) {
    ctx.strokeStyle =
      props.theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }
  }

  // 绘制面积
  ctx.beginPath()
  ctx.fillStyle = `${getColor(0)}40` // 添加透明度

  props.data.forEach((item, index) => {
    const x = padding + (chartWidth / (props.data.length - 1 || 1)) * index
    const y =
      padding
      + chartHeight
      - ((item.value - minValue) / valueRange) * chartHeight

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  // 闭合路径到底部
  ctx.lineTo(padding + chartWidth, padding + chartHeight)
  ctx.lineTo(padding, padding + chartHeight)
  ctx.closePath()
  ctx.fill()

  // 绘制折线
  drawLineChart(ctx, width, height)
}

// 观察数据变化
watch(
  () => [props.data, props.type, props.theme],
  () => {
    nextTick(() => {
      drawChart()
    })
  },
  { deep: true },
)

// 监听尺寸变化
const resizeObserver = new ResizeObserver(() => {
  drawChart()
})

onMounted(() => {
  drawChart()
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
  resizeObserver.disconnect()
})
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-chart {
  position: relative;
  display: inline-block;
  background: var(--b3-theme-background, $brand-light);
  border-radius: $radius-md;
  overflow: hidden;

  // 尺寸变体
  &--small {
    width: 200px;
    height: 150px;
  }

  &--medium {
    width: 400px;
    height: 300px;
  }

  &--large {
    width: 600px;
    height: 400px;
  }

  &--full {
    width: 100%;
    height: 100%;
    min-height: 300px;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  // 加载状态
  &__loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--b3-theme-background-rgb, 255, 255, 255), 0.9);
    z-index: 10;
  }

  &__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--b3-theme-surface-lighter, $brand-light-gray);
    border-top-color: var(--b3-theme-primary, $brand-orange);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  // 空状态
  &__empty {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    font-family: $font-body;
    font-size: $font-size-sm;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
