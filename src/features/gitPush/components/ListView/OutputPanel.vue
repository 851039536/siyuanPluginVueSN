<!-- Git 推送/拉取操作输出面板：运行中单行汇总过程状态，完成后展示结构化结果，失败时提供 AI 错误分析入口 -->
<template>
  <!-- 过程视图：操作进行中，单行汇总正在推送/拉取的平台（旧结果此时暂不展示，避免误导） -->
  <div
    v-if="runningStates?.length"
    class="gp-output"
  >
    <div class="gp-output-scroll">
      <!-- 运行中过程行：旋转图标 + 进行中文案 + 平台名列表 + 实时累计耗时 -->
      <div class="gp-console-line gp-console-line--run">
        <Icon
          icon="mdi:loading"
          height="12"
          class="gp-spin"
        />
        <span class="gp-console-action">{{ runningText }}</span>
        <span class="gp-console-remotes">{{ runningLabels }}</span>
        <span class="gp-console-elapsed">{{ elapsed }}s</span>
      </div>
    </div>
  </div>
  <!-- 结果视图：操作完成后展示 -->
  <div
    v-else-if="lines.length"
    class="gp-output"
  >
    <div class="gp-output-scroll">
      <!-- 控制台逐行输出：头行带状态色，stdout/stderr 缩进显示 -->
      <div
        v-for="(line, idx) in lines"
        :key="idx"
        class="gp-console-line"
        :class="`gp-console-line--${line.type}`"
      >{{ line.text }}</div>
    </div>
    <!-- 存在失败条目时显示 AI 分析按钮 -->
    <div
      v-if="hasFailed"
      class="gp-output-ai"
    >
      <!-- "AI 分析"（tooltip：分析失败原因与解决方案） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm gp-output-ai-btn"
        :title="i18n.aiAnalyze"
        @click="showAiDialog = true"
      >
        <Icon
          icon="mdi:auto-fix"
          height="12"
        />
        <span>{{ i18n.aiAnalyze }}</span>
      </button>
    </div>
    <!-- AI 错误分析弹窗（自包含，父只管开关） -->
    <AiErrorAnalysisDialog
      v-if="showAiDialog"
      :i18n="i18n"
      :project-name="projectName"
      :action="action"
      :entries="entries"
      @close="showAiDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { PushOutputEntry } from "../../composables/useGitOps"
import { Icon } from "@iconify/vue"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { TimerRegistry } from "@/utils/timerRegistry"
import AiErrorAnalysisDialog from "./AiErrorAnalysisDialog.vue"

/** stdout 预览截断上限（字符数） */
const MAX_STDOUT_PREVIEW = 500

/** 控制台行类型：ok/fail/skip 为头行状态，out/err 为详情输出 */
type ConsoleLineType = "ok" | "fail" | "skip" | "out" | "err"

interface ConsoleLine {
  text: string
  type: ConsoleLineType
}

const props = defineProps<{
  entries: PushOutputEntry[]
  /** 面板内 i18n 文案（AI 分析按钮/弹窗文案） */
  i18n: Record<string, any>
  /** 当前项目名（AI 分析上下文） */
  projectName: string
  /** 操作类型：推送或拉取（AI 分析上下文 + 弹窗徽标 + 进行中文案选择） */
  action: "push" | "pull"
  /** 运行中的平台实时状态（非空 = 操作进行中，渲染过程视图替代旧结果） */
  runningStates?: { key: string, label: string }[]
}>()

/** 是否存在失败条目（非跳过且失败，控制 AI 分析按钮显隐） */
const hasFailed = computed(() =>
  (props.entries ?? []).some((e) => !e.ok && !e.skipped),
)

/** 进行中文案：按操作类型取既有 i18n 键 */
const runningText = computed(() => (props.action === "push" ? props.i18n.pushing : props.i18n.pulling))

/** 运行中平台名汇总：单行展示当前仍在推送/拉取的平台（逐平台完成的自动从列表滑出） */
const runningLabels = computed(() =>
  (props.runningStates ?? []).map((r) => r.label).join(" · "),
)

// ── 运行中实时累计耗时（过程视图行尾显示 "Ns"）──

/** 定时器统一托管（TimerRegistry，随组件卸载清理） */
const elapsedTimer = new TimerRegistry()
/** 已累计秒数（过程视图实时刷新显示） */
const elapsed = ref(0)
/** 操作批次开始时间戳 */
let startTime = 0

/** 随 runningStates 启停计时：非空开始累计，清空停止并复位 */
function syncElapsedTimer() {
  const running = (props.runningStates?.length ?? 0) > 0
  elapsedTimer.clearAll()
  elapsed.value = 0
  if (running) {
    startTime = Date.now()
    elapsedTimer.setInterval(() => {
      elapsed.value = Math.floor((Date.now() - startTime) / 1000)
    }, 1000)
  }
}

watch(() => props.runningStates?.length, syncElapsedTimer)
// 视图切换回来时若操作仍在进行，补齐计时
onMounted(syncElapsedTimer)
onUnmounted(() => elapsedTimer.clearAll())

/** AI 分析弹窗开关 */
const showAiDialog = ref(false)

/** 截断超长 stdout 预览 */
function truncate(text: string): string {
  return text.length > MAX_STDOUT_PREVIEW ? `${text.slice(0, MAX_STDOUT_PREVIEW)}...` : text
}

/** 单条结果 → 控制台行（头行 + 缩进详情行） */
function entryToLines(entry: PushOutputEntry): ConsoleLine[] {
  const type: ConsoleLineType = entry.ok ? "ok" : entry.skipped ? "skip" : "fail"
  const marker = entry.ok ? "[ OK ]" : entry.skipped ? "[SKIP]" : "[FAIL]"
  const hasDetail = Boolean(entry.fullStdout || entry.fullStderr)
  // 头行：无详情输出时附带摘要（有详情时摘要即其首行，避免重复显示）
  const head = [
    marker,
    entry.label,
    entry.skipped ? "" : `${entry.duration}ms`,
    hasDetail ? "" : entry.summary,
  ].filter(Boolean).join(" · ")
  const result: ConsoleLine[] = [{ text: head, type }]
  if (entry.fullStdout) {
    for (const text of truncate(entry.fullStdout).trimEnd().split("\n")) {
      result.push({ text, type: "out" })
    }
  }
  if (entry.fullStderr) {
    for (const text of entry.fullStderr.trimEnd().split("\n")) {
      result.push({ text, type: "err" })
    }
  }
  return result
}

/** 全部结果拍平为控制台逐行输出模型 */
const lines = computed<ConsoleLine[]>(() => (props.entries ?? []).flatMap(entryToLines))
</script>
