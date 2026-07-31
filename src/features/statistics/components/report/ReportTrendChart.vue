<!-- 单期报告字数趋势图：各子时段字数以单条折线 + 面积填充呈现，峰值点高亮，新增数走悬浮提示 -->
<template>
  <div class="rt-chart">
    <svg
      class="rt-svg"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- 基线 -->
      <line
        class="rt-axis"
        :x1="PAD_X"
        :y1="baseY"
        :x2="VIEW_W - PAD_X"
        :y2="baseY"
      />

      <!-- 面积填充 -->
      <polygon
        v-if="geom.area"
        class="rt-area"
        :points="geom.area"
      />
      <!-- 折线 -->
      <polyline
        v-if="geom.line"
        class="rt-line"
        :points="geom.line"
      />

      <!-- 数据点（峰值点额外高亮） -->
      <circle
        v-for="(d, i) in geom.dots"
        :key="i"
        class="rt-dot"
        :class="{ 'rt-dot-peak': d.peak }"
        :cx="d.x"
        :cy="d.y"
        :r="d.peak ? 3 : 2.2"
      >
        <title>{{ d.label }}: {{ formatNumber(d.v) }}{{ i18nWordsUnit }}{{ d.created > 0 ? ` · +${d.created}` : '' }}</title>
      </circle>

      <!-- 稀疏 X 轴标签 -->
      <text
        v-for="(t, i) in geom.xLabels"
        :key="`x-${i}`"
        class="rt-x-label"
        :x="t.x"
        :y="VIEW_H - 8"
        text-anchor="middle"
      >{{ t.text }}</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { formatNumber } from "../../utils"

interface Point {
  month: string
  words: number
  created: number
}

interface Props {
  points?: Point[]
  // 悬浮提示中的字数单位后缀（如"字"），由父组件按 i18n 传入
  i18nWordsUnit?: string
}

const props = withDefaults(defineProps<Props>(), {
  points: () => [],
  i18nWordsUnit: "",
})

// SVG 视图坐标系（等比缩放至容器宽度）
const VIEW_W = 320
const VIEW_H = 120
const PAD_X = 10
const PAD_TOP = 12
const PAD_BOT = 24

const baseY = VIEW_H - PAD_BOT

interface Dot { x: number, y: number, v: number, created: number, label: string, peak: boolean }

const geom = computed(() => {
  const pts = props.points
  const n = pts.length
  const empty = { line: "", area: "", dots: [] as Dot[], xLabels: [] as { x: number, text: string }[] }
  if (n === 0) return empty

  const max = pts.reduce((m, p) => Math.max(m, p.words), 0)
  const plotW = VIEW_W - PAD_X * 2
  const plotH = VIEW_H - PAD_TOP - PAD_BOT

  const xAt = (i: number) => (n <= 1 ? VIEW_W / 2 : PAD_X + (i * plotW) / (n - 1))
  const yAt = (v: number) => (max <= 0 ? baseY : PAD_TOP + (1 - v / max) * plotH)

  const dots: Dot[] = pts.map((p, i) => ({
    x: xAt(i),
    y: yAt(p.words),
    v: p.words,
    created: p.created,
    label: p.month,
    peak: max > 0 && p.words === max,
  }))

  const line = dots.map((d) => `${d.x},${d.y}`).join(" ")
  // 面积多边形：折线两端垂直落到基线闭合
  const area = n > 0
    ? `${dots[0].x},${baseY} ${line} ${dots[n - 1].x},${baseY}`
    : ""

  // 稀疏采样 X 轴标签（最多约 6 个，含末位），避免拥挤
  const step = Math.max(1, Math.ceil(n / 6))
  const xLabels: { x: number, text: string }[] = []
  for (let i = 0; i < n; i += step) xLabels.push({ x: xAt(i), text: pts[i].month })
  if ((n - 1) % step !== 0) xLabels.push({ x: xAt(n - 1), text: pts[n - 1].month })

  return { line, area, dots, xLabels }
})
</script>

<style scoped lang="scss">
@use "../../styles/ReportTrendChart.scss";
@use '../../styles/index.scss' as stats;
</style>
