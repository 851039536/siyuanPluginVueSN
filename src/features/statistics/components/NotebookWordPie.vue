<template>
  <div class="notebook-word-pie">
    <div class="pie-layout">
      <div class="pie-chart-area">
        <svg
          :viewBox="`0 0 ${SIZE} ${SIZE}`"
          class="pie-svg"
        >
          <g :transform="`translate(${SIZE / 2}, ${SIZE / 2})`">
            <path
              v-for="(arc, idx) in pieArcs"
              :key="idx"
              :d="arc.d"
              :fill="arc.color"
              :class="{
                'pie-arc-hover': activeIndex === idx,
                'pie-arc-dim': activeIndex >= 0 && activeIndex !== idx,
              }"
              class="pie-arc"
              @mouseenter="onArcEnter(idx)"
              @mouseleave="onArcLeave"
            />
            <g
              v-if="activeIndex >= 0 && pieArcs[activeIndex]"
              class="pie-center-group"
            >
              <text
                class="pie-center-name"
                text-anchor="middle"
                dy="-0.6em"
              >
                {{ truncateName(pieArcs[activeIndex].name) }}
              </text>
              <text
                class="pie-center-pct"
                text-anchor="middle"
                dy="0.6em"
              >
                {{ pieArcs[activeIndex].percentage }}%
              </text>
              <text
                class="pie-center-words"
                text-anchor="middle"
                dy="1.8em"
              >
                {{ formatNumber(pieArcs[activeIndex].words) }} 字
              </text>
            </g>
          </g>
        </svg>
      </div>
      <div class="pie-legend">
        <div
          v-for="(item, idx) in data"
          :key="idx"
          class="legend-item"
          :class="{ active: activeIndex === idx }"
          @mouseenter="onArcEnter(idx)"
          @mouseleave="onArcLeave"
        >
          <span
            class="legend-color"
            :style="{ background: item.color }"
          ></span>
          <span class="legend-label">{{ item.name }}</span>
          <span class="legend-pct">{{ item.percentage }}%</span>
          <span class="legend-words">{{ formatNumber(item.words) }} 字</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotebookWordStat } from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import { formatNumber } from "../utils"
import { useNotebookHover } from "../composables/useNotebookHover"

interface Props {
  data?: NotebookWordStat[]
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
})

const { hoveredNotebook, onHover } = useNotebookHover()

const SIZE = 160
const RADIUS = 68
const localHover = ref(-1)

// Combine local hover and shared hover
const activeIndex = computed(() => {
  if (localHover.value >= 0) return localHover.value
  if (hoveredNotebook.value) {
    const idx = props.data.findIndex(d => d.name === hoveredNotebook.value)
    if (idx >= 0) return idx
  }
  return -1
})

// Sync to shared state
watch(localHover, (idx) => {
  onHover(idx >= 0 ? props.data[idx]?.name ?? null : null)
})

function onArcEnter(idx: number) {
  localHover.value = idx
}

function onArcLeave() {
  localHover.value = -1
}

function truncateName(name: string): string {
  return name.length > 6 ? name.slice(0, 5) + "…" : name
}

interface PieArc {
  d: string
  color: string
  percentage: number
  name: string
  words: number
}

const pieArcs = computed<PieArc[]>(() => {
  const nonZero = props.data.filter((d) => d.words > 0)
  if (nonZero.length === 0) {
    return [{
      d: describeArc(0, 0, RADIUS, 0, 359.99),
      color: "rgba(var(--b3-theme-on-surface-rgb), 0.1)",
      percentage: 100,
      name: "",
      words: 0,
    }]
  }

  const total = nonZero.reduce((s, d) => s + d.words, 0)
  let startAngle = 0

  return nonZero.map((item) => {
    const percentage = (item.words / total) * 100
    const sweepAngle = (item.words / total) * 360
    const endAngle = startAngle + sweepAngle
    const d = describeArc(0, 0, RADIUS, startAngle, endAngle)
    const result = {
      d,
      color: item.color,
      percentage: Math.round(percentage * 10) / 10,
      name: item.name,
      words: item.words,
    }
    startAngle = endAngle
    return result
  })
})

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = degToRad(startDeg - 90)
  const end = degToRad(endDeg - 90)

  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)

  const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../styles/index.scss" as stats;

.notebook-word-pie {
  padding: 8px 0;
}

.pie-layout {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.pie-chart-area {
  flex-shrink: 0;
  width: 160px;
  height: 160px;
}

.pie-svg {
  width: 100%;
  height: 100%;
}

.pie-arc {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.pie-arc-hover {
  opacity: 0.85;
}

.pie-arc-dim {
  opacity: 0.4;
}

.pie-center-name {
  font-family: $font-body;
  font-size: 11px;
  font-weight: 600;
  fill: var(--b3-theme-on-surface);
}

.pie-center-pct {
  font-family: stats.$font-mono;
  font-size: 16px;
  font-weight: 700;
  fill: var(--b3-theme-primary);
}

.pie-center-words {
  font-family: stats.$font-mono;
  font-size: 9px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.pie-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 160px;
  overflow-y: auto;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  transition: background 0.15s;

  &:hover,
  &.active {
    background: var(--b3-list-hover);
  }
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.legend-pct {
  font-family: stats.$font-mono;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

.legend-words {
  font-family: stats.$font-mono;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  min-width: 48px;
  text-align: right;
}
</style>
