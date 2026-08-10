<!-- 分项评分雷达图：纯 SVG 六轴视图，总览 6 个维度的得分均衡性 -->
<template>
  <div class="review-radar-chart">
    <!-- viewBox 原点在圆心，首轴指向正上方，6 轴等分 360° -->
    <svg
      class="review-radar-svg"
      viewBox="-110 -85 220 170"
      role="img"
      aria-label="分项评分雷达图"
    >
      <!-- 网格层：5/8/10 分档同心多边形 -->
      <polygon
        v-for="ring in gridRings"
        :key="ring.score"
        class="radar-grid-ring"
        :points="ring.points"
      />
      <!-- 轴线：圆心到各轴端点 -->
      <line
        v-for="(axis, i) in axes"
        :key="`axis-${i}`"
        class="radar-axis-line"
        x1="0"
        y1="0"
        :x2="axis.tipX"
        :y2="axis.tipY"
      />
      <!-- 数据区域：按平均分等级着色 -->
      <polygon
        class="radar-data-area"
        :class="`level-${dataLevel}`"
        :points="dataPolygon"
      />
      <!-- 数据点圆标记 + 分数标注 -->
      <g
        v-for="entry in dataEntries"
        :key="entry.key"
      >
        <circle
          class="radar-data-dot"
          :class="`level-${entry.level}`"
          :cx="entry.x"
          :cy="entry.y"
          r="2.5"
        />
        <text
          class="radar-score-label"
          :class="`level-${entry.level}`"
          :x="entry.scoreX"
          :y="entry.scoreY"
          :text-anchor="entry.scoreAnchor"
          :dominant-baseline="entry.scoreBaseline"
        >{{ entry.value }}</text>
      </g>
      <!-- 轴端点维度标签 -->
      <text
        v-for="label in axisLabels"
        :key="label.text"
        class="radar-axis-label"
        :x="label.x"
        :y="label.y"
        :text-anchor="label.anchor"
        :dominant-baseline="label.baseline"
      >{{ label.text }}</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

/** 六个评分维度的固定顺序（与 @/types/ai detailedScore 字段一致），保证数据与轴一一对应 */
const SCORE_KEYS = ["accuracy", "structure", "quality", "format", "coverage", "titleQuality"] as const

// 几何常量（viewBox 以圆心为原点）
const MAX_RADIUS = 50 // 满分 10 分对应的半径
const AXIS_LABEL_OFFSET = 18 // 轴标签相对数据区外缘的偏移
const SCORE_LABEL_OFFSET = 6 // 分数标签相对数据点的外偏
const START_ANGLE = -90 // 首轴指向正上方（度）
const ANGLE_STEP = 360 / SCORE_KEYS.length // 60°
const ANCHOR_COS_THRESHOLD = 0.3 // |cos|<该值时视为垂直轴，标签水平居中
const BASELINE_SIN_THRESHOLD = 0.35 // |sin|<该值时视为水平轴，标签垂直居中

interface Props {
  scores?: Record<string, number>
  labels: Record<string, string>
  getLevel: (value: number) => string
}

const props = defineProps<Props>()

const fmt = (n: number): string => n.toFixed(2)

/** 沿轴方向取半径 r 处的点坐标 */
const pointAt = (axis: { cos: number; sin: number }, r: number): [number, number] => [
  axis.cos * r,
  axis.sin * r,
]

/** 文字水平锚点：垂直轴居中，右侧左对齐，左侧右对齐 */
function anchorByCos(cos: number): string {
  if (Math.abs(cos) < ANCHOR_COS_THRESHOLD) return "middle"
  return cos > 0 ? "start" : "end"
}

/** 分数标注使用反向锚点：向圆心一侧展开，避免与轴端点标签重叠 */
function scoreAnchorByCos(cos: number): string {
  if (Math.abs(cos) < ANCHOR_COS_THRESHOLD) return "middle"
  return cos > 0 ? "end" : "start"
}

/** 文字垂直锚点：顶部轴用基线，底部轴用悬挂基线，水平轴垂直居中 */
function baselineBySin(sin: number): string {
  if (Math.abs(sin) < BASELINE_SIN_THRESHOLD) return "middle"
  return sin > 0 ? "hanging" : "auto"
}

/** 各轴单位方向矢量与端点坐标 */
const axes = computed(() =>
  SCORE_KEYS.map((_, i) => {
    const rad = ((START_ANGLE + i * ANGLE_STEP) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const [tipX, tipY] = pointAt({ cos, sin }, MAX_RADIUS)
    return { cos, sin, tipX: fmt(tipX), tipY: fmt(tipY) }
  }),
)

/** 3 层同心网格多边形（5/8/10 分档位） */
const gridRings = computed(() =>
  [5, 8, 10].map((score) => {
    const r = (MAX_RADIUS * score) / 10
    const points = axes.value
      .map((axis) => {
        const [x, y] = pointAt(axis, r)
        return `${fmt(x)},${fmt(y)}`
      })
      .join(" ")
    return { score, points }
  }),
)

/** 各轴数据点：坐标 / 等级 / 分数标注位置 */
const dataEntries = computed(() => {
  const scores = props.scores ?? {}
  return SCORE_KEYS.map((key, i) => {
    const axis = axes.value[i]
    const value = scores[key] ?? 0
    const r = (MAX_RADIUS * value) / 10
    const [x, y] = pointAt(axis, r)
    const [scoreX, scoreY] = pointAt(axis, r + SCORE_LABEL_OFFSET)
    return {
      key,
      value,
      level: props.getLevel(value),
      x: fmt(x),
      y: fmt(y),
      scoreX: fmt(scoreX),
      scoreY: fmt(scoreY),
      scoreAnchor: scoreAnchorByCos(axis.cos),
      scoreBaseline: baselineBySin(axis.sin),
    }
  })
})

/** 数据区域多边形顶点串 */
const dataPolygon = computed(() =>
  dataEntries.value.map((entry) => `${entry.x},${entry.y}`).join(" "),
)

/** 平均分等级（决定数据区域整体颜色） */
const dataLevel = computed(() => {
  const avg =
    dataEntries.value.reduce((sum, entry) => sum + entry.value, 0) / dataEntries.value.length
  return props.getLevel(avg)
})

/** 轴端点维度标签（在数据区外缘偏移放置，按方向调整锚点） */
const axisLabels = computed(() =>
  SCORE_KEYS.map((key, i) => {
    const axis = axes.value[i]
    const r = MAX_RADIUS + AXIS_LABEL_OFFSET
    const [x, y] = pointAt(axis, r)
    return {
      text: props.labels[key] ?? key,
      x: fmt(x),
      y: fmt(y),
      anchor: anchorByCos(axis.cos),
      baseline: baselineBySin(axis.sin),
    }
  }),
)
</script>

<style scoped lang="scss">
@use "../styles/ReviewRadarChart.scss" as *;
@use "../styles/index.scss" as *;
</style>
