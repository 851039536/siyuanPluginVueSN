<!-- gitPush AI 错误日志分析弹窗：流式调用 AI 分析 Git 失败日志并展示原因与解决方案 -->
<template>
  <!-- 外壳（遮罩 / 定位 / 层级 / Esc / 焦点归还 / 过渡）全部由共享 Dialog 承担 -->
  <Dialog
    class="gp-ai-dialog"
    :visible="true"
    size="large"
    :dismissable-mask="true"
    :closable="false"
    :aria-label="i18n.aiAnalyzeTitle"
    @update:visible="$emit('close')"
  >
    <!-- 头部：标题 + 操作徽标（左） / 重新分析、复制、关闭（右）；headerId 打到标题元素以建立 aria-labelledby -->
    <template #header="{ headerId }">
      <div class="gp-ai-header">
        <div class="gp-ai-title">
          <Icon
            icon="mdi:auto-fix"
            height="14"
          />
          <!-- 弹窗标题："AI 错误分析" -->
          <span :id="headerId">{{ i18n.aiAnalyzeTitle }}</span>
          <!-- 操作类型 + 项目名徽标（如 推送 · my-repo） -->
          <span class="gp-ai-badge">{{ actionLabel }} · {{ projectName }}</span>
        </div>
        <div class="gp-ai-header-actions">
          <!-- 重新分析（tooltip："重新分析"） -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="refresh"
            :loading="streaming"
            :disabled="streaming"
            :title="i18n.aiAnalyzeRetry"
            @click="runAnalysis"
          />
          <!-- 复制分析结果（tooltip："复制分析结果"） -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            :icon="copied ? 'check' : 'contentCopy'"
            :disabled="!result"
            :title="i18n.aiAnalyzeCopy"
            @click="handleCopy"
          />
          <!-- 关闭弹窗（tooltip："关闭"） -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="close"
            :title="i18n.close"
            @click="$emit('close')"
          />
        </div>
      </div>
    </template>

    <!-- 失败日志折叠摘要（默认展开；折叠交互与 aria-expanded 由共享 Panel 承担） -->
    <Panel
      class="gp-ai-errors"
      :header="i18n.aiAnalyzeErrorLog"
      toggleable
      :collapsed="!errorsExpanded"
      :toggle-label="i18n.aiAnalyzeErrorLog"
      @update:collapsed="errorsExpanded = !$event"
    >
      <pre class="gp-ai-errors-text">{{ errorText }}</pre>
    </Panel>

    <!-- 内容区 -->
    <div class="gp-ai-body">
      <!-- 分析中："AI 分析中..." -->
      <div
        v-if="streaming"
        class="gp-ai-state"
      >
        <Icon
          icon="mdi:loading"
          height="14"
          class="gp-spin"
        />
        <span>{{ i18n.aiAnalyzing }}</span>
      </div>
      <!-- 调用失败："AI 分析失败，请重试" -->
      <div
        v-else-if="error"
        class="gp-ai-state gp-ai-state--error"
      >
        <Icon
          icon="mdi:alert-circle-outline"
          height="16"
        />
        <span>{{ error }}</span>
        <!-- 重试按钮："重新分析" -->
        <Button
          class="gp-ai-retry-btn"
          variant="ghost"
          size="xsmall"
          dense
          icon="refresh"
          @click="runAnalysis"
        >
          {{ i18n.aiAnalyzeRetry }}
        </Button>
      </div>
      <!-- 分析结果（Markdown 渲染，复用 gp-md-content 排版） -->
      <article
        v-else-if="result"
        v-html="renderedHtml"
        class="gp-md-content gp-ai-content"
      />
    </div>

    <!-- 底部操作栏 -->
    <template #footer>
      <!-- "分析结果由 AI 生成，仅供参考" -->
      <span class="gp-ai-footer-hint">{{ i18n.aiAnalyzeFooterHint }}</span>
      <!-- 重新分析主按钮 -->
      <Button
        class="gp-ai-footer-btn"
        variant="primary"
        size="xsmall"
        dense
        icon="sparkles"
        :loading="streaming"
        :disabled="streaming"
        @click="runAnalysis"
      >
        {{ streaming ? i18n.aiAnalyzing : i18n.aiAnalyzeRetry }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { PushOutputEntry } from "../../composables/useGitOps"
import { Icon } from "@iconify/vue"
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { callAISmart } from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import { parseMarkdown } from "@/utils/mdRenderer"
import { TimerRegistry } from "@/utils/timerRegistry"
import { CARD_SERVICES_KEY } from "../../types"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"
import Panel from "@/components/Panel.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目名称（注入 prompt 上下文） */
  projectName: string
  /** 操作类型：推送或拉取 */
  action: "push" | "pull"
  /** 该操作的完整输出条目（内部筛选失败项） */
  entries: PushOutputEntry[]
}>()

defineEmits<{
  close: []
}>()

/** 卡片服务（manager 持有 getAiConfig，经 CARD_SERVICES_KEY 注入） */
const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

/** 失败条目（非跳过且失败） */
const failedEntries = computed(() =>
  (props.entries ?? []).filter((e) => !e.ok && !e.skipped),
)

/** 错误文本截断上限（字符数，防 token 膨胀） */
const MAX_ERROR_CHARS = 4000

/** 失败日志纯文本（平台 + 摘要 + stderr/stdout，供 prompt 与折叠区展示） */
const errorText = computed(() => {
  const parts = failedEntries.value.map((e) => {
    const lines = [
      `[${e.label}] 失败 (${e.duration}ms)`,
      e.summary ? `摘要: ${e.summary}` : "",
      e.fullStderr ? `stderr:\n${e.fullStderr}` : "",
      e.fullStdout ? `stdout:\n${e.fullStdout}` : "",
    ]
    return lines.filter(Boolean).join("\n")
  })
  const text = parts.join("\n\n")
  return text.length > MAX_ERROR_CHARS
    ? `${text.slice(0, MAX_ERROR_CHARS)}\n...[已截断]`
    : text
})

/** 操作类型 UI 标签（复用 opPush/opPull 键） */
const actionLabel = computed(() =>
  props.action === "push" ? props.i18n.opPush : props.i18n.opPull,
)

// ── 分析状态 ──
const streaming = ref(false)
const result = ref("")
const error = ref("")
const copied = ref(false)
const errorsExpanded = ref(true)
/** 组件卸载标记 + 流式请求 AbortController（卸载时中止，防止 onChunk 写入已卸载组件的 ref） */
let disposed = false
let abortController: AbortController | null = null

/** 组装 AI 分析 prompt */
function buildPrompt(): string {
  return `Git ${props.action} 操作失败。\n项目：${props.projectName}\n失败日志：\n${errorText.value}`
}

/** 发起 AI 流式分析（未配置密钥 / 调用失败均给出明确提示） */
async function runAnalysis() {
  if (streaming.value) return
  if (failedEntries.value.length === 0) return
  const config = manager.getAiConfig()
  if (!config.apiKey) {
    error.value = props.i18n.aiAnalyzeNoKey
    result.value = ""
    return
  }
  streaming.value = true
  error.value = ""
  result.value = ""
  abortController = new AbortController()
  try {
    await callAISmart(buildPrompt(), config, {
      systemPrompt:
        "你是一位资深 Git 专家。请根据用户提供的 Git 操作失败日志进行分析，用 Markdown 输出，结构如下：\n"
        + "1. **错误原因**：简明指出根本原因\n"
        + "2. **解决方案**：具体可执行的解决步骤（必要时给出命令）\n"
        + "3. **预防建议**：避免再次发生的做法（如无则省略）\n"
        + "要求：只依据日志分析，不编造信息；信息不足时明确说明。",
      temperature: 0.3,
      maxTokens: 1024,
      enableThinking: false,
      signal: abortController.signal,
      onChunk: (chunk: string) => {
        if (!disposed) result.value += chunk
      },
    })
  } catch (e: unknown) {
    // 组件卸载主动中止时不报错
    if (!disposed) {
      console.error("[gitPush] AI 错误分析失败:", e)
      error.value = props.i18n.aiAnalyzeFailed
    }
  } finally {
    streaming.value = false
    abortController = null
  }
}

/** 流式结果 → Markdown HTML */
const renderedHtml = computed(() => {
  if (!result.value) return ""
  try {
    return parseMarkdown(result.value, { codeHighlight: true })
  } catch (e) {
    console.error("[AiErrorAnalysisDialog] 渲染失败:", e)
    return `<p>${props.i18n.errRenderMarkdown}</p>`
  }
})

/** 复制反馈定时器（统一入口 TimerRegistry，随组件卸载清理） */
const feedbackTimers = new TimerRegistry()

/** 复制分析结果（成功 2 秒反馈） */
async function handleCopy() {
  if (!result.value) return
  const ok = await copyToClipboard(result.value)
  if (ok) {
    feedbackTimers.clearAll()
    copied.value = true
    feedbackTimers.setTimeout(() => { copied.value = false }, 2000)
  }
}

// 打开即自动分析（组件仅在弹窗打开时挂载）；Esc 关闭由共享 Dialog 内建处理
onMounted(() => {
  void runAnalysis()
})
onUnmounted(() => {
  disposed = true
  abortController?.abort()
  feedbackTimers.clearAll()
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/AiErrorAnalysisDialog.scss";
</style>
