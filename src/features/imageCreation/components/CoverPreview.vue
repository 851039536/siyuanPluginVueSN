<!-- 封面预览面板：iframe 缩放预览 + 导出格式 + 复制/下载/全屏操作 -->
<template>
  <div class="preview-panel">
    <div class="preview-header">
      <!-- 预览标题："封面预览" -->
      <span>{{ t.previewTitle }}</span>
      <div class="preview-actions">
        <!-- 导出格式下拉 -->
        <Select
          v-model="settings.exportFormat"
          :options="exportFormatOptions"
          size="xsmall"
        />
        <Slider
          v-if="settings.exportFormat === 'jpeg'"
          v-model="settings.jpegQuality"
          :label="t.jpegQualityLabel"
          :min="0.5"
          :max="1"
          :step="0.05"
          size="xsmall"
          :show-value="true"
          :format-value="qualityFormat"
        />
        <Button
          v-if="status === 'done'"
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          :title="t.copyImage"
          @click="copyCoverAsImage"
        />
        <Button
          v-if="status === 'done'"
          variant="ghost"
          size="xsmall"
          icon="download"
          :title="t.downloadImage"
          @click="downloadCoverAsImage"
        />
        <Button
          v-if="status === 'done'"
          variant="ghost"
          size="xsmall"
          icon="eye"
          :title="t.fullscreenPreview"
          @click="openFullscreen"
        />
      </div>
    </div>

    <div
      ref="previewWrapper"
      class="preview-content"
    >
      <!-- 空状态 -->
      <div
        v-if="!coverHtml"
        class="preview-empty"
      >
        <IconWrapper
          name="image"
          :size="48"
        />
        <!-- 空状态主文案 -->
        <p>{{ t.previewEmpty }}</p>
        <!-- 空状态辅助文案 -->
        <p class="preview-hint">{{ t.previewEmptyHint }}</p>
      </div>

      <!-- 预览封面 -->
      <div
        v-else
        class="preview-iframe-wrapper"
      >
        <div
          class="preview-iframe-scaler"
          :style="iframeScalerStyle"
        >
          <iframe
            ref="coverFrame"
            class="cover-preview-iframe"
            :style="iframeStyle"
            sandbox="allow-scripts allow-same-origin"
            :srcdoc="coverHtml"
          ></iframe>
        </div>
      </div>
    </div>

    <!-- 封面尺寸信息 -->
    <div
      v-if="coverHtml"
      class="preview-meta"
    >
      {{ width }} × {{ height }} px
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 封面预览面板：iframe 缩放预览 + 导出格式选择 + 复制/下载/全屏
 */
import type { SelectOption } from "@/components/Select.vue"
import type { CoverGenerationStatus, ExportFormat } from "../types"
import type { ImageCreationI18n } from "../types"
import type { CoverSettingsService } from "../composables/useCoverSettings"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import Slider from "@/components/Slider.vue"
import { usePlugin } from "@/main"
import {
  canvasToBlob,
  copyImageToClipboard,
  triggerBlobDownload,
} from "@/utils/domUtils"

interface Props {
  visible: boolean
  /** 封面 HTML（srcdoc 渲染） */
  coverHtml: string
  /** 封面实际宽度（px） */
  width: number
  /** 封面实际高度（px） */
  height: number
  /** 生成状态（done 时显示操作按钮） */
  status: CoverGenerationStatus
  /** 封面设置服务（导出格式/质量读写） */
  settingsService: CoverSettingsService
}

const props = defineProps<Props>()

const settings = props.settingsService.settings

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const coverFrame = ref<HTMLIFrameElement | null>(null)
const previewWrapper = ref<HTMLDivElement | null>(null)
const previewScale = ref(1)

const exportFormatOptions: SelectOption[] = [
  { value: "png", label: t.formatPng },
  { value: "jpeg", label: t.formatJpeg },
  { value: "webp", label: t.formatWebp },
]

const MIME_MAP: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

/** 导出文件名后缀（jpeg → jpg） */
function exportExtension(): string {
  const fmt = settings.value.exportFormat
  return fmt === "jpeg" ? "jpg" : fmt
}

/** 按当前格式构建导出 Blob（jpeg 带质量参数） */
async function buildExportBlob(): Promise<Blob | null> {
  const canvas = await captureCoverCanvas()
  if (!canvas) return null
  const fmt = settings.value.exportFormat
  const quality = fmt === "jpeg" ? settings.value.jpegQuality : undefined
  return canvasToBlob(canvas, MIME_MAP[fmt], quality)
}

// iframe 缩放样式：让封面按实际尺寸渲染，CSS 缩放适配预览区
// 使用 center center 原点 + flex 父容器居中，无需负 margin 偏移
const iframeScalerStyle = computed(() => {
  const s = previewScale.value
  // 无效 scale 时回退到容器自适应
  if (s <= 0 || !Number.isFinite(s)) {
    return {
      width: "100%",
      height: "100%",
    }
  }
  const w = props.width
  const h = props.height
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `scale(${s})`,
    transformOrigin: "center center",
  }
})

// iframe 内联样式（设置 iframe 自身的尺寸与封面一致）
const iframeStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
}))

// 计算预览缩放比例
function updatePreviewScale() {
  const wrapper = previewWrapper.value
  if (!wrapper) return
  const wrapperRect = wrapper.getBoundingClientRect()
  // 留出 padding 空间
  const availW = wrapperRect.width - 32
  const availH = wrapperRect.height - 32
  // 容器尺寸无效时使用上次有效值或默认 0.5
  if (availW <= 0 || availH <= 0) {
    if (previewScale.value <= 0 || !Number.isFinite(previewScale.value)) {
      previewScale.value = 0.5
    }
    return
  }
  const scaleX = availW / props.width
  const scaleY = availH / props.height
  previewScale.value = Math.max(0.05, Math.min(scaleX, scaleY, 1))
}

// ResizeObserver 监听预览区大小变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    updatePreviewScale()
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

// 监听 visible 变化，打开时启动缩放监听
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // 打开时启动缩放监听
      nextTick(() => {
        updatePreviewScale()
        if (previewWrapper.value && resizeObserver) {
          resizeObserver.observe(previewWrapper.value)
        }
      })
    } else {
      // 关闭时断开监听
      if (previewWrapper.value && resizeObserver) {
        resizeObserver.unobserve(previewWrapper.value)
      }
    }
  },
)

// 监听封面生成完成，重新计算缩放
watch(
  () => props.coverHtml,
  () => {
    if (props.coverHtml) {
      nextTick(() => updatePreviewScale())
    }
  },
)

// 获取封面截图画布（大尺寸动态降采样，控制内存占用）
async function captureCoverCanvas(): Promise<HTMLCanvasElement | null> {
  const iframe = coverFrame.value
  const doc = iframe?.contentDocument
  if (!doc?.body) return null

  await nextTick()

  // 使用 body 而非 firstElementChild，确保捕获完整封面内容
  return html2canvas(doc.body, {
    useCORS: true,
    scale: props.width <= 1600 ? 2 : 1.5,
    backgroundColor: "#ffffff",
    logging: false,
    width: props.width,
    height: props.height,
    windowWidth: props.width,
    windowHeight: props.height,
  })
}

// 复制为图片
async function copyCoverAsImage() {
  try {
    const blob = await buildExportBlob()
    if (!blob) {
      showMessage(t.msgNothingToCopy, 2000, "info")
      return
    }

    const ok = await copyImageToClipboard(blob)

    if (ok) {
      showMessage(t.msgCoverCopied, 2000, "info")
    } else {
      // 兜底：剪贴板不可用时降级为下载
      triggerBlobDownload(blob, `cover-${props.width}x${props.height}-${Date.now()}.${exportExtension()}`)
      showMessage(t.msgCopiedFallback, 2000, "info")
    }
  } catch (error) {
    console.error("复制封面为图片失败:", error)
    showMessage(t.msgCopyFailed, 2000, "error")
  }
}

// 下载为图片
async function downloadCoverAsImage() {
  try {
    const blob = await buildExportBlob()
    if (!blob) {
      showMessage(t.msgNothingToDownload, 2000, "info")
      return
    }

    triggerBlobDownload(blob, `cover-${props.width}x${props.height}-${Date.now()}.${exportExtension()}`)
    showMessage(t.msgCoverDownloaded, 2000, "info")
  } catch (error) {
    console.error("下载封面失败:", error)
    showMessage(t.msgDownloadFailed, 2000, "error")
  }
}

// 全屏预览
function openFullscreen() {
  if (!props.coverHtml) return
  const blob = new Blob([props.coverHtml], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  window.open(url, "_blank")
}

const qualityFormat = (v: number) => `${Math.round(v * 100)}%`
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
