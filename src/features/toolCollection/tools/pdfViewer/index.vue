<!-- PDF 预览工具 — 拖拽 PDF 文件到面板内嵌 iframe 显示，支持缩放翻页 -->
<template>
  <div
    class="pdf-viewer"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 无文件时：拖拽引导区 -->
    <div
      v-if="!pdfPath"
      class="pv-dropzone"
      :class="{ 'drag-over': isDragOver }"
    >
      <Icon
        icon="mdi:file-pdf-box"
        :size="48"
        class="pv-dropzone-icon"
      />
      <!-- 拖拽提示主文案："将 PDF 文件拖拽到此处" -->
      <span class="pv-dropzone-hint">{{ i18n.pdfViewer?.dropHint }}</span>
      <!-- 拖拽提示副文案："支持本地 .pdf 文件" -->
      <span class="pv-dropzone-sub">{{ i18n.pdfViewer?.dropSubHint }}</span>
    </div>

    <!-- 有文件时：工具栏 + iframe -->
    <template v-else>
      <!-- 顶部工具栏 -->
      <div class="pv-toolbar">
        <Icon
          icon="mdi:file-pdf-box"
          :size="14"
        />
        <span class="pv-filename">{{ fileName }}</span>
        <!-- 缩放提示："Ctrl + 滚轮缩放" -->
        <span class="pv-zoom-hint">{{ i18n.pdfViewer?.zoomHint }}</span>
        <!-- 清除按钮："清除" -->
        <button
          class="pv-btn"
          @click="handleClear"
        >
          {{ i18n.pdfViewer?.clear }}
        </button>
      </div>
      <!-- PDF 内嵌显示区 -->
      <iframe
        class="pv-frame"
        :src="fileUrl"
      />
    </template>

    <!-- 拖拽悬浮遮罩（有文件时拖入新文件） -->
    <div
      v-if="pdfPath && isDragOver"
      class="pv-dropzone-overlay"
    >
      <Icon
        icon="mdi:file-pdf-box"
        :size="36"
      />
      <!-- 拖拽提示主文案："将 PDF 文件拖拽到此处" -->
      <span>{{ i18n.pdfViewer?.dropHint }}</span>
    </div>

    <!-- 错误提示 -->
    <Transition name="fade">
      <div
        v-if="errorMsg"
        class="pv-error"
      >
        {{ errorMsg }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * PDF 预览工具 - 主组件
 * 拖拽本地 PDF 文件后通过 iframe 内嵌 Electron PDF 查看器显示
 */
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { getPathsFromFiles } from "@/utils/electronDialog"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const pdfPath = ref<string | null>(null)
const fileName = ref("")
const isDragOver = ref(false)
const errorMsg = ref("")

/** 将 Windows 反斜杠路径转为 file:/// URL */
const fileUrl = computed(() => {
  if (!pdfPath.value) return ""
  const normalized = pdfPath.value.replace(/\\/g, "/")
  return `file:///${normalized}`
})

let errorTimer: ReturnType<typeof setTimeout> | null = null

function showError(msg: string) {
  errorMsg.value = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => { errorMsg.value = "" }, 2500)
}

function onDragOver() {
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  // 兼容旧版 File.path 与 Electron 32+ webUtils.getPathForFile
  const paths = getPathsFromFiles(Array.from(files))
  if (paths.length === 0) return

  const filePath = paths[0]
  if (!filePath.toLowerCase().endsWith(".pdf")) {
    showError(props.i18n.pdfViewer?.notPdf ?? "Only PDF files are supported")
    return
  }

  pdfPath.value = filePath
  fileName.value = filePath.split(/[\\/]/).pop() ?? filePath
}

function handleClear() {
  pdfPath.value = null
  fileName.value = ""
  errorMsg.value = ""
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
