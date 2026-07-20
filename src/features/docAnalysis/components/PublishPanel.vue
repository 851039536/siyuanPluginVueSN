<!-- 发布面板组件 - Markdown 编辑器 + 微信排版预览 + 导出 -->
<template>
  <div class="publish-panel">
    <!-- 顶部工具栏 -->
    <div class="publish-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-label">微信公众号</span>
        <button
          class="toolbar-btn format-btn"
          title="一键应用微信公众号排版规则"
          :disabled="!mdText"
          @click="handleFormat"
        >
          一键排版
        </button>
      </div>
      <div class="toolbar-right">
        <button
          class="toolbar-btn primary"
          title="复制微信兼容的 HTML（可直接粘贴到公众号后台）"
          :disabled="!renderedHtml"
          @click="copyHtml"
        >
          复制 HTML
        </button>
        <button
          class="toolbar-btn"
          title="复制 Markdown 原文"
          :disabled="!mdText"
          @click="copyMarkdown"
        >
          复制 MD
        </button>
        <button
          class="toolbar-btn"
          title="下载为 HTML 文件"
          :disabled="!renderedHtml"
          @click="downloadHtml"
        >
          下载
        </button>
        <button
          class="toolbar-btn publish-external-btn"
          title="复制 Markdown 内容后跳转到 md.doocs.org 发布"
          :disabled="!mdText"
          @click="publishToDoocs"
        >
          <Icon icon="mdi:open-in-new" />
          发布
        </button>
      </div>
    </div>

    <!-- 提醒横幅 -->
    <div
      v-if="showTip"
      class="publish-tip-bar"
    >
      <Icon
        icon="mdi:information-outline"
        class="tip-icon"
      />
      <span class="tip-text">
        提示：排版完成后点击<strong>「发布」</strong>按钮，内容将复制到剪贴板并跳转至 <strong>md.doocs.org</strong>；如需同步到多平台，请配合 <strong>COSE - 多平台文章同步插件</strong> 使用
      </span>
      <button
        class="tip-close-btn"
        @click="showTip = false"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>

    <!-- 分屏编辑+预览区 -->
    <div class="publish-split">
      <div class="publish-editor-pane">
        <MarkdownEditor
          v-model="mdText"
          :placeholder="placeholderText"
        />
      </div>
      <div class="publish-divider" />
      <div class="publish-preview-pane">
        <PreviewPane
          :html="renderedHtml"
        />
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="publish-statusbar">
      <span class="statusbar-left">
        字数：{{ wordCount }}
      </span>
      <span class="statusbar-right">
        微信公众号排版
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import { Icon } from "@iconify/vue"
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { exportMdContent } from "@/api"
import { copyToClipboard, triggerBlobDownload } from "@/utils/domUtils"
import type { PublishTheme } from "../types/index"
import { parseMarkdown } from "../utils/mdRenderer"
import { applyTheme, buildExportableHtml } from "../utils/themeApplicator"
import { DEFAULT_THEME } from "../utils/themes"
import { copyDocForPublish, openExternalPublish } from "../utils/publishActions"
import MarkdownEditor from "./MarkdownEditor.vue"
import PreviewPane from "./PreviewPane.vue"

interface Props {
  plugin: Plugin
  docId?: string
  initialMd?: string
}

const props = defineProps<Props>()

// ============================================================
// 状态
// ============================================================
const mdText = ref("")
const currentTheme = ref<PublishTheme>(DEFAULT_THEME)
const renderedHtml = ref("")
const showTip = ref(true)

// ============================================================
// 加载文档内容（如果从文档列表打开）
// ============================================================
async function loadDocContent() {
  if (props.docId) {
    const result = await exportMdContent(props.docId)
    if (result?.content) {
      mdText.value = result.content
    }
  } else if (props.initialMd) {
    mdText.value = props.initialMd
  }
}

loadDocContent()

// ============================================================
// 占位文本
// ============================================================
const placeholderText = computed(() => {
  if (props.docId) {
    return "文档内容已加载，可编辑后发布..."
  }
  return "在此输入或粘贴 Markdown 内容..."
})

// ============================================================
// 字数统计
// ============================================================
const wordCount = computed(() => {
  const text = mdText.value || ""
  // 中文字符计数 + 英文单词计数
  const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return cnChars > 0 ? cnChars.toLocaleString() : "0"
})

// ============================================================
// 300ms 防抖渲染管线
// ============================================================
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastRenderedMd = ""

function scheduleRender() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  const md = mdText.value

  // 内容未变，跳过渲染
  if (md === lastRenderedMd) {
    return
  }

  debounceTimer = setTimeout(() => {
    render()
  }, 300)
}

function render() {
  const md = mdText.value
  const theme = currentTheme.value

  if (!md.trim()) {
    renderedHtml.value = ""
    lastRenderedMd = ""
    return
  }

  try {
    const rawHtml = parseMarkdown(md)
    const themedHtml = applyTheme(rawHtml, theme)
    renderedHtml.value = themedHtml
    lastRenderedMd = md
  } catch (e) {
    console.error("渲染 Markdown 失败:", e)
    renderedHtml.value = `<p style="color:red;">渲染失败: ${e instanceof Error ? e.message : "未知错误"}</p>`
  }
}

// 监听 mdText 变化
watch(mdText, () => {
  scheduleRender()
})

// ============================================================
// 工具栏事件
// ============================================================
function handleFormat() {
  // 一键排版：触发重新渲染
  lastRenderedMd = ""
  render()
  showMessage("已应用微信公众号排版", 2000, "info")
}

// ============================================================
// 导出功能
// ============================================================
async function copyHtml() {
  if (!renderedHtml.value) return
  await copyToClipboard(renderedHtml.value)
  showMessage("HTML 已复制到剪贴板，可直接粘贴到公众号后台", 2000, "info")
}

async function copyMarkdown() {
  if (!mdText.value) return
  await copyToClipboard(mdText.value)
  showMessage("Markdown 原文已复制到剪贴板", 2000, "info")
}

function downloadHtml() {
  if (!renderedHtml.value) return
  const fullHtml = buildExportableHtml(renderedHtml.value, "发布文章")
  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" })
  triggerBlobDownload(blob, `article-${Date.now()}.html`)
  showMessage("HTML 文件下载中...", 2000, "info")
}

async function publishToDoocs() {
  if (!mdText.value) return
  const ok = await copyDocForPublish(props.docId || "", "")
  if (ok) openExternalPublish("https://md.doocs.org/", "md.doocs.org", 400)
}

// ============================================================
// 清理
// ============================================================
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
</script>

<style lang="scss" scoped>
@use "../styles/PublishPanel.scss";
</style>
