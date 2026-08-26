<!-- gitPush Markdown 文档预览弹窗 — Pattern B 内嵌 v-if 弹窗 -->
<template>
  <div
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-md-dialog">
      <!-- 头部 -->
      <div class="gp-md-header">
        <div class="gp-md-title">
          <Icon
            icon="mdi:file-document-multiple-outline"
            height="14"
          />
          <!-- 弹窗标题："文档预览" -->
          <span>{{ i18n.previewMarkdown }}</span>
        </div>
        <!-- 关闭按钮（tooltip："关闭"） -->
        <button
          class="gp-md-close"
          :title="i18n.close"
          @click="$emit('close')"
        >
          <Icon
            icon="mdi:close"
            height="16"
          />
        </button>
      </div>

      <!-- Tab 栏（多文件时显示） -->
      <div
        v-if="files.length > 1"
        class="gp-md-tabs"
      >
        <button
          v-for="f in files"
          :key="f.name"
          class="gp-md-tab"
          :class="{ active: f.name === currentFile?.name }"
          @click="selectFile(f.name)"
        >
          {{ getMdLabel(f.name, f.variant) }}
          <!-- 超大文件警示图标（tooltip："文件较大"） -->
          <span
            v-if="f.oversized"
            class="gp-md-tab-warn"
            :title="i18n.fileTooLarge"
          >
            <Icon
              icon="mdi:alert-circle-outline"
              height="10"
            />
          </span>
        </button>
      </div>

      <!-- 内容区 -->
      <div class="gp-md-body">
        <!-- 空态："未找到 Markdown 文件" -->
        <div
          v-if="!currentFile"
          class="gp-md-empty"
        >
          <Icon
            icon="mdi:file-document-outline"
            height="32"
          />
          <span>{{ i18n.noMarkdownFiles }}</span>
        </div>

        <!-- 读取失败："读取文件失败" -->
        <div
          v-else-if="loadError"
          class="gp-md-error"
        >
          <Icon
            icon="mdi:alert-outline"
            height="20"
          />
          <span>{{ loadError }}</span>
        </div>

        <!-- 渲染的 Markdown 内容 -->
        <article
          v-else
          v-html="renderedHtml"
          class="gp-md-content"
        />
      </div>

      <!-- 底部操作栏 -->
      <div
        v-if="currentFile"
        class="gp-md-footer"
      >
        <!-- 截断提示："文件过大，仅显示前 1000 行" -->
        <span
          v-if="truncated"
          class="gp-md-warn"
        >
          <Icon
            icon="mdi:alert-circle-outline"
            height="12"
          />
          {{ i18n.fileOversized }}
        </span>
        <div class="gp-grow" />
        <!-- 按钮："复制原文" / "已复制" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="handleCopy"
        >
          <Icon
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            height="12"
          />
          <span>{{ copied ? i18n.copied : i18n.copyRaw }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GitProject } from "../../types"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { Icon } from "@iconify/vue"
import { parseMarkdown } from "@/utils/mdRenderer"
import { copyToClipboard } from "@/utils/domUtils"
import {
  getMdLabel,
  readMarkdownFile,
  scanMarkdownFiles,
} from "../../composables/useMarkdownFiles"
import { resolveValidPath } from "../../utils"

const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
  /** 初始打开的文件名（可选） */
  initialFile?: string
}>()

defineEmits<{
  close: []
}>()

// ── 状态 ──
/** 扫描到的所有 md 文件 */
const files = ref(scanMarkdownFiles(resolveValidPath(props.project)))
/** 当前选中的文件 */
const currentFile = ref(files.value[0] ?? null)
/** 当前文件原始内容 */
const rawContent = ref("")
/** 读取错误 */
const loadError = ref("")
/** 是否实际发生截断 */
const truncated = ref(false)
/** 复制成功反馈 */
const copied = ref(false)

// ── 计算：渲染 HTML ──
const renderedHtml = computed(() => {
  if (!rawContent.value) return ""
  try {
    return parseMarkdown(rawContent.value, { codeHighlight: true })
  } catch (e) {
    console.error("[MarkdownPreviewDialog] 渲染失败:", e)
    return `<p class="gp-md-render-error">${props.i18n.errRenderMarkdown}</p>`
  }
})

// ── 方法 ──
function selectFile(name: string) {
  const f = files.value.find(x => x.name === name)
  if (f) {
    currentFile.value = f
    loadFile(f)
  }
}

// 超大文件仅读取前 1000 行，避免渲染卡顿
const OVERSIZED_MAX_LINES = 1000

function loadFile(file: typeof currentFile.value) {
  if (!file) return
  loadError.value = ""
  truncated.value = false
  const result = readMarkdownFile(file.path, file.oversized ? OVERSIZED_MAX_LINES : 0)
  if (result === null) {
    loadError.value = props.i18n.errReadFile
    rawContent.value = ""
  } else {
    rawContent.value = result.content
    truncated.value = result.truncated
  }
}

/** 复制成功反馈定时器 */
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function handleCopy() {
  if (!rawContent.value) return
  const ok = await copyToClipboard(rawContent.value)
  if (ok) {
    // 先清旧定时器，避免连续点击时旧定时器提前掐灭新反馈
    if (copiedTimer) clearTimeout(copiedTimer)
    copied.value = true
    copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  }
}

// ── 初始化 ──
onMounted(() => {
  if (files.value.length === 0) return
  // 优先打开 initialFile（若存在）
  if (props.initialFile) {
    const target = files.value.find(
      f => f.name.toLowerCase() === props.initialFile!.toLowerCase()
    )
    if (target) {
      currentFile.value = target
    }
  }
  loadFile(currentFile.value)
})

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style lang="scss">
@use "../../styles/MarkdownPreviewDialog.scss";
</style>
