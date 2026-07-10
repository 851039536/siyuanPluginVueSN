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
          <svg
            class="dialog-icon"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M3,11H11V3H3M5,5H9V9H5M13,3V11H21V3M19,9H15V5H19M3,21H11V13H3M5,15H9V19H5M18,13H16V15H13V18H15V21H18V18H21V15H18M21,21H19V19H21V21Z"
            />
          </svg>
          <span>{{ i18n.qrcodeGenerate || '二维码生成' }}</span>
        </div>
        <Button
          variant="ghost"
          size="xsmall"
          icon="x"
          :title="i18n.close || '关闭'"
          @click="closeDialog"
        />
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-body">
        <!-- 输入内容 -->
        <div class="input-section">
          <Input
            v-model="inputContent"
            type="textarea"
            :label="i18n.qrcodeContent || '内容'"
            :placeholder="i18n.qrcodePlaceholder || '输入或选择内容生成二维码...'"
            :rows="3"
            @input="debouncedRegenerate"
          />
        </div>

        <!-- 二维码预览 -->
        <div class="qrcode-section">
          <Label
            tag="span"
            size="xsmall"
          >{{ i18n.qrcodePreview || '二维码预览' }}</Label>
          <div
            ref="qrcodeContainer"
            class="qrcode-preview"
          ></div>
        </div>

        <!-- 设置选项 -->
        <div class="settings-section">
          <div class="setting-item">
            <Slider
              v-model="qrcodeSize"
              :label="i18n.qrcodeSize || '大小'"
              :min="100"
              :max="500"
              :step="10"
              :showValue="true"
              :formatValue="v => `${v}px`"
              size="xsmall"
              @input="debouncedRegenerate"
            />
          </div>

          <div class="setting-item">
            <Select
              v-model="errorCorrection"
              :label="i18n.qrcodeErrorCorrection || '纠错级别'"
              :options="errorCorrectionOptions"
              @change="debouncedRegenerate"
            />
          </div>
        </div>
      </div>

      <!-- 对话框底部 -->
      <div class="dialog-footer">
        <Button
          variant="secondary"
          icon="copy"
          :disabled="!inputContent"
          block
          @click="copyQRCode"
        >
          {{ i18n.qrcodeCopy || '复制图片' }}
        </Button>
        <Button
          variant="secondary"
          icon="download"
          :disabled="!inputContent"
          block
          @click="downloadQRCode"
        >
          {{ i18n.qrcodeDownload || '下载' }}
        </Button>
        <Button
          variant="primary"
          block
          @click="closeDialog"
        >
          {{ i18n.close || '关闭' }}
        </Button>
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
import Input from "@/components/Input.vue"
import Label from "@/components/Label.vue"
import Select from "@/components/Select.vue"
import Slider from "@/components/Slider.vue"
import { triggerBlobDownload } from "@/utils/domUtils"
import { debounce, showMessage } from "../core/utils"

interface Props {
  visible: boolean
  content?: string
  i18n?: Record<string, any>
}

interface Emits {
  (e: "update:visible", value: boolean): void
  (e: "close"): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const emit = defineEmits<Emits>()

// 状态
const inputContent = ref(props.content || "")
const qrcodeSize = ref(180)
const errorCorrection = ref<"L" | "M" | "Q" | "H">("M")
const qrcodeContainer = ref<HTMLDivElement>()
const lastGeneratedContent = ref("")

const errorCorrectionOptions = computed<SelectOption[]>(() => [
  {
    value: "L",
    label: props.i18n.qrcodeErrorL || "L (7%)",
  },
  {
    value: "M",
    label: props.i18n.qrcodeErrorM || "M (15%)",
  },
  {
    value: "Q",
    label: props.i18n.qrcodeErrorQ || "Q (25%)",
  },
  {
    value: "H",
    label: props.i18n.qrcodeErrorH || "H (30%)",
  },
])

// 监听props变化
watch(
  () => props.content,
  (newContent) => {
    if (newContent && newContent !== lastGeneratedContent.value) {
      inputContent.value = newContent
      lastGeneratedContent.value = newContent
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

    // 竞态保护：只保留最新一次结果
    if (seq !== generateSeq) return

    // 清空容器并追加
    qrcodeContainer.value.innerHTML = ""
    qrcodeContainer.value.appendChild(canvas)
  } catch (error) {
    if (seq !== generateSeq) return
    showMessage(props.i18n.qrcodeGenerateFailed || "生成二维码失败", { timeout: 3000, type: "error" })
  }
}

// 防抖版本（300ms）
const debouncedRegenerate = debounce(regenerateQRCode, 300)

// 复制二维码到剪贴板
async function copyQRCode() {
  if (!qrcodeContainer.value) return

  const canvas = qrcodeContainer.value.querySelector("canvas")
  if (!canvas) {
    showMessage(props.i18n.qrcodeNotGenerated || "请先生成二维码", { timeout: 3000, type: "info" })
    return
  }

  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
    if (!blob) {
      showMessage(props.i18n.qrcodeCopyFailed || "复制失败", { timeout: 3000, type: "error" })
      return
    }

    const item = new ClipboardItem({ "image/png": blob })
    await navigator.clipboard.write([item])
    showMessage(props.i18n.qrcodeCopied || "二维码已复制到剪贴板", { timeout: 3000, type: "info" })
  } catch (error) {
    showMessage(props.i18n.qrcodeCopyFailed || "复制失败", { timeout: 3000, type: "error" })
  }
}

// 下载二维码
async function downloadQRCode() {
  if (!qrcodeContainer.value) return

  const canvas = qrcodeContainer.value.querySelector("canvas")
  if (!canvas) {
    showMessage(props.i18n.qrcodeNotGenerated || "请先生成二维码", { timeout: 3000, type: "info" })
    return
  }

  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
    if (!blob) {
      showMessage(props.i18n.qrcodeDownloadFailed || "下载失败", { timeout: 3000, type: "error" })
      return
    }

    triggerBlobDownload(blob, `qrcode-${Date.now()}.png`)
    showMessage(props.i18n.qrcodeDownloaded || "二维码已下载", { timeout: 3000, type: "info" })
  } catch (error) {
    showMessage(props.i18n.qrcodeDownloadFailed || "下载失败", { timeout: 3000, type: "error" })
  }
}

// 关闭对话框
function closeDialog() {
  emit("update:visible", false)
  emit("close")
}
</script>

<style lang="scss">
@use "../styles/qrcode.scss";
</style>
