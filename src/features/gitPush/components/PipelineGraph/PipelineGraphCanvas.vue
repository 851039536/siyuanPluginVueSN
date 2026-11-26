<!-- 关系图画布：纯 SVG 渲染（边在下、节点在上），支持缩放/平移/迷你地图，只上报悬停与选中 -->
<template>
  <div
    ref="stageEl"
    class="gpg-stage"
    :class="{ 'is-panning': panning }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click="onBackgroundClick"
  >
    <div
      class="gpg-viewport"
      :style="viewportStyle"
    >
      <svg
        class="gpg-canvas"
        :width="layout.width"
        :height="layout.height"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        role="img"
        :aria-label="i18n.pipelineGraphView"
      >
        <defs>
          <marker
            id="gpg-arrow"
            viewBox="0 0 6 6"
            refX="5.2"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path
              d="M0,0 L6,3 L0,6 Z"
              fill="context-stroke"
            />
          </marker>
        </defs>
        <g class="gpg-edges">
          <path
            v-for="edge in layout.edges"
            :key="edge.id"
            :d="edge.path"
            class="gpg-edge"
            :class="edgeClass(edge)"
            marker-end="url(#gpg-arrow)"
          >
            <title>{{ edgeTitle(edge) }}</title>
          </path>
        </g>
        <g class="gpg-nodes">
          <g
            v-for="node in layout.nodes"
            :key="node.key"
            class="gpg-node"
            :class="[
              `gpg-node--${nodeStatus(node.key)}`,
              {
                'is-dimmed': isDimmed(node.entries),
                'is-selected': selectedKey === node.key,
                'is-replay': playbackKey === node.key,
                'has-failure': Boolean(nodeFailure(node)),
              },
            ]"
            :transform="`translate(${node.x} ${node.y})`"
            tabindex="0"
            role="button"
            :aria-expanded="selectedKey === node.key"
            @pointerdown.stop
            @mouseenter="emitHover(node.entries)"
            @mouseleave="emitHover([])"
            @focus="emitHover(node.entries)"
            @blur="emitHover([])"
            @click.stop="emitSelect(node.key)"
            @keydown.enter.stop.prevent="emitSelect(node.key)"
            @keydown.space.stop.prevent="emitSelect(node.key)"
          >
            <rect
              class="gpg-node-box"
              :width="node.w"
              :height="node.h"
              :rx="6"
            />
            <rect
              v-if="node.categories.length > 0"
              class="gpg-node-cat"
              :class="`gpg-cat--${node.categories[0]}`"
              x="0"
              y="0"
              width="3"
              :height="node.h"
              :rx="1.5"
            />
            <text
              class="gpg-node-label"
              x="10"
              :y="node.h / 2 + 2"
            >{{ stageLabel(node.key) }}</text>

            <!-- 最近一次成功耗时：仅当归属能唯一确定时显示，运行中的进度条优先 -->
            <text
              v-if="lastStageText(node)"
              class="gpg-node-time"
              :x="node.w - 6"
              :y="node.h - 5"
              text-anchor="end"
            >{{ lastStageText(node) }}</text>

            <!-- 最近一次失败：失败节点底部给红色感叹号，耗时让位（成功一次即清除） -->
            <text
              v-if="failureBadge(node)"
              class="gpg-node-fail"
              x="10"
              :y="node.h - 5"
            >!</text>

            <!-- 状态图标：不只用颜色区分状态 -->
            <g
              class="gpg-state"
              :class="`gpg-state--${nodeStatus(node.key)}`"
              :transform="`translate(${node.w - 8} 8)`"
            >
              <path
                v-if="nodeStatus(node.key) === 'done'"
                d="M -2.6 0 L -0.6 2.2 L 3 -2.4"
              />
              <path
                v-else-if="nodeStatus(node.key) === 'fail'"
                d="M -2.4 -2.4 L 2.4 2.4 M 2.4 -2.4 L -2.4 2.4"
              />
              <line
                v-else-if="nodeStatus(node.key) === 'skipped' || nodeStatus(node.key) === 'canceled'"
                x1="-2.6"
                y1="0"
                x2="2.6"
                y2="0"
              />
              <circle
                v-else-if="nodeStatus(node.key) === 'running'"
                r="2.4"
                class="gpg-state-dot"
              />
              <circle
                v-else
                r="2.2"
              />
            </g>

            <!-- 运行中真实进度：未上报 percent 时不画，避免伪造 -->
            <rect
              v-if="hasPercent(node.key)"
              class="gpg-progress-track"
              x="4"
              :y="node.h - 4"
              :width="node.w - 8"
              height="2"
              rx="1"
            />
            <rect
              v-if="hasPercent(node.key)"
              class="gpg-progress-fill"
              x="4"
              :y="node.h - 4"
              :width="progressWidth(node)"
              height="2"
              rx="1"
            />
            <title>{{ nodeTitle(node) }}</title>
          </g>
        </g>
      </svg>
    </div>

    <!-- 视图控制：缩放 / 实际大小 / 适应画布 -->
    <div
      class="gpg-view-controls"
      @pointerdown.stop
      @click.stop
    >
      <button
        type="button"
        class="gpg-view-btn"
        :aria-label="i18n.pipelineGraphZoomOut"
        :title="i18n.pipelineGraphZoomOut"
        @click="zoomStep(1 / 1.15)"
      >
        −
      </button>
      <span class="gpg-zoom-label">{{ zoomLabel }}</span>
      <button
        type="button"
        class="gpg-view-btn"
        :aria-label="i18n.pipelineGraphZoomIn"
        :title="i18n.pipelineGraphZoomIn"
        @click="zoomStep(1.15)"
      >
        +
      </button>
      <button
        type="button"
        class="gpg-view-btn"
        :aria-label="i18n.pipelineGraphResetZoom"
        :title="i18n.pipelineGraphResetZoom"
        @click="resetView"
      >
        1:1
      </button>
      <button
        type="button"
        class="gpg-view-btn gpg-view-btn--text"
        :aria-label="i18n.pipelineGraphFit"
        :title="i18n.pipelineGraphFit"
        @click="fitView"
      >
        {{ i18n.pipelineGraphFit }}
      </button>
    </div>

    <!-- 迷你地图：仅在放大时出现，点击可跳转 -->
    <svg
      v-if="showMinimap"
      class="gpg-minimap"
      :width="MINIMAP_W"
      :height="minimapHeight"
      :aria-label="i18n.pipelineGraphMinimap"
      @pointerdown.stop="onMinimapPointer"
      @click.stop
    >
      <rect
        class="gpg-minimap-bg"
        :width="MINIMAP_W"
        :height="minimapHeight"
        rx="3"
      />
      <rect
        v-for="node in layout.nodes"
        :key="node.key"
        class="gpg-minimap-node"
        :class="`gpg-minimap-node--${nodeStatus(node.key)}`"
        :x="(node.x + VIEW_PAD_X) * minimapScale"
        :y="(node.y + VIEW_PAD_Y) * minimapScale"
        :width="Math.max(2, node.w * minimapScale)"
        :height="Math.max(1.5, node.h * minimapScale)"
        rx="1"
      />
      <rect
        class="gpg-minimap-view"
        :x="viewRect.x"
        :y="viewRect.y"
        :width="viewRect.width"
        :height="viewRect.height"
        rx="1"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import type {
  OpFailureInfo,
  OpFailureMap,
  PipelineStageHistory,
  PipelineStageKey,
  PipelineStatus,
} from "../../types/pipeline"
import { computed, onMounted, onUnmounted, reactive, ref } from "vue"
import { PIPELINE_STAGE_LABEL_KEY } from "../../utils/opPipeline"
import { diagnosePipelineFailure } from "../../utils/pipelineDiagnosis"
import type { GraphEdge, GraphLive, GraphLayout, GraphNode } from "../../utils/pipelineGraph"
import { formatDuration, nodeLastDuration, nodeLastFailure } from "../../utils/pipelineGraph"
import {
  centerTransform,
  clampTransform,
  fitTransform,
  visibleWorldRect,
  zoomAt,
  type ViewTransform,
} from "../../utils/pipelineViewport"

const props = defineProps<{
  layout: GraphLayout
  live: GraphLive
  /** 计划签名 → 最近一次成功耗时（lane 清理后仍保留） */
  history: PipelineStageHistory
  /** 计划签名 → 最近一次失败（成功一次即清除） */
  failures: OpFailureMap
  i18n: Record<string, any>
  /** 入口 id → 展示名，用于节点/边 tooltip 的「经过」列表 */
  entryLabels: Record<string, string>
  /** 当前高亮的入口 id；为空表示不暗淡任何路径 */
  highlight: string[]
  /** 当前选中的阶段（点击节点展开详情） */
  selectedKey: PipelineStageKey | null
  /** 时间线回放推进到的阶段；只做高亮，不改选中态 */
  playbackKey?: PipelineStageKey | null
}>()

const emit = defineEmits<{
  hoverNode: [entryIds: string[]]
  selectNode: [key: PipelineStageKey | null]
}>()

/** 迷你地图宽度（高度按内容比例换算） */
const MINIMAP_W = 140
/** 画布上下/左右留白：内容超出视口时滚到底仍能看到边缘留白，不贴边框 */
const VIEW_PAD_X = 10
const VIEW_PAD_Y = 28
const content = {
  width: props.layout.width + VIEW_PAD_X * 2,
  height: props.layout.height + VIEW_PAD_Y * 2,
}

const stageEl = ref<HTMLElement | null>(null)
const viewport = reactive({ width: 0, height: 0 })
const view = ref<ViewTransform>({ scale: 1, x: 0, y: 0 })
const panning = ref(false)

const viewportStyle = computed(() => ({
  transform: `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
  padding: `${VIEW_PAD_Y}px ${VIEW_PAD_X}px`,
}))
const zoomLabel = computed(() => `${Math.round(view.value.scale * 100)}%`)

const minimapScale = computed(() => MINIMAP_W / content.width)
const minimapHeight = computed(() => Math.max(24, Math.round(content.height * minimapScale.value)))
const showMinimap = computed(() => view.value.scale > 1.01)
const viewRect = computed(() => {
  const rect = visibleWorldRect(view.value, viewport)
  const left = Math.max(0, rect.x)
  const top = Math.max(0, rect.y)
  const right = Math.min(content.width, rect.x + rect.width)
  const bottom = Math.min(content.height, rect.y + rect.height)
  return {
    x: left * minimapScale.value,
    y: top * minimapScale.value,
    width: Math.max(1, (right - left) * minimapScale.value),
    height: Math.max(1, (bottom - top) * minimapScale.value),
  }
})

let observer: ResizeObserver | null = null
let initialized = false
let panActive = false
let suppressClick = false
let panStart = { x: 0, y: 0 }
let panOrigin = { x: 0, y: 0 }

onMounted(() => {
  const el = stageEl.value
  if (!el) return
  measure()
  observer = new ResizeObserver(() => measure())
  observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

function measure(): void {
  const el = stageEl.value
  if (!el) return
  viewport.width = el.clientWidth
  viewport.height = el.clientHeight
  if (!initialized && viewport.width > 0 && viewport.height > 0) {
    initialized = true
    view.value = clampTransform(centerTransform(content, viewport, 1), content, viewport)
    return
  }
  view.value = clampTransform(view.value, content, viewport)
}

function emitHover(entryIds: readonly string[]): void {
  emit("hoverNode", [...entryIds])
}

function emitSelect(key: PipelineStageKey | null): void {
  emit("selectNode", key)
}

// ── 视口交互 ──

function onWheel(event: WheelEvent): void {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    const el = stageEl.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15
    view.value = zoomAt(
      view.value,
      content,
      viewport,
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      factor,
    )
    return
  }

  // 内容超出视口时滚轮滚动画布；没有可滚动方向时交还页面滚动
  const scaledWidth = content.width * view.value.scale
  const scaledHeight = content.height * view.value.scale
  const scrollX = scaledWidth > viewport.width + 0.5 && Math.abs(event.deltaX) > 0
  const scrollY = scaledHeight > viewport.height + 0.5 && Math.abs(event.deltaY) > 0
  if (!scrollX && !scrollY) return
  event.preventDefault()
  view.value = clampTransform(
    {
      scale: view.value.scale,
      x: view.value.x - (scrollX ? event.deltaX : 0),
      y: view.value.y - (scrollY ? event.deltaY : 0),
    },
    content,
    viewport,
  )
}

function onPointerDown(event: PointerEvent): void {
  suppressClick = false
  if (event.button !== 0) return
  panActive = true
  panning.value = true
  panStart = { x: event.clientX, y: event.clientY }
  panOrigin = { x: view.value.x, y: view.value.y }
  stageEl.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!panActive) return
  const dx = event.clientX - panStart.x
  const dy = event.clientY - panStart.y
  if (Math.abs(dx) + Math.abs(dy) > 3) suppressClick = true
  view.value = clampTransform(
    { scale: view.value.scale, x: panOrigin.x + dx, y: panOrigin.y + dy },
    content,
    viewport,
  )
}

function onPointerUp(event: PointerEvent): void {
  if (!panActive) return
  panActive = false
  panning.value = false
  stageEl.value?.releasePointerCapture(event.pointerId)
}

/** 背景点击关闭详情；拖拽平移后的那次 click 不当作点击 */
function onBackgroundClick(): void {
  if (suppressClick) {
    suppressClick = false
    return
  }
  emitSelect(null)
}

function zoomStep(factor: number): void {
  view.value = zoomAt(
    view.value,
    content,
    viewport,
    { x: viewport.width / 2, y: viewport.height / 2 },
    factor,
  )
}

function resetView(): void {
  view.value = clampTransform(centerTransform(content, viewport, 1), content, viewport)
}

function fitView(): void {
  view.value = fitTransform(content, viewport, 8)
}

function onMinimapPointer(event: PointerEvent): void {
  const el = event.currentTarget as SVGSVGElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const worldX = (event.clientX - rect.left) / minimapScale.value
  const worldY = (event.clientY - rect.top) / minimapScale.value
  view.value = clampTransform(
    {
      scale: view.value.scale,
      x: viewport.width / 2 - worldX * view.value.scale,
      y: viewport.height / 2 - worldY * view.value.scale,
    },
    content,
    viewport,
  )
}

// ── 渲染辅助 ──

/** 阶段文案：走 i18n，缺失时回退到「未知阶段」再回退到键名 */
function stageLabel(key: PipelineStageKey): string {
  return props.i18n[PIPELINE_STAGE_LABEL_KEY[key]] ?? props.i18n.pipelineGraphUnknown ?? key
}

function nodeStatus(key: PipelineStageKey): PipelineStatus {
  return props.live.stages.get(key)?.status ?? "pending"
}

function hasPercent(key: PipelineStageKey): boolean {
  const stage = props.live.stages.get(key)
  return stage?.status === "running" && stage.percent !== undefined
}

function progressWidth(node: GraphNode): number {
  const percent = props.live.stages.get(node.key)?.percent ?? 0
  const ratio = Math.min(1, Math.max(0, percent / 100))
  return (node.w - 8) * ratio
}

function isDimmed(entryIds: readonly string[]): boolean {
  return props.highlight.length > 0 && !entryIds.some((id) => props.highlight.includes(id))
}

function edgeClass(edge: GraphEdge): Record<string, boolean> {
  return {
    "is-active": props.live.activeEdgeIds.has(edge.id),
    "is-fail": edge.entries.some((id) => props.live.entries.get(id)?.status === "fail"),
    "is-dimmed": isDimmed(edge.entries),
  }
}

function entryNames(entryIds: readonly string[]): string {
  return entryIds.map((id) => props.entryLabels[id] ?? id).join(" / ")
}

/** 节点最近一次失败；运行中让位实时状态，归属不唯一时宁可不显示 */
function nodeFailure(node: GraphNode): OpFailureInfo | undefined {
  if (nodeStatus(node.key) === "running") return undefined
  return nodeLastFailure(node, props.highlight, props.failures)
}

function failureBadge(node: GraphNode): string {
  return nodeFailure(node) ? "!" : ""
}

/** 节点底部「上次」：失败优先显示红色感叹号，此时不再显示旧的成功耗时 */
function lastStageText(node: GraphNode): string {
  if (nodeStatus(node.key) === "running") return ""
  if (nodeFailure(node)) return ""
  const ms = nodeLastDuration(node, props.highlight, props.history)
  return ms === undefined ? "" : formatDuration(ms)
}

function nodeTitle(node: GraphNode): string {
  const base = `${stageLabel(node.key)} · ${props.i18n.pipelineGraphNodeOps ?? "经过：{0}"}`
    .replace("{0}", entryNames(node.entries))
  const failure = nodeFailure(node)
  if (failure) {
    const diagnosis = diagnosePipelineFailure(failure.detail, props.i18n)
    const label = props.i18n.pipelineGraphNodeFailed ?? "上次运行失败"
    return `${base} · ${label}${diagnosis ? `：${diagnosis.title}` : ""}`
  }
  const last = lastStageText(node)
  if (!last) return base
  return `${base} · ${(props.i18n.pipelineGraphLastStage ?? "上次此阶段耗时 {0}").replace("{0}", last)}`
}

function edgeTitle(edge: GraphEdge): string {
  const from = stageLabel(edge.from)
  const to = stageLabel(edge.to)
  return `${from} → ${to} · ${entryNames(edge.entries)}`
}
</script>

<style lang="scss">
@use "../../styles/PipelineGraph.scss";
</style>
