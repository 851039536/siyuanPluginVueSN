<!-- Git 推送/拉取操作输出面板：结构化结果拍平为控制台逐行输出，失败时提供 AI 错误分析入口 -->
<template>
  <div
    v-if="lines.length"
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
import { computed, ref } from "vue"
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
  /** 操作类型：推送或拉取（AI 分析上下文 + 弹窗徽标） */
  action: "push" | "pull"
}>()

/** 是否存在失败条目（非跳过且失败，控制 AI 分析按钮显隐） */
const hasFailed = computed(() =>
  (props.entries ?? []).some((e) => !e.ok && !e.skipped),
)

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
