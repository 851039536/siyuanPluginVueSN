<!-- gitPush Markdown 文档预览弹窗 — Pattern B 内嵌 v-if 弹窗 -->
<template>
  <div
    class="gp-mask"
    @click.self="close"
  >
    <div class="gp-md-dialog">
      <!-- 头部 -->
      <div class="gp-md-header">
        <div class="gp-md-title">
          <Icon
            icon="mdi:file-document-multiple-outline"
            height="14"
          />
          <span>{{ i18n.previewMarkdown || '文档预览' }}</span>
        </div>
        <button
          class="gp-md-close"
          title="关闭"
          @click="close"
        >
          <Icon
            icon="mdi:close"
            height="16"
          />
        </button>
      </div>

      <!-- Tab 栏 -->
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
          {{ f.label }}
          <span
            v-if="f.oversized"
            class="gp-md-tab-warn"
            title="文件较大"
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
        <div
          v-if="loading"
          class="gp-md-loading"
        >
          <Icon
            icon="mdi:loading"
            height="16"
            class="gp-spin"
          />
          <span>加载中...</span>
        </div>

        <div
          v-else-if="!currentFile"
          class="gp-md-empty"
        >
          <Icon
            icon="mdi:file-document-outline"
            height="32"
          />
          <span>{{ i18n.noMarkdownFiles || '未找到 Markdown 文件' }}</span>
        </div>

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
        <span
          v-if="truncated"
          class="gp-md-warn"
        >
          <Icon
            icon="mdi:alert-circle-outline"
            height="12"
          />
          {{ i18n.fileOversized || '文件过大，仅显示前 1000 行' }}
        </span>
        <div class="gp-md-spacer" />
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="handleCopy"
        >
          <Icon
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            height="12"
          />
          <span>{{ copied ? (i18n.copied || '已复制') : (i18n.copyRaw || '复制原文') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GitProject, GitPushManager } from "../types"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { Icon } from "@iconify/vue"
import { parseMarkdown } from "@/utils/mdRenderer"
import { copyToClipboard } from "@/utils/domUtils"
import {
  readMarkdownFile,
  scanMarkdownFiles,
} from "../composables/useMarkdownFiles"
import { resolveValidPath } from "../utils"

const props = defineProps<{
  project: GitProject
  manager: GitPushManager
  i18n: Record<string, any>
  /** 初始打开的文件名（可选） */
  initialFile?: string
}>()

const emit = defineEmits<{
  close: []
}>()

// ── 状态 ──
/** 扫描到的所有 md 文件 */
const files = ref(scanMarkdownFiles(resolveValidPath(props.project)))
/** 当前选中的文件 */
const currentFile = ref(files.value[0] ?? null)
/** 当前文件原始内容 */
const rawContent = ref("")
/** 加载中 */
const loading = ref(false)
/** 读取错误 */
const loadError = ref("")
/** 是否被截断 */
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
    return `<p style="color:var(--b3-theme-error)">渲染失败</p>`
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

function loadFile(file: typeof currentFile.value) {
  if (!file) return
  loading.value = true
  loadError.value = ""
  truncated.value = false
  const maxLines = file.oversized ? 1000 : 0
  const content = readMarkdownFile(file.path, maxLines)
  if (content === null) {
    loadError.value = "读取文件失败"
    rawContent.value = ""
  } else {
    rawContent.value = content
    truncated.value = file.oversized
  }
  loading.value = false
}

function close() {
  emit("close")
}

/** 复制成功反馈定时器 */
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function handleCopy() {
  if (!rawContent.value) return
  const ok = await copyToClipboard(rawContent.value)
  if (ok) {
    copied.value = true
    copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  }
}

// ── 初始化 + 监听 ──
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

/** 项目变化时重新扫描 */
watch(
  () => props.project.id,
  () => {
    files.value = scanMarkdownFiles(resolveValidPath(props.project))
    currentFile.value = files.value[0] ?? null
    loadFile(currentFile.value)
  },
)
</script>

<style lang="scss">
@use "../styles/MarkdownPreviewDialog";
</style>
