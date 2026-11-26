<!-- 流水线关系图：静态阶段网络 + 运行中操作实时高亮（只展示真实阶段，不伪造进度） -->
<template>
  <div class="gpg-panel">
    <header class="gpg-head">
      <div class="gpg-title">
        <Icon
          icon="mdi:graph-outline"
          height="14"
        />
        <span>{{ i18n.pipelineGraphView }}</span>
      </div>
      <p class="gpg-hint">
        {{ i18n.pipelineGraphHint }}
      </p>
    </header>

    <PipelineGraphCanvas
      :layout="layout"
      :live="live"
      :history="history"
      :failures="failures"
      :playback-key="replayKey"
      :i18n="i18n"
      :entry-labels="entryLabels"
      :highlight="effectiveHighlight"
      :selected-key="selectedNodeKey"
      @hover-node="onHoverEntries"
      @select-node="onSelectNode"
    />

    <section
      v-if="selectedNode"
      class="gpg-detail"
    >
      <div class="gpg-detail-head">
        <span class="gpg-detail-title">{{ stageLabel(selectedNode.key) }}</span>
        <span
          class="gpg-detail-status"
          :class="`is-${selectedStageStatus}`"
        >{{ nodeSummary(selectedNode.key) }}</span>
        <button
          type="button"
          class="gpg-detail-close"
          :aria-label="i18n.pipelineGraphClose"
          @click="selectedNodeKey = null"
        >
          ×
        </button>
      </div>
      <div
        v-if="selectedFailure"
        class="gpg-detail-fail"
      >
        <div class="gpg-detail-row">
          <span class="gpg-detail-label">{{ i18n.pipelineGraphDiagTitle }}</span>
          <span class="gpg-fail-title">{{ selectedDiagnosis?.title }}</span>
        </div>
        <p
          v-if="selectedDiagnosis?.hint"
          class="gpg-doc-hint"
        >
          {{ selectedDiagnosis.hint }}
        </p>
        <div class="gpg-doc-row">
          <span class="gpg-detail-label">{{ i18n.pipelineGraphDiagRaw }}</span>
          <code class="gpg-doc-code">{{ selectedFailure.detail }}</code>
        </div>
      </div>
      <div
        v-if="stageDoc"
        class="gpg-detail-doc"
      >
        <p class="gpg-doc-what">
          {{ stageDoc.what }}
        </p>
        <div
          v-if="stageDoc.cmd"
          class="gpg-doc-row"
        >
          <span class="gpg-detail-label">{{ i18n.pipelineGraphDocCmd }}</span>
          <code class="gpg-doc-code">{{ stageDoc.cmd }}</code>
        </div>
        <div
          v-if="stageDoc.pitfall"
          class="gpg-doc-row"
        >
          <span class="gpg-detail-label">{{ i18n.pipelineGraphDocPitfall }}</span>
          <span class="gpg-doc-text">{{ stageDoc.pitfall }}</span>
        </div>
      </div>
      <div class="gpg-detail-row">
        <span class="gpg-detail-label">{{ i18n.pipelineGraphDetailOps }} · {{ selectedNode.entries.length }}</span>
        <div class="gpg-detail-ops">
          <span
            v-for="entryId in selectedNode.entries"
            :key="entryId"
            class="gpg-detail-op"
            :class="`gpg-detail-op--${entryStatus(entryId)}`"
          >
            <span
              class="gpg-chip-dot"
              :class="`gpg-status-dot--${entryStatus(entryId)}`"
              aria-hidden="true"
            />
            {{ entryLabels[entryId] }}<template v-if="runningSummary(entryId)"> · {{ runningSummary(entryId) }}</template><template v-else-if="lastStageText(entryId)"> · {{ lastStageText(entryId) }}</template>
          </span>
        </div>
      </div>
      <div
        v-if="selectedStage && (selectedStage.detail || selectedStage.status === 'running')"
        class="gpg-detail-output"
      >
        <span class="gpg-detail-label">{{ i18n.pipelineGraphDetailOutput }}</span>
        <code :title="selectedStage.detail">{{ selectedStage.detail || i18n.pipelineGraphNoOutput }}</code>
      </div>
    </section>

    <div class="gpg-info-row">
      <p
        class="gpg-info"
        aria-live="polite"
      >
        {{ infoText }}
      </p>
      <button
        v-if="lockedEntries.length > 0"
        type="button"
        class="gpg-clear"
        @click="clearLocks"
      >
        {{ clearLockText }}
      </button>
    </div>

    <!-- 最近运行时间线：甘特对比 + 逐阶段回放（回放只在画布高亮，不改选中） -->
    <PipelineTimeline
      :i18n="i18n"
      :history="history"
      :highlight="effectiveHighlight"
      @replay="onReplay"
      @select-node="onSelectNode"
    />

    <section
      class="gpg-legend"
      :aria-label="i18n.pipelineGraphView"
    >
      <div
        v-for="group in legendGroups"
        :key="group.category"
        class="gpg-legend-group"
      >
        <h4 class="gpg-legend-title">
          {{ i18n[group.labelKey] }}
        </h4>
        <div class="gpg-legend-items">
          <button
            v-for="entry in group.entries"
            :key="entry.id"
            type="button"
            class="gpg-chip"
            :class="[
              `gpg-chip--${entryStatus(entry.id)}`,
              {
                'is-locked': lockedEntries.includes(entry.id),
                'is-hovered': hoveredEntries.includes(entry.id),
              },
            ]"
            @click="toggleLock(entry.id)"
            @mouseenter="onHoverEntries([entry.id])"
            @mouseleave="onHoverEntries([])"
            @focus="onHoverEntries([entry.id])"
            @blur="onHoverEntries([])"
          >
            <span
              class="gpg-chip-dot"
              aria-hidden="true"
            />
            <span class="gpg-chip-label">{{ entryLabels[entry.id] }}</span>
            <span
              v-if="chipStageText(entry.id)"
              class="gpg-chip-stage"
            >{{ chipStageText(entry.id) }}</span>
            <span
              v-if="entryFailure(entry.id)"
              class="gpg-chip-fail"
              :title="entryFailureTitle(entry.id)"
            >!</span>
            <span
              v-if="entryTotalText(entry.id)"
              class="gpg-chip-total"
              :title="entryTotalTitle(entry.id)"
            >{{ entryTotalText(entry.id) }}</span>
            <span
              v-if="laneCount(entry.id) > 1"
              class="gpg-chip-count"
            >×{{ laneCount(entry.id) }}</span>
          </button>
        </div>
      </div>
    </section>

    <div class="gpg-status-legend">
      <span
        v-for="status in STATUS_LEGEND"
        :key="status"
        class="gpg-status-item"
      >
        <span
          class="gpg-status-dot"
          :class="`gpg-status-dot--${status}`"
          aria-hidden="true"
        />
        {{ i18n[STATUS_LABEL_KEY[status]] }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  OpFailureInfo,
  OpFailureMap,
  OpPipelineLane,
  PipelineStageHistory,
  PipelineStageKey,
  PipelineStatus,
} from "../../types/pipeline"
import { Icon } from "@iconify/vue"
import { computed, onMounted, onUnmounted, ref } from "vue"
import { TimerRegistry } from "@/utils/timerRegistry"
import { fmtTemplate } from "../../utils/i18nFormat"
import { PIPELINE_STAGE_LABEL_KEY } from "../../utils/opPipeline"
import { diagnosePipelineFailure } from "../../utils/pipelineDiagnosis"
import {
  buildPipelineGraphLive,
  entryLastFailure,
  entryLastTotal,
  formatDuration,
  GRAPH_CATEGORY_LABEL_KEY,
  GRAPH_CATEGORY_ORDER,
  nodeLastDuration,
  nodeLastFailure,
  PIPELINE_GRAPH_ENTRIES,
  PIPELINE_GRAPH_LAYOUT,
} from "../../utils/pipelineGraph"
import { resolveStageDoc } from "../../utils/stageDocs"
import PipelineGraphCanvas from "./PipelineGraphCanvas.vue"
import PipelineTimeline from "./PipelineTimeline.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全量可见 lane（项目 lane + 全局 lane），由面板统一传入 */
  lanes: OpPipelineLane[]
  /** 计划签名 → 最近一次成功耗时（lane 清理后仍保留） */
  history: PipelineStageHistory
  /** 计划签名 → 最近一次失败（成功一次即清除） */
  failures: OpFailureMap
}>()

const layout = PIPELINE_GRAPH_LAYOUT

/** 每秒刷新运行中阶段耗时；卸载即清理 */
const timers = new TimerRegistry()
const now = ref(Date.now())
onMounted(() => timers.setInterval(() => { now.value = Date.now() }, 1000))
onUnmounted(() => timers.clearAll())

const live = computed(() => buildPipelineGraphLive(props.lanes))

/** 当前悬停的入口 id（节点悬停可同时高亮多个入口，离开即清空） */
const hoveredEntries = ref<string[]>([])
/** 常驻锁定的入口 id：点击图例切换，可多选叠加，锁定期间优先于悬停高亮 */
const lockedEntries = ref<string[]>([])
/** 展开详情的阶段节点 */
const selectedNodeKey = ref<PipelineStageKey | null>(null)
/** 时间线回放当前阶段：只高亮画布节点，不打开详情 */
const replayKey = ref<PipelineStageKey | null>(null)

/** 实际高亮集合：有锁定看锁定，否则跟随悬停 */
const effectiveHighlight = computed(() =>
  lockedEntries.value.length > 0 ? lockedEntries.value : hoveredEntries.value,
)

const selectedNode = computed(() =>
  selectedNodeKey.value ? layout.nodeByKey.get(selectedNodeKey.value) ?? null : null,
)

const selectedStage = computed(() =>
  selectedNodeKey.value ? live.value.stages.get(selectedNodeKey.value) : undefined,
)

/** 选中阶段的「是什么 / 对应命令 / 常见问题」教学卡 */
const stageDoc = computed(() =>
  selectedNodeKey.value ? resolveStageDoc(selectedNodeKey.value, props.i18n) : null,
)

/** 选中节点所属入口的最近一次失败；归属判定与耗时徽标一致 */
const selectedFailure = computed<OpFailureInfo | undefined>(() =>
  selectedNode.value
    ? nodeLastFailure(selectedNode.value, effectiveHighlight.value, props.failures)
    : undefined,
)

const selectedDiagnosis = computed(() =>
  selectedFailure.value
    ? diagnosePipelineFailure(selectedFailure.value.detail, props.i18n)
    : null,
)

const selectedStageStatus = computed<PipelineStatus>(() => selectedStage.value?.status ?? "pending")

/** 信息条优先跟随悬停，其次展示锁定集合，避免锁定后悬停无反馈 */
const infoEntries = computed(() =>
  hoveredEntries.value.length > 0 ? hoveredEntries.value : lockedEntries.value,
)

const clearLockText = computed(() =>
  fmtTemplate(props.i18n.pipelineGraphClearLock as string, lockedEntries.value.length),
)

const entryLabels = computed<Record<string, string>>(() => {
  const labels: Record<string, string> = {}
  for (const entry of PIPELINE_GRAPH_ENTRIES) {
    labels[entry.id] = props.i18n[entry.labelKey] ?? entry.id
  }
  return labels
})

const legendGroups = GRAPH_CATEGORY_ORDER.map((category) => ({
  category,
  labelKey: GRAPH_CATEGORY_LABEL_KEY[category],
  entries: PIPELINE_GRAPH_ENTRIES.filter((entry) => entry.category === category),
}))

const STATUS_LABEL_KEY: Record<PipelineStatus, string> = {
  pending: "pipelineGraphStatusPending",
  running: "pipelineGraphStatusRunning",
  done: "pipelineGraphStatusDone",
  skipped: "pipelineGraphStatusSkipped",
  fail: "pipelineGraphStatusFail",
  canceled: "pipelineGraphStatusCanceled",
}

const STATUS_LEGEND: readonly PipelineStatus[] = [
  "pending", "running", "done", "skipped", "fail", "canceled",
]

function onHoverEntries(entryIds: string[]): void {
  hoveredEntries.value = entryIds
}

function onSelectNode(key: PipelineStageKey | null): void {
  selectedNodeKey.value = key
}

function onReplay(key: PipelineStageKey | null): void {
  replayKey.value = key
}

/** 点击图例 chip：锁定 / 解锁该入口路径（可多选叠加） */
function toggleLock(entryId: string): void {
  lockedEntries.value = lockedEntries.value.includes(entryId)
    ? lockedEntries.value.filter((id) => id !== entryId)
    : [...lockedEntries.value, entryId]
}

function clearLocks(): void {
  lockedEntries.value = []
}

function entryStatus(entryId: string): PipelineStatus {
  return live.value.entries.get(entryId)?.status ?? "pending"
}

function laneCount(entryId: string): number {
  return live.value.entries.get(entryId)?.laneCount ?? 0
}

function stageLabel(key: PipelineStageKey): string {
  return props.i18n[PIPELINE_STAGE_LABEL_KEY[key]] ?? props.i18n.pipelineGraphUnknown ?? key
}

function statusLabel(status: PipelineStatus): string {
  return props.i18n[STATUS_LABEL_KEY[status]] ?? status
}

/** 运行中入口的阶段摘要：阶段名 + 真实百分比（未上报不显示）+ 阶段耗时 */
function runningSummary(entryId: string): string {
  const item = live.value.entries.get(entryId)
  if (!item || item.status !== "running" || !item.stageKey) return ""
  const percent = item.percent !== undefined ? ` ${item.percent}%` : ""
  const elapsed = item.stageStartedAt
    ? ` ${Math.max(0, Math.floor((now.value - item.stageStartedAt) / 1000))}s`
    : ""
  return `${stageLabel(item.stageKey)}${percent}${elapsed}`
}

function chipStageText(entryId: string): string {
  return runningSummary(entryId)
}

/** 图例 chip 的「上次总耗时」：运行中或最近一次失败时让位 */
function entryTotalText(entryId: string): string {
  if (live.value.entries.get(entryId)?.status === "running") return ""
  if (entryFailure(entryId)) return ""
  const ms = entryLastTotal(entryId, props.history)
  return ms === undefined ? "" : formatDuration(ms)
}

function entryFailure(entryId: string): OpFailureInfo | undefined {
  return entryLastFailure(entryId, props.failures)
}

function entryFailureTitle(entryId: string): string {
  const failure = entryFailure(entryId)
  if (!failure) return ""
  const reason = diagnosePipelineFailure(failure.detail, props.i18n)?.title ?? ""
  return fmtTemplate(props.i18n.pipelineGraphLastFailure as string, reason)
}

function entryTotalTitle(entryId: string): string {
  return fmtTemplate(props.i18n.pipelineGraphLastTotal as string, entryTotalText(entryId))
}

/** 选中节点在某入口下的「上次此阶段耗时」 */
function lastStageText(entryId: string): string {
  const node = selectedNode.value
  if (!node) return ""
  const ms = nodeLastDuration(node, [entryId], props.history)
  return ms === undefined ? "" : formatDuration(ms)
}

/** 阶段摘要：状态 + 真实百分比（若有）+ 阶段耗时 + 停滞提示 */
function nodeSummary(key: PipelineStageKey): string {
  const stage = live.value.stages.get(key)
  if (!stage) return statusLabel("pending")
  const percent = stage.percent !== undefined ? ` ${stage.percent}%` : ""
  const elapsed = stage.status === "running" && stage.startedAt
    ? ` · ${Math.max(0, Math.floor((now.value - stage.startedAt) / 1000))}s`
    : ""
  const stalled = stage.status === "running" && stage.stalled
    ? ` · ${props.i18n.opStageStillWorking ?? "仍在处理"}`
    : ""
  return `${statusLabel(stage.status)}${percent}${elapsed}${stalled}`
}

const infoText = computed(() => {
  const ids = infoEntries.value
  if (ids.length === 0) return ""
  const names = ids.map((id) => {
    const label = entryLabels.value[id] ?? id
    const item = live.value.entries.get(id)
    if (!item) {
      const failure = entryFailure(id)
      if (failure) {
        const reason = diagnosePipelineFailure(failure.detail, props.i18n)?.title
          ?? (props.i18n.pipelineGraphNodeFailed as string)
        const last = fmtTemplate(props.i18n.pipelineGraphLastFailure as string, reason)
        return `${label}（${last}）`
      }
      const total = entryLastTotal(id, props.history)
      if (total === undefined) return label
      const last = fmtTemplate(props.i18n.pipelineGraphLastRun as string, formatDuration(total))
      return `${label}（${last}）`
    }
    const summary = item.status === "running" ? runningSummary(id) : statusLabel(item.status)
    return summary ? `${label}（${summary}）` : label
  })
  return fmtTemplate(props.i18n.pipelineGraphNodeOps as string, names.join(" / "))
})
</script>

<style lang="scss">
@use "../../styles/PipelineGraph.scss";
</style>
