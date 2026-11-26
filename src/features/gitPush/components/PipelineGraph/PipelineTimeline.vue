<!-- 最近运行时间线：甘特条按真实耗时缩放，可逐阶段回放并与更早一次对比 -->
<template>
  <section class="gpt-panel">
    <header class="gpt-head">
      <div class="gpt-title">
        <span>{{ i18n.pipelineTimelineTitle }}</span>
        <select
          v-if="entryOptions.length > 0"
          v-model="activeEntry"
          class="gpt-select"
          :aria-label="i18n.pipelineTimelineSelect"
          @change="stop"
        >
          <option
            v-for="option in entryOptions"
            :key="option.id"
            :value="option.id"
          >
            {{ option.label }} · {{ option.runs.length }}
          </option>
        </select>
      </div>
      <p class="gpt-hint">
        {{ i18n.pipelineTimelineHint }}
      </p>
    </header>

    <p
      v-if="runs.length === 0"
      class="gpt-empty"
    >
      {{ i18n.pipelineTimelineEmpty }}
    </p>

    <div
      v-else
      class="gpt-runs"
    >
      <div
        v-for="(run, index) in runs"
        :key="`${run.at}-${index}`"
        class="gpt-run"
        :class="{ 'is-playing': playingIndex === index }"
      >
        <div class="gpt-run-meta">
          <span class="gpt-run-index">#{{ runs.length - index }}</span>
          <span class="gpt-run-time">{{ timeLabel(run.at) }}</span>
          <span class="gpt-run-total">
            {{ fmt(i18n.pipelineTimelineTotal, formatDuration(run.totalMs)) }}
          </span>
          <span
            v-if="run.deltaPercent !== null && run.deltaPercent !== 0"
            class="gpt-run-delta"
            :class="run.deltaPercent < 0 ? 'is-faster' : 'is-slower'"
            :title="i18n.pipelineTimelineDeltaTitle"
          >{{ run.deltaPercent > 0 ? '+' : '−' }}{{ Math.abs(run.deltaPercent) }}%</span>
          <button
            v-if="run.segments.length > 0"
            type="button"
            class="gpt-play"
            @click="togglePlay(index)"
          >
            {{ playingIndex === index ? i18n.pipelineTimelineStop : i18n.pipelineTimelinePlay }}
          </button>
        </div>

        <div class="gpt-bar">
          <button
            v-for="segment in run.segments"
            :key="segment.key"
            type="button"
            class="gpt-seg"
            :class="{ 'is-playing': playingIndex === index && playingKey === segment.key }"
            :style="segmentStyle(segment, run)"
            :title="segmentTitle(segment, run)"
            @click="onSegmentClick(segment.key)"
          >
            <span
              v-if="segmentWidth(segment) >= 10"
              class="gpt-seg-label"
            >{{ stageLabel(segment.key) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 阶段级变化：最新 vs 上一次，变慢排在最前 -->
    <div
      v-if="stageDeltas.length > 0"
      class="gpt-delta"
    >
      <div class="gpt-delta-head">
        <span class="gpt-delta-title">{{ i18n.pipelineTimelineDeltaBlockTitle }}</span>
        <span
          class="gpt-delta-summary"
          :class="summaryClass"
          :title="i18n.pipelineTimelineDeltaTitle"
        >{{ summaryText }}</span>
      </div>
      <div class="gpt-delta-row gpt-delta-row--head">
        <span>{{ i18n.pipelineTimelineColStage }}</span>
        <span>{{ i18n.pipelineTimelineColLatest }}</span>
        <span>{{ i18n.pipelineTimelineColPrevious }}</span>
        <span>{{ i18n.pipelineTimelineColChange }}</span>
      </div>
      <button
        v-for="row in stageDeltas"
        :key="row.key"
        type="button"
        class="gpt-delta-row"
        :title="deltaTitle(row)"
        @click="onSegmentClick(row.key)"
      >
        <span class="gpt-delta-stage">{{ stageLabel(row.key) }}</span>
        <span class="gpt-delta-value">{{ valueText(row.currentMs) }}</span>
        <span class="gpt-delta-value">{{ valueText(row.previousMs) }}</span>
        <span
          class="gpt-delta-badge"
          :class="deltaClass(row)"
        >{{ deltaText(row) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PipelineRunTimings, PipelineStageHistory, PipelineStageKey } from "../../types/pipeline"
import { computed, onUnmounted, ref, watch } from "vue"
import { TimerRegistry } from "@/utils/timerRegistry"
import { fmtTemplate } from "../../utils/i18nFormat"
import { PIPELINE_STAGE_LABEL_KEY } from "../../utils/opPipeline"
import {
  entryRecentRuns,
  formatDuration,
  PIPELINE_GRAPH_ENTRIES,
} from "../../utils/pipelineGraph"
import type { StageDelta, TimelineRun, TimelineSegment } from "../../utils/pipelineTimeline"
import {
  buildStageDeltas,
  buildTimelineRuns,
  playbackDelays,
  segmentShare,
} from "../../utils/pipelineTimeline"

const props = defineProps<{
  i18n: Record<string, any>
  /** 计划签名 → 最近若干次成功运行（最新在前） */
  history: PipelineStageHistory
  /** 当前聚焦的入口；单入口聚焦时时间线自动切过去 */
  highlight: string[]
}>()

const emit = defineEmits<{
  /** 回放推进到某个阶段（null 表示停止），面板据此高亮画布节点 */
  replay: [key: PipelineStageKey | null]
  selectNode: [key: PipelineStageKey]
}>()

const timers = new TimerRegistry()
const activeEntry = ref<string | null>(null)
const playingIndex = ref<number | null>(null)
const playingKey = ref<PipelineStageKey | null>(null)

interface EntryOption {
  id: string
  label: string
  runs: readonly PipelineRunTimings[]
}

/** 有历史的入口，按最近一次运行时间倒序（最常用的操作排在最前） */
const entryOptions = computed<EntryOption[]>(() =>
  PIPELINE_GRAPH_ENTRIES
    .map((entry) => ({
      id: entry.id,
      label: props.i18n[entry.labelKey] ?? entry.id,
      runs: entryRecentRuns(entry.id, props.history),
    }))
    .filter((option) => option.runs.length > 0)
    .sort((a, b) => (b.runs[0]?.at ?? 0) - (a.runs[0]?.at ?? 0)),
)

const rawRuns = computed(() =>
  activeEntry.value ? entryRecentRuns(activeEntry.value, props.history) : [],
)

const runs = computed<TimelineRun[]>(() => buildTimelineRuns(rawRuns.value))

/** 最新一次 vs 上一次的阶段变化；不足两次时为空 */
const stageDeltas = computed<StageDelta[]>(() =>
  buildStageDeltas(rawRuns.value[0], rawRuns.value[1]),
)

/** 总耗时变化摘要（百分比 · 绝对值） */
const summaryText = computed(() => {
  const latest = rawRuns.value[0]
  const previous = rawRuns.value[1]
  if (!latest || !previous) return ""
  const diff = latest.totalMs - previous.totalMs
  if (diff === 0) return "0"
  const sign = diff > 0 ? "+" : "−"
  const percent = previous.totalMs > 0
    ? ` · ${Math.round((Math.abs(diff) / previous.totalMs) * 100)}%`
    : ""
  return `${sign}${formatDuration(Math.abs(diff))}${percent}`
})

const summaryClass = computed(() => {
  const latest = rawRuns.value[0]
  const previous = rawRuns.value[1]
  if (!latest || !previous) return "is-same"
  if (latest.totalMs > previous.totalMs) return "is-slower"
  if (latest.totalMs < previous.totalMs) return "is-faster"
  return "is-same"
})

/** 对比基准：最慢一次 = 100% 宽度，短的那几次自然更短 */
const maxTotalMs = computed(() => Math.max(1, ...runs.value.map((run) => run.totalMs)))

watch(entryOptions, (options) => {
  if (options.length === 0) {
    activeEntry.value = null
    return
  }
  if (!activeEntry.value || !options.some((option) => option.id === activeEntry.value)) {
    activeEntry.value = options[0]!.id
  }
}, { immediate: true })

watch(() => props.highlight, (ids) => {
  if (ids.length !== 1) return
  const target = ids[0]!
  if (entryOptions.value.some((option) => option.id === target)) activeEntry.value = target
}, { immediate: true })

watch(activeEntry, () => stop())
// 运行记录变化（新一次成功、裁剪掉旧记录）时停止回放，避免按旧索引高亮到别的行
watch(runs, () => stop())

onUnmounted(() => stop())

function stageLabel(key: PipelineStageKey): string {
  return props.i18n[PIPELINE_STAGE_LABEL_KEY[key]] ?? key
}

function fmt(template: string, ...args: (string | number)[]): string {
  return fmtTemplate(template, ...args)
}

function timeLabel(at: number): string {
  const date = new Date(at)
  const sameDay = date.toDateString() === new Date().toDateString()
  return sameDay
    ? date.toLocaleTimeString("zh-CN", { hour12: false })
    : date.toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
}

/** 段宽按「最慢一次」为基准，跨行可直接比较绝对耗时 */
function segmentWidth(segment: TimelineSegment): number {
  return Math.max(0, (segment.durationMs / maxTotalMs.value) * 100)
}

function segmentStyle(segment: TimelineSegment, run: TimelineRun): Record<string, string> {
  const width = segmentWidth(segment)
  // 极短阶段靠 min-width 保底可见；相对耗时越长底色越实，形成行内热力
  const share = segmentShare(segment, run) / 100
  return {
    width: `${width}%`,
    "--gpt-seg-alpha": String(0.32 + 0.68 * Math.sqrt(Math.min(1, Math.max(0, share)))),
  }
}

function segmentTitle(segment: TimelineSegment, run: TimelineRun): string {
  const percent = Math.round(segmentShare(segment, run))
  return `${stageLabel(segment.key)} · ${formatDuration(segment.durationMs)} · ${
    fmt(props.i18n.pipelineTimelineShare as string, percent)
  }`
}

function togglePlay(index: number): void {
  if (playingIndex.value === index) {
    stop()
    return
  }
  const run = runs.value[index]
  if (!run || run.segments.length === 0) return
  stop()
  playingIndex.value = index
  const delays = playbackDelays(run)
  let cursor = 0
  const step = () => {
    const segment = run.segments[cursor]
    if (!segment) {
      stop()
      return
    }
    playingKey.value = segment.key
    emit("replay", segment.key)
    const delay = delays[cursor] ?? 300
    cursor++
    timers.setTimeout(step, delay)
  }
  step()
}

function stop(): void {
  timers.clearAll()
  if (playingIndex.value === null && playingKey.value === null) return
  playingIndex.value = null
  playingKey.value = null
  emit("replay", null)
}

function onSegmentClick(key: PipelineStageKey): void {
  stop()
  emit("selectNode", key)
}

function valueText(ms: number | undefined): string {
  return ms === undefined ? "—" : formatDuration(ms)
}

function deltaClass(row: StageDelta): string {
  if (row.deltaMs === undefined) return "is-muted"
  if (row.deltaMs > 0) return "is-slower"
  if (row.deltaMs < 0) return "is-faster"
  return "is-same"
}

function deltaText(row: StageDelta): string {
  if (row.currentMs === undefined) return props.i18n.pipelineTimelineDeltaGone ?? "未执行"
  if (row.previousMs === undefined) return props.i18n.pipelineTimelineDeltaNew ?? "新增"
  const delta = row.deltaMs ?? 0
  if (delta === 0) return "0"
  return `${delta > 0 ? "+" : "−"}${formatDuration(Math.abs(delta))}`
}

function deltaTitle(row: StageDelta): string {
  return row.deltaPercent === undefined
    ? ""
    : `${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent}%`
}
</script>

<style lang="scss">
@use "../../styles/PipelineTimeline.scss";
</style>
