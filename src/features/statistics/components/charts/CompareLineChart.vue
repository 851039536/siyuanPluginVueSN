<!-- 期间对比双折线图：A/B 两个期间的各子时段字数以两条折线叠加对比（A 灰 / B 主色） -->
<template>
  <div class="cmp-line-chart">
    <svg
      class="cmp-line-svg"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- 基线 -->
      <line
        class="cmp-axis"
        :x1="PAD_X"
        :y1="baseY"
        :x2="VIEW_W - PAD_X"
        :y2="baseY"
      />

      <!-- A 期折线（灰） -->
      <polyline
        v-if="geom.aLine"
        class="cmp-line cmp-line-a"
        :points="geom.aLine"
      />
      <!-- B 期折线（主色） -->
      <polyline
        v-if="geom.bLine"
        class="cmp-line cmp-line-b"
        :points="geom.bLine"
      />

      <!-- A 期数据点 -->
      <circle
        v-for="(d, i) in geom.aDots"
        :key="`a-${i}`"
        class="cmp-dot cmp-dot-a"
        :cx="d.x"
        :cy="d.y"
        r="2.2"
      >
        <title>{{ periodALabel }} · {{ d.label }}: {{ formatNumber(d.v) }}</title>
      </circle>
      <!-- B 期数据点 -->
      <circle
        v-for="(d, i) in geom.bDots"
        :key="`b-${i}`"
        class="cmp-dot cmp-dot-b"
        :cx="d.x"
        :cy="d.y"
        r="2.2"
      >
        <title>{{ periodBLabel }} · {{ d.label }}: {{ formatNumber(d.v) }}</title>
      </circle>

      <!-- 稀疏 X 轴标签 -->
      <text
        v-for="(t, i) in geom.xLabels"
        :key="`x-${i}`"
        class="cmp-x-label"
        :x="t.x"
        :y="VIEW_H - 8"
        text-anchor="middle"
      >{{ t.text }}</text>
    </svg>

    <!-- 图例：A=期间A标签，B=期间B标签 -->
    <div class="cmp-legend">
      <span class="cmp-legend-item"><span class="cmp-legend-dot cmp-dot-a-bg"></span>{{ periodALabel }}</span>
      <span class="cmp-legend-item"><span class="cmp-legend-dot cmp-dot-b-bg"></span>{{ periodBLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { formatNumber } from "../../utils"

interface Point {
  label: string
  aWords: number
  bWords: number
}

interface Props {
  points?: Point[]
  periodALabel?: string
  periodBLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  points: () => [],
  periodALabel: "A",
  periodBLabel: "B",
})

// SVG 视图坐标系（等比缩放至容器宽度）
const VIEW_W = 320
const VIEW_H = 120
const PAD_X = 10
const PAD_TOP = 12
const PAD_BOT = 24

const baseY = VIEW_H - PAD_BOT

interface Dot { x: number, y: number, v: number, label: string }

const geom = computed(() => {
  const pts = props.points
  const n = pts.length
  const empty = { aLine: "", bLine: "", aDots: [] as Dot[], bDots: [] as Dot[], xLabels: [] as { x: number, text: string }[] }
  if (n === 0) return empty

  const max = pts.reduce((m, p) => Math.max(m, p.aWords, p.bWords), 0)
  const plotW = VIEW_W - PAD_X * 2
  const plotH = VIEW_H - PAD_TOP - PAD_BOT

  const xAt = (i: number) => (n <= 1 ? VIEW_W / 2 : PAD_X + (i * plotW) / (n - 1))
  const yAt = (v: number) => (max <= 0 ? baseY : PAD_TOP + (1 - v / max) * plotH)

  const aDots: Dot[] = pts.map((p, i) => ({ x: xAt(i), y: yAt(p.aWords), v: p.aWords, label: p.label }))
  const bDots: Dot[] = pts.map((p, i) => ({ x: xAt(i), y: yAt(p.bWords), v: p.bWords, label: p.label }))

  // 稀疏采样 X 轴标签（最多约 6 个，含末位），避免拥挤
  const step = Math.max(1, Math.ceil(n / 6))
  const xLabels: { x: number, text: string }[] = []
  for (let i = 0; i < n; i += step) xLabels.push({ x: xAt(i), text: pts[i].label })
  if ((n - 1) % step !== 0) xLabels.push({ x: xAt(n - 1), text: pts[n - 1].label })

  return {
    aLine: aDots.map((d) => `${d.x},${d.y}`).join(" "),
    bLine: bDots.map((d) => `${d.x},${d.y}`).join(" "),
    aDots,
    bDots,
    xLabels,
  }
})
</script>

<style scoped lang="scss">
@use "../../styles/CompareLineChart.scss";
@use '../../styles/index.scss' as stats;
</style>
