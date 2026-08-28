<!-- 二维码生成对话框：输入内容生成二维码，支持复制和下载 -->
<template>
  <div
    v-if="visible"
    class="qrcode-overlay"
    @click.self="closeDialog"
  >
    <div class="qrcode-dialog">
      <!-- 对话框头部 -->
      <div class="dialog-header">
        <div class="dialog-title">
          <IconWrapper
            name="qrCode"
            color="inherit"
            class="dialog-icon"
          />
          <!-- 弹窗标题："生成二维码" -->
          <span>{{ t('qrcodeGenerate', '生成二维码') }}</span>
        </div>
        <Button
          variant="ghost"
          size="xsmall"
          icon="x"
          :title="t('close', '关闭')"
          @click="closeDialog"
        />
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-body">
        <!-- 输入内容 -->
        <Input
          v-model="inputContent"
          type="textarea"
          :placeholder="t('qrcodePlaceholder', '输入或选择内容生成二维码...')"
          :rows="3"
          @input="debouncedRegenerate"
        />

        <!-- 二维码预览（无输入时显示空状态） -->
        <div
          v-if="inputContent"
          ref="qrcodeContainer"
          class="qrcode-preview"
        ></div>
        <div
          v-else
          class="qrcode-preview qrcode-empty"
        >
          <!-- 空状态提示："请先生成二维码" -->
          <span>{{ t('qrcodeNotGenerated', '请先生成二维码') }}</span>
        </div>

        <!-- 设置行：大小滑块 + 纠错级别 -->
        <div class="settings-row">
          <Slider
            v-model="qrcodeSize"
            class="setting-size"
            :label="t('qrcodeSize', '大小')"
            :min="100"
            :max="500"
            :step="10"
            :showValue="true"
            :formatValue="v => `${v}px`"
            size="xsmall"
            @input="debouncedRegenerate"
          />
          <Select
            v-model="errorCorrection"
            class="setting-level"
            :label="t('qrcodeErrorCorrection', '纠错级别')"
            :options="errorCorrectionOptions"
            @change="debouncedRegenerate"
          />
        </div>

        <!-- 操作行：复制 / 下载 -->
        <div class="actions-row">
          <!-- 按钮："复制图片" -->
          <Button
            variant="secondary"
            size="small"
            icon="copy"
            :disabled="!inputContent"
            @click="copyQRCode"
          >
            {{ t('qrcodeCopy', '复制图片') }}
          </Button>
          <!-- 按钮："下载" -->
          <Button
            variant="primary"
            size="small"
            icon="download"
            :disabled="!inputContent"
            @click="downloadQRCode"
          >
            {{ t('qrcodeDownload', '下载') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import QRCode from "qrcode"
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Slider from "@/components/Slider.vue"
import { triggerBlobDownload } from "@/utils/domUtils"
import { debounce, showMessage } from "../core/utils"

/** 弹窗 i18n 文案（键与 src/i18n 分片 qrcode.json 对应） */
interface QRCodeI18n {
  qrcodeGenerate?: string
  qrcodeContent?: string
  qrcodePlaceholder?: string
  qrcodePreview?: string
  qrcodeSize?: string
  qrcodeErrorCorrection?: string
  qrcodeErrorL?: string
  qrcodeErrorM?: string
  qrcodeErrorQ?: string
  qrcodeErrorH?: string
  qrcodeCopy?: string
  qrcodeDownload?: string
  qrcodeNotGenerated?: string
  qrcodeCopied?: string
  qrcodeCopyFailed?: string
  qrcodeDownloaded?: string
  qrcodeDownloadFailed?: string
  qrcodeGenerateFailed?: string
  close?: string
  [key: string]: string | undefined
}

interface Props {
  visible: boolean
  content?: string
  i18n?: QRCodeI18n
}

interface Emits {
  (e: "update:visible", value: boolean): void
  (e: "close"): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({} as QRCodeI18n),
})

const emit = defineEmits<Emits>()

/** 安全获取 i18n 文本 */
function t(key: string, fallback: string): string {
  return props.i18n?.[key] || fallback
}

// 状态
const inputContent = ref(props.content || "")
const qrcodeSize = ref(180)
/** 纠错级别（联合类型同时满足 QRCode 库的 errorCorrectionLevel 参数约束） */
const errorCorrection = ref<"L" | "M" | "Q" | "H">("M")
const qrcodeContainer = ref<HTMLDivElement>()

const errorCorrectionOptions = computed<SelectOption[]>(() => [
  {
    value: "L",
    label: t("qrcodeErrorL", "L (7%)"),
  },
  {
    value: "M",
    label: t("qrcodeErrorM", "M (15%)"),
  },
  {
    value: "Q",
    label: t("qrcodeErrorQ", "Q (25%)"),
  },
  {
    value: "H",
    label: t("qrcodeErrorH", "H (30%)"),
  },
])

// 监听 props 变化
watch(
  () => [props.content, props.visible] as const,
  ([newContent, newVisible], [oldContent, oldVisible]) => {
    if (!newVisible) return
    // 弹窗打开：以 props.content 为准重新生成（关闭期间画布 DOM 已被 v-if 销毁）
    if (!oldVisible) {
      if (newContent && newContent !== inputContent.value) {
        inputContent.value = newContent
      }
      nextTick(() => {
        regenerateQRCode()
      })
      return
    }
    // 打开期间父组件推送新内容
    if (newContent && newContent !== oldContent) {
      inputContent.value = newContent
      nextTick(() => {
        regenerateQRCode()
      })
    }
  },
)

// 竞态保护序号
let generateSeq = 0

// 生成二维码
async function regenerateQRCode() {
  if (!inputContent.value || !qrcodeContainer.value) return

  const seq = ++generateSeq

  try {
    // 生成二维码
    const canvas = await QRCode.toCanvas(inputContent.value, {
      width: qrcodeSize.value,
      errorCorrectionLevel: errorCorrection.value,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })

    // 竞态保护：只保留最新一次结果；容器可能已随弹窗关闭卸载
    if (seq !== generateSeq || !qrcodeContainer.value) return

    // 清空容器并追加
    qrcodeContainer.value.innerHTML = ""
    qrcodeContainer.value.appendChild(canvas)
  } catch {
    if (seq !== generateSeq) return
    showMessage(t("qrcodeGenerateFailed", "生成二维码失败"), { timeout: 3000, type: "error" })
  }
}

// 防抖版本（300ms）
const debouncedRegenerate = debounce(regenerateQRCode, 300)

/**
 * 从预览容器提取二维码画布的 PNG Blob（无画布时提示并返回 null）
 */
async function getCanvasBlob(): Promise<Blob | null> {
  const canvas = qrcodeContainer.value?.querySelector("canvas")
  if (!canvas) {
    showMessage(t("qrcodeNotGenerated", "请先生成二维码"), { timeout: 3000, type: "info" })
    return null
  }
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
}

// 复制二维码到剪贴板
async function copyQRCode() {
  const blob = await getCanvasBlob()
  if (!blob) return

  try {
    const item = new ClipboardItem({ "image/png": blob })
    await navigator.clipboard.write([item])
    showMessage(t("qrcodeCopied", "二维码已复制到剪贴板"), { timeout: 3000, type: "info" })
  } catch {
    showMessage(t("qrcodeCopyFailed", "复制失败"), { timeout: 3000, type: "error" })
  }
}

// 下载二维码
async function downloadQRCode() {
  const blob = await getCanvasBlob()
  if (!blob) return

  try {
    triggerBlobDownload(blob, `qrcode-${Date.now()}.png`)
    showMessage(t("qrcodeDownloaded", "二维码已下载"), { timeout: 3000, type: "info" })
  } catch {
    showMessage(t("qrcodeDownloadFailed", "下载失败"), { timeout: 3000, type: "error" })
  }
}

// 关闭对话框
function closeDialog() {
  emit("update:visible", false)
  emit("close")
}
</script>

<style scoped lang="scss">
@use "../styles/qrcode.scss";
</style>
