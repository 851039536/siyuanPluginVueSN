<!-- 二维码 / 条形码生成对话框：输入内容生成码图，支持类型切换、参数调节、复制和下载 -->
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
            :name="codeType === 'qrcode' ? 'qrCode' : 'barcode'"
            color="inherit"
            class="dialog-icon"
          />
          <!-- 弹窗标题："生成二维码" / "生成条形码" -->
          <span>{{ codeType === 'qrcode' ? t('qrcodeGenerate', '生成二维码') : t('barcodeGenerate', '生成条形码') }}</span>
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
        <!-- 码类型切换（一组互斥选项，用 Button 分组 + aria-pressed） -->
        <div
          class="code-type-row"
          role="group"
          :aria-label="t('qrcodeCodeType', '码类型')"
        >
          <Button
            variant="secondary"
            size="small"
            icon="qrCode"
            :aria-pressed="codeType === 'qrcode'"
            @click="switchCodeType('qrcode')"
          >
            {{ t('qrcodeTabQrcode', '二维码') }}
          </Button>
          <Button
            variant="secondary"
            size="small"
            icon="barcode"
            :aria-pressed="codeType === 'barcode'"
            @click="switchCodeType('barcode')"
          >
            {{ t('qrcodeTabBarcode', '条形码') }}
          </Button>
        </div>

        <!-- 输入内容 -->
        <Textarea
          v-model="inputContent"
          :placeholder="codeType === 'qrcode'
            ? t('qrcodePlaceholder', '输入或选择内容生成二维码...')
            : t('barcodePlaceholder', '输入数字或字母生成条形码...')"
          :rows="3"
          :error="validationMessage || undefined"
          @input="debouncedRegenerate"
        />

        <!-- 码图预览（无输入时显示空状态） -->
        <div
          v-if="inputContent"
          ref="qrcodeContainer"
          class="qrcode-preview"
          :class="{ 'qrcode-preview--barcode': codeType === 'barcode' }"
        ></div>
        <div
          v-else
          class="qrcode-preview qrcode-empty"
        >
          <!-- 空状态提示："请先生成二维码" / "请先生成条形码" -->
          <span>{{ codeType === 'qrcode' ? t('qrcodeNotGenerated', '请先生成二维码') : t('barcodeNotGenerated', '请先生成条形码') }}</span>
        </div>

        <!-- 设置行：二维码参数（大小 + 纠错级别） -->
        <div
          v-if="codeType === 'qrcode'"
          class="settings-row"
        >
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

        <!-- 设置行：条形码参数（格式 + 条宽 + 高度 + 显示文字） -->
        <template v-else>
          <div class="settings-row">
            <Select
              v-model="barcodeFormat"
              class="setting-level setting-format"
              :label="t('barcodeFormat', '格式')"
              :options="barcodeFormatOptions"
              @change="debouncedRegenerate"
            />
            <Slider
              v-model="barcodeWidth"
              class="setting-size"
              :label="t('barcodeWidth', '条宽')"
              :min="barcodeWidthRange.min"
              :max="barcodeWidthRange.max"
              :step="barcodeWidthRange.step"
              :showValue="true"
              size="xsmall"
              @input="debouncedRegenerate"
            />
          </div>
          <div class="settings-row">
            <Slider
              v-model="barcodeHeight"
              class="setting-size"
              :label="t('barcodeHeight', '高度')"
              :min="barcodeHeightRange.min"
              :max="barcodeHeightRange.max"
              :step="barcodeHeightRange.step"
              :showValue="true"
              :formatValue="v => `${v}px`"
              size="xsmall"
              @input="debouncedRegenerate"
            />
            <div class="setting-toggle">
              <Switch
                v-model="barcodeDisplayValue"
                :label="t('barcodeDisplayValue', '显示文字')"
                size="small"
                @change="debouncedRegenerate"
              />
            </div>
          </div>
        </template>

        <!-- 操作行：复制 / 下载 -->
        <div class="actions-row">
          <!-- 按钮："复制图片" -->
          <Button
            variant="secondary"
            size="small"
            icon="copy"
            :disabled="!canExport"
            @click="copyCode"
          >
            {{ t('qrcodeCopy', '复制图片') }}
          </Button>
          <!-- 按钮："下载" -->
          <Button
            variant="primary"
            size="small"
            icon="download"
            :disabled="!canExport"
            @click="downloadCode"
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
import type {
  BarcodeErrorCode,
  BarcodeFormat,
  CodeType,
} from "../core/barcode"
import JsBarcode from "jsbarcode"
import QRCode from "qrcode"
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import Slider from "@/components/Slider.vue"
import Switch from "@/components/Switch.vue"
import Textarea from "@/components/Textarea.vue"
import { triggerBlobDownload } from "@/utils/domUtils"
import {
  BARCODE_FORMATS,
  BARCODE_HEIGHT_RANGE,
  BARCODE_WIDTH_RANGE,
  clampBarcodeOptions,
  validateBarcodeInput,
} from "../core/barcode"
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
  /** 码类型切换标签与分组名 */
  qrcodeCodeType?: string
  qrcodeTabQrcode?: string
  qrcodeTabBarcode?: string
  /** 条形码参数与提示 */
  barcodeGenerate?: string
  barcodeFormat?: string
  barcodeWidth?: string
  barcodeHeight?: string
  barcodeDisplayValue?: string
  barcodePlaceholder?: string
  barcodeNotGenerated?: string
  barcodeCopied?: string
  barcodeDownloaded?: string
  barcodeGenerateFailed?: string
  barcodeInvalidEan13?: string
  barcodeInvalidItf14?: string
  barcodeInvalidChars?: string
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
/** 当前码类型（默认二维码，保持既有行为） */
const codeType = ref<CodeType>("qrcode")
const qrcodeSize = ref(180)
/** 纠错级别（联合类型同时满足 QRCode 库的 errorCorrectionLevel 参数约束） */
const errorCorrection = ref<"L" | "M" | "Q" | "H">("M")
const qrcodeContainer = ref<HTMLDivElement>()

// 条形码状态
const barcodeFormat = ref<BarcodeFormat>("CODE128")
const barcodeWidth = ref(2)
const barcodeHeight = ref(80)
const barcodeDisplayValue = ref(true)

/** 供模板读取的范围常量 */
const barcodeWidthRange = BARCODE_WIDTH_RANGE
const barcodeHeightRange = BARCODE_HEIGHT_RANGE

/**
 * 当前输入相对当前码类型的校验错误码
 *
 * 二维码对输入无格式要求（qrcode 库可编码任意文本），故恒为 null；
 * 条形码的格式约束见 core/barcode.ts。
 */
const validationError = computed<BarcodeErrorCode | null>(() => {
  if (codeType.value === "qrcode") return null
  return validateBarcodeInput(barcodeFormat.value, inputContent.value)
})

/** 把错误码映射为提示文案（无错误时为空串） */
const validationMessage = computed<string>(() => {
  switch (validationError.value) {
    case null:
      return ""
    case "empty":
      return ""
    case "ean13-format":
      return t("barcodeInvalidEan13", "EAN-13 需要 12 或 13 位数字（13 位时校验位需正确）")
    case "itf14-format":
      return t("barcodeInvalidItf14", "ITF-14 需要 13 或 14 位数字")
    case "unsupported-chars":
      return t("barcodeInvalidChars", "内容包含当前格式不支持的字符")
    default:
      return ""
  }
})

/**
 * 是否允许复制/下载
 *
 * 除「有输入」外还需校验通过：非法输入下 JsBarcode 会留下一张空白画布，
 * 若不拦截，用户会把空白图复制/下载出去却毫无察觉。
 */
const canExport = computed(() =>
  Boolean(inputContent.value) && validationError.value === null,
)

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

const barcodeFormatOptions = computed<SelectOption[]>(() =>
  BARCODE_FORMATS.map(format => ({
    value: format.value,
    label: format.value,
  })),
)

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
        regenerateCode()
      })
      return
    }
    // 打开期间父组件推送新内容
    if (newContent && newContent !== oldContent) {
      inputContent.value = newContent
      nextTick(() => {
        regenerateCode()
      })
    }
  },
)

// 竞态保护序号
let generateSeq = 0

/**
 * 切换码类型
 *
 * 参数（尺寸/纠错级别/格式）各自保留，切回时不丢失用户设置；
 * 输入内容两种码共用，便于对比同一串文本的两种呈现。
 */
function switchCodeType(type: CodeType) {
  if (codeType.value === type) return
  codeType.value = type
  // 画布尺寸语义变化（二维码正方形 / 条形码宽扁），需重建预览容器后重绘
  nextTick(() => {
    regenerateCode()
  })
}

/**
 * 生成码图（按当前类型分派到二维码或条形码渲染）
 */
async function regenerateCode() {
  if (!inputContent.value || !qrcodeContainer.value) return

  const seq = ++generateSeq
  const type = codeType.value

  // 先建独立 canvas 再提交：两条渲染分支共用同一段「清空 + 追加」逻辑，
  // 也避免渲染中途弹窗卸载导致 half-built 节点留在容器里
  const canvas = document.createElement("canvas")

  try {
    if (type === "qrcode") {
      await QRCode.toCanvas(canvas, inputContent.value, {
        width: qrcodeSize.value,
        errorCorrectionLevel: errorCorrection.value,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
    } else {
      // 前置校验：非法输入 JsBarcode 不抛错，只会画出一张空白画布
      const error = validateBarcodeInput(barcodeFormat.value, inputContent.value)
      if (error) {
        // 清空上一次的画面：留着旧图会让用户误以为当前输入已成功编码，
        // 且导出按钮虽已置灰，视觉上的残留仍是误导
        if (seq === generateSeq) {
          qrcodeContainer.value.innerHTML = ""
        }
        return
      }

      const options = clampBarcodeOptions({
        width: barcodeWidth.value,
        height: barcodeHeight.value,
        displayValue: barcodeDisplayValue.value,
      })

      // JsBarcode 以 valid 回调报告成败且不抛异常，需自行捕获此信号
      let isValid = false
      JsBarcode(canvas, inputContent.value, {
        format: barcodeFormat.value,
        width: options.width,
        height: options.height,
        displayValue: options.displayValue,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
        valid: (valid: boolean) => {
          isValid = valid
        },
      })

      if (!isValid) {
        // 库判定的非法（如 EAN-13 校验位错误）——同样不提交空白画布
        if (seq === generateSeq) {
          qrcodeContainer.value.innerHTML = ""
        }
        showMessage(t("barcodeGenerateFailed", "生成条形码失败"), { timeout: 3000, type: "error" })
        return
      }
    }

    // 竞态保护：只保留最新一次结果；容器可能已随弹窗关闭卸载
    if (seq !== generateSeq || !qrcodeContainer.value) return

    // 清空容器并追加
    qrcodeContainer.value.innerHTML = ""
    qrcodeContainer.value.appendChild(canvas)
  } catch {
    if (seq !== generateSeq) return
    showMessage(
      type === "qrcode"
        ? t("qrcodeGenerateFailed", "生成二维码失败")
        : t("barcodeGenerateFailed", "生成条形码失败"),
      { timeout: 3000, type: "error" },
    )
  }
}

// 防抖版本（300ms）
const debouncedRegenerate = debounce(regenerateCode, 300)

/**
 * 从预览容器提取码图画布的 PNG Blob（无画布时提示并返回 null）
 */
async function getCanvasBlob(): Promise<Blob | null> {
  const canvas = qrcodeContainer.value?.querySelector("canvas")
  if (!canvas) {
    showMessage(
      codeType.value === "qrcode"
        ? t("qrcodeNotGenerated", "请先生成二维码")
        : t("barcodeNotGenerated", "请先生成条形码"),
      { timeout: 3000, type: "info" },
    )
    return null
  }
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve))
}

// 复制码图到剪贴板
async function copyCode() {
  const blob = await getCanvasBlob()
  if (!blob) return

  try {
    const item = new ClipboardItem({ "image/png": blob })
    await navigator.clipboard.write([item])
    showMessage(
      codeType.value === "qrcode"
        ? t("qrcodeCopied", "二维码已复制到剪贴板")
        : t("barcodeCopied", "条形码已复制到剪贴板"),
      { timeout: 3000, type: "info" },
    )
  } catch {
    showMessage(t("qrcodeCopyFailed", "复制失败"), { timeout: 3000, type: "error" })
  }
}

// 下载码图
async function downloadCode() {
  const blob = await getCanvasBlob()
  if (!blob) return

  const prefix = codeType.value === "qrcode" ? "qrcode" : "barcode"

  try {
    triggerBlobDownload(blob, `${prefix}-${Date.now()}.png`)
    showMessage(
      codeType.value === "qrcode"
        ? t("qrcodeDownloaded", "二维码已下载")
        : t("barcodeDownloaded", "条形码已下载"),
      { timeout: 3000, type: "info" },
    )
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
