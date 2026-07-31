<!-- PDF 预览工具 — 拖拽 PDF 文件到面板内嵌 iframe 显示，支持缩放翻页 -->
<template>
  <div
    ref="rootRef"
    class="pdf-viewer"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <!-- 无文件时：拖拽引导区（自身捕获拖拽事件） -->
    <div
      v-if="!pdfPath"
      class="pv-dropzone"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
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
        <!-- 全屏/还原按钮 -->
        <button
          class="pv-btn pv-btn-icon"
          :title="isFullscreen ? (i18n.pdfViewer?.restore ?? 'Restore') : (i18n.pdfViewer?.fullscreen ?? 'Fullscreen')"
          @click="toggleFullscreen"
        >
          <Icon
            :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'"
            :size="14"
          />
        </button>
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

    <!-- 拖拽捕获层（有文件时由 window 级检测激活，覆盖 iframe 接收 drop） -->
    <div
      v-if="pdfPath && isDragOver"
      class="pv-dropzone-overlay"
      @dragover.prevent
      @drop.prevent="onDrop"
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { getPathsFromFiles } from "@/utils/electronDialog"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const rootRef = ref<HTMLElement | null>(null)
const pdfPath = ref<string | null>(null)
const fileName = ref("")
const isDragOver = ref(false)
const isFullscreen = ref(false)
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

function onDrop(e: DragEvent) {
  isDragOver.value = false
  dragCounter = 0
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
  isFullscreen.value = false
  pdfPath.value = null
  fileName.value = ""
  errorMsg.value = ""
}

// ==================== 全屏切换（CSS 固定定位模拟，避免 Fullscreen API 渲染副作用） ====================
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isFullscreen.value) {
    isFullscreen.value = false
  }
}

// ==================== Window 级拖拽检测（有文件时不干扰 iframe 交互） ====================
let dragCounter = 0

function onWindowDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes("Files")) return
  if (!rootRef.value?.contains(e.target as Node)) return
  dragCounter++
  isDragOver.value = true
}

function onWindowDragLeave(e: DragEvent) {
  if (!rootRef.value?.contains(e.target as Node)) return
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragOver.value = false
  }
}

function onWindowDrop() {
  dragCounter = 0
  isDragOver.value = false
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
  window.addEventListener("dragenter", onWindowDragEnter)
  window.addEventListener("dragleave", onWindowDragLeave)
  window.addEventListener("drop", onWindowDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown)
  window.removeEventListener("dragenter", onWindowDragEnter)
  window.removeEventListener("dragleave", onWindowDragLeave)
  window.removeEventListener("drop", onWindowDrop)
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
