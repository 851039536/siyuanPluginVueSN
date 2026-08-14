<!-- gitPush AI 错误日志分析弹窗：流式调用 AI 分析 Git 失败日志并展示原因与解决方案 -->
<template>
  <Teleport to="body">
    <div
      class="gp-ai-overlay"
      @click.self="$emit('close')"
    >
      <div class="gp-ai-dialog">
        <!-- 头部：标题 + 操作徽标（左） / 重新分析、复制、关闭（右） -->
        <div class="gp-ai-header">
          <div class="gp-ai-title">
            <Icon
              icon="mdi:auto-fix"
              height="14"
            />
            <!-- 弹窗标题："AI 错误分析" -->
            <span>{{ i18n.aiAnalyzeTitle }}</span>
            <!-- 操作类型 + 项目名徽标（如 推送 · my-repo） -->
            <span class="gp-ai-badge">{{ actionLabel }} · {{ projectName }}</span>
          </div>
          <div class="gp-ai-header-actions">
            <!-- 重新分析（tooltip："重新分析"） -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="streaming"
              :title="i18n.aiAnalyzeRetry"
              @click="runAnalysis"
            >
              <Icon
                :icon="streaming ? 'mdi:loading' : 'mdi:refresh'"
                height="12"
                :class="{ 'gp-spin': streaming }"
              />
            </button>
            <!-- 复制分析结果（tooltip："复制分析结果"） -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="!result"
              :title="i18n.aiAnalyzeCopy"
              @click="handleCopy"
            >
              <Icon
                :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
                height="12"
              />
            </button>
            <!-- 关闭弹窗（tooltip："关闭"） -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="i18n.close"
              @click="$emit('close')"
            >
              <Icon
                icon="mdi:close"
                height="12"
              />
            </button>
          </div>
        </div>

        <!-- 失败日志折叠摘要（默认展开） -->
        <div class="gp-ai-errors">
          <button
            class="gp-ai-errors-toggle"
            @click="errorsExpanded = !errorsExpanded"
          >
            <Icon
              icon="mdi:alert-circle-outline"
              height="12"
            />
            <!-- "失败日志" -->
            <span>{{ i18n.aiAnalyzeErrorLog }}</span>
            <Icon
              :icon="errorsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
              height="12"
            />
          </button>
          <pre
            v-if="errorsExpanded"
            class="gp-ai-errors-text"
          >{{ errorText }}</pre>
        </div>

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
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              @click="runAnalysis"
            >
              <Icon
                icon="mdi:refresh"
                height="12"
              />
              <span>{{ i18n.aiAnalyzeRetry }}</span>
            </button>
          </div>
          <!-- 分析结果（Markdown 渲染，复用 gp-md-content 排版） -->
          <article
            v-else-if="result"
            v-html="renderedHtml"
            class="gp-md-content gp-ai-content"
          />
        </div>

        <!-- 底部操作栏 -->
        <div class="gp-ai-footer">
          <!-- "分析结果由 AI 生成，仅供参考" -->
          <span class="gp-ai-footer-hint">{{ i18n.aiAnalyzeFooterHint }}</span>
          <div class="gp-grow" />
          <!-- 重新分析主按钮 -->
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="streaming"
            @click="runAnalysis"
          >
            <Icon
              icon="mdi:auto-fix"
              height="12"
              :class="{ 'gp-spin': streaming }"
            />
            <span>{{ streaming ? i18n.aiAnalyzing : i18n.aiAnalyzeRetry }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
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
import { CARD_SERVICES_KEY } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目名称（注入 prompt 上下文） */
  projectName: string
  /** 操作类型：推送或拉取 */
  action: "push" | "pull"
  /** 该操作的完整输出条目（内部筛选失败项） */
  entries: PushOutputEntry[]
}>()

const emit = defineEmits<{
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
      onChunk: (chunk: string) => { result.value += chunk },
    })
  } catch (e: unknown) {
    console.error("[gitPush] AI 错误分析失败:", e)
    error.value = props.i18n.aiAnalyzeFailed
  } finally {
    streaming.value = false
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

/** 复制分析结果（成功 2 秒反馈） */
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function handleCopy() {
  if (!result.value) return
  const ok = await copyToClipboard(result.value)
  if (ok) {
    if (copiedTimer) clearTimeout(copiedTimer)
    copied.value = true
    copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  }
}

// Esc 关闭 + 打开即自动分析（组件仅在弹窗打开时挂载）
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}
onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void runAnalysis()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/AiErrorAnalysisDialog.scss";
</style>
