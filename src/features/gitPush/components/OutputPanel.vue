<!-- Git 推送/拉取操作输出面板：结构化结果拍平为控制台逐行输出 -->
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
  </div>
</template>

<script setup lang="ts">
import type { PushOutputEntry } from "../composables/useGitOps"
import { computed } from "vue"

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
}>()

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
