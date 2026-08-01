<template>
  <div class="base64-image-panel">
    <!-- 转换模式切换 -->
    <div class="mode-tabs">
      <Button
        v-for="mode in modes"
        :key="mode.value"
        class="mode-tab"
        :class="{ active: currentMode === mode.value }"
        variant="ghost"
        @click="switchMode(mode.value)"
      >
        {{ mode.label }}
      </Button>
    </div>

    <!-- 图片转Base64模式 -->
    <div
      v-if="currentMode === 'encode'"
      class="mode-content"
    >
      <!-- 上传区域："拖拽图片到此处，或" / "选择文件" -->
      <UploadArea
        :drag-text="i18n.base64Image_dragImageHere"
        :select-text="i18n.base64Image_selectFile"
        @file-select="handleFile"
      />

      <!-- 图片预览和Base64输出 -->
      <div
        v-if="selectedFile"
        class="result-section"
      >
        <div class="preview-section">
          <!-- 标题："图片预览" -->
          <h4>{{ i18n.base64Image_imagePreview }}</h4>
          <div
            class="image-preview"
            :style="previewFilterStyle"
          >
            <img
              :src="imagePreviewUrl"
              alt="Preview"
            />
          </div>
          <div class="file-info">
            <!-- 文件信息："文件名" / "文件大小" / "文件类型" -->
            <p><strong>{{ i18n.base64Image_fileName }}:</strong> {{ selectedFile.name }}</p>
            <p><strong>{{ i18n.base64Image_fileSize }}:</strong> {{ formatFileSize(selectedFile.size) }}</p>
            <p><strong>{{ i18n.base64Image_fileType }}:</strong> {{ selectedFile.type }}</p>
          </div>
        </div>

        <div class="output-section">
          <!-- 压缩设置 -->
          <div class="compression-settings">
            <!-- 标题："压缩设置" -->
            <h4>{{ i18n.base64Image_compressionSettings }}</h4>
            <div class="setting-group">
              <!-- 下拉框："输出格式" -->
              <Select
                v-model="outputFormat"
                :label="i18n.base64Image_outputFormat"
                :options="formatOptions"
                size="xsmall"
                @change="processImage"
              />
            </div>
            <div class="setting-group">
              <!-- 滑块："图片质量" -->
              <label>{{ i18n.base64Image_quality }}: {{ compressionQuality }}%</label>
              <input
                v-model="compressionQuality"
                type="range"
                min="10"
                max="100"
                step="5"
                class="quality-slider"
                @change="processImage"
              />
            </div>
            <div class="setting-group">
              <!-- 滑块："最大宽度" -->
              <label>{{ i18n.base64Image_maxWidth }}: {{ maxWidth }}px</label>
              <input
                v-model="maxWidth"
                type="range"
                min="100"
                max="2000"
                step="50"
                class="width-slider"
                @change="processImage"
              />
            </div>
            <div class="setting-group">
              <!-- 复选框："保持纵横比" -->
              <label class="checkbox-label">
                <input
                  v-model="maintainAspectRatio"
                  type="checkbox"
                  @change="processImage"
                />
                {{ i18n.base64Image_maintainAspectRatio }}
              </label>
            </div>
          </div>

          <!-- 滤镜设置 -->
          <FilterSettings
            v-model="filterSettings"
            :title="i18n.base64Image_filterSettings"
            :grayscale-label="i18n.base64Image_grayscale"
            :blur-label="i18n.base64Image_blur"
            :brightness-label="i18n.base64Image_brightness"
            :contrast-label="i18n.base64Image_contrast"
            :saturation-label="i18n.base64Image_saturation"
            :reset-text="i18n.base64Image_resetFilters"
            @reset="resetFilters"
            @update:model-value="processImage"
          />

          <!-- 水印设置 -->
          <WatermarkSettings
            v-model="watermarkSettings"
            :title="i18n.base64Image_watermarkSettings"
            :enable-text="i18n.base64Image_enableWatermark"
            :text-placeholder="i18n.base64Image_watermarkText"
            :position-label="i18n.base64Image_watermarkPosition"
            :position-options="watermarkPositionOptions"
            :opacity-label="i18n.base64Image_watermarkOpacity"
            :font-size-label="i18n.base64Image_watermarkSize"
            @update:model-value="processImage"
          />

          <!-- 标题："Base64输出" -->
          <h4>{{ i18n.base64Image_base64Output }}</h4>
          <div class="output-controls">
            <!-- 复制按钮："复制" -->
            <CopyDropdown
              :button-text="i18n.base64Image_copy"
              :options="copyOptions"
              @select="handleCopySelect"
            />
            <!-- 下载按钮："下载" -->
            <Button
              variant="primary"
              size="xsmall"
              @click="downloadBase64"
            >
              {{ i18n.base64Image_download }}
            </Button>
          </div>
          <Input
            v-model="base64Output"
            type="textarea"
            class="output-textarea"
            :placeholder="i18n.base64Image_base64Placeholder"
            :readonly="true"
            :rows="6"
          />

          <!-- 对比统计 -->
          <StatsSection
            :title="i18n.base64Image_statistics"
            :original-label="i18n.base64Image_originalSize"
            :output-label="i18n.base64Image_outputSize"
            :ratio-label="i18n.base64Image_compressionRatio"
            :original-size="originalSize"
            :output-size="base64OutputBytes"
          />
        </div>
      </div>
    </div>

    <!-- Base64转图片模式 -->
    <div
      v-if="currentMode === 'decode'"
      class="mode-content"
    >
      <div class="input-section">
        <!-- 标题："Base64输入" -->
        <h4>{{ i18n.base64Image_base64Input }}</h4>
        <Input
          v-model="base64Input"
          type="textarea"
          class="input-textarea"
          :placeholder="i18n.base64Image_base64InputPlaceholder"
          :rows="8"
        />
      </div>

      <div
        v-if="decodedImageUrl"
        class="result-section"
      >
        <div class="preview-section">
          <!-- 标题："图片预览" -->
          <h4>{{ i18n.base64Image_imagePreview }}</h4>
          <div class="image-preview">
            <img
              :src="decodedImageUrl"
              alt="Decoded Image"
            />
          </div>
        </div>

        <div class="output-section">
          <div class="output-controls">
            <!-- 下载图片按钮："下载图片" -->
            <Button
              variant="primary"
              size="xsmall"
              @click="downloadDecodedImage"
            >
              {{ i18n.base64Image_downloadImage }}
            </Button>
            <!-- 复制URL按钮："复制URL" -->
            <Button
              variant="ghost"
              size="xsmall"
              icon="contentCopy"
              :icon-size="14"
              @click="copyDecodedImageUrl"
            >
              {{ i18n.base64Image_copyUrl }}
            </Button>
          </div>
          <div class="output-info">
            <!-- 图片尺寸："图片大小" -->
            <p><strong>{{ i18n.base64Image_imageSize }}:</strong> {{ decodedImageSize }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- URL转Base64模式 -->
    <div
      v-if="currentMode === 'url'"
      class="mode-content"
    >
      <div class="input-section">
        <!-- 标题："URL输入" -->
        <h4>{{ i18n.base64Image_urlInput }}</h4>
        <input
          v-model="imageUrlInput"
          type="text"
          class="text-input url-input"
          :placeholder="i18n.base64Image_urlPlaceholder"
        />
        <!-- 获取并转换按钮："获取并转换" -->
        <Button
          variant="primary"
          :loading="isFetchingUrl"
          :disabled="!imageUrlInput || isFetchingUrl"
          class="fetch-btn"
          @click="fetchUrlToBase64"
        >
          {{ i18n.base64Image_fetch }}
        </Button>
      </div>

      <div
        v-if="urlBase64Output"
        class="result-section"
      >
        <div class="preview-section">
          <!-- 标题："图片预览" -->
          <h4>{{ i18n.base64Image_imagePreview }}</h4>
          <div class="image-preview">
            <img
              :src="urlBase64Output"
              alt="URL Preview"
            />
          </div>
        </div>

        <div class="output-section">
          <div class="output-controls">
            <!-- 复制按钮："复制" -->
            <CopyDropdown
              :button-text="i18n.base64Image_copy"
              :options="urlCopyOptions"
              @select="handleUrlCopySelect"
            />
            <!-- 下载按钮："下载" -->
            <Button
              variant="primary"
              size="xsmall"
              @click="downloadUrlBase64"
            >
              {{ i18n.base64Image_download }}
            </Button>
          </div>
          <Input
            v-model="urlBase64Output"
            type="textarea"
            class="output-textarea"
            :readonly="true"
            :rows="6"
          />
          <div class="output-info">
            <!-- 输出大小："输出大小" -->
            <p><strong>{{ i18n.base64Image_outputSize }}:</strong> {{ formatFileSize(urlBase64OutputBytes) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 二维码生成模式 -->
    <div
      v-if="currentMode === 'qrcode'"
      class="mode-content"
    >
      <QrcodeGenerator
        v-model:content="qrcodeInput"
        v-model:size="qrcodeSize"
        v-model:dark-mode="qrcodeDarkMode"
        :output="qrcodeOutput"
        :input-title="i18n.base64Image_qrcodeInput"
        :placeholder="i18n.base64Image_qrcodePlaceholder"
        :size-label="i18n.base64Image_qrcodeSize"
        :dark-mode-label="i18n.base64Image_qrcodeDark"
        :generate-text="i18n.base64Image_generateQrcode"
        :preview-title="i18n.base64Image_qrcodePreview"
        :download-text="i18n.base64Image_download"
        :copy-text="i18n.base64Image_copyBase64"
        :content-label="i18n.base64Image_content"
        @generate="generateQrcode"
        @download="downloadQrcode"
        @copy="copyQrcodeBase64"
      />
    </div>

    <!-- 转换按钮（解码模式） -->
    <div
      v-if="currentMode === 'decode' && base64Input"
      class="action-section"
    >
      <!-- 解码按钮："解码" -->
      <Button
        class="convert-btn"
        variant="primary"
        :loading="isDecoding"
        :disabled="isDecoding"
        @click="decodeBase64"
      >
        {{ i18n.base64Image_decode }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Base64图片转换工具：图片/Base64/URL/二维码互转，支持压缩、滤镜、水印
import type { SelectOption } from "@/components/Select.vue"
import QRCode from "qrcode"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import {
  copyToClipboard,
  triggerDownload,
} from "@/utils/domUtils"
import { formatFileSize } from "@/utils/format"
import CopyDropdown from "./components/CopyDropdown.vue"
import FilterSettings from "./components/FilterSettings.vue"
import QrcodeGenerator from "./components/QrcodeGenerator.vue"
import StatsSection from "./components/StatsSection.vue"
import UploadArea from "./components/UploadArea.vue"
import WatermarkSettings from "./components/WatermarkSettings.vue"

interface Props {
  i18n: Record<string, string>
}

const props = defineProps<Props>()

// computed 包装保持 i18n 响应式（父组件 i18n 变化时模板与派生数组同步更新）
const i18n = computed(() => props.i18n)

// 模式选项
type Mode = "encode" | "decode" | "url" | "qrcode"
const modes = computed(() => [
  {
    value: "encode" as Mode,
    label: props.i18n.base64Image_encode,
  },
  {
    value: "decode" as Mode,
    label: props.i18n.base64Image_decode,
  },
  {
    value: "url" as Mode,
    label: "URL",
  },
  {
    value: "qrcode" as Mode,
    label: props.i18n.base64Image_qrcode,
  },
])

const currentMode = ref<Mode>("encode")

// 编码模式相关
const selectedFile = ref<File | null>(null)
const imagePreviewUrl = ref("")
const base64Output = ref("")
const originalSize = ref(0)

// 解码模式相关
const base64Input = ref("")
const decodedImageUrl = ref("")
const decodedImageSize = ref("")

// URL模式相关
const imageUrlInput = ref("")
const urlBase64Output = ref("")
const isFetchingUrl = ref(false)

// 二维码模式相关
const qrcodeInput = ref("")
const qrcodeOutput = ref("")
const qrcodeSize = ref(200)
const qrcodeDarkMode = ref(false)

// 压缩设置
const outputFormat = ref("image/png")
const compressionQuality = ref(80)
const maxWidth = ref(1920)
const maintainAspectRatio = ref(true)

// 滤镜设置
const filterSettings = ref({
  grayscale: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
})

// 水印设置
const watermarkSettings = ref({
  enabled: false,
  text: "Watermark",
  position: "bottom-right",
  opacity: 50,
  fontSize: 24,
})

// 格式选项
const formatOptions: SelectOption[] = [
  {
    value: "image/jpeg",
    label: "JPEG",
  },
  {
    value: "image/png",
    label: "PNG",
  },
  {
    value: "image/webp",
    label: "WebP",
  },
  {
    value: "image/gif",
    label: "GIF",
  },
]

// 水印位置选项
const watermarkPositionOptions: SelectOption[] = [
  {
    value: "top-left",
    label: "左上角",
  },
  {
    value: "top-right",
    label: "右上角",
  },
  {
    value: "bottom-left",
    label: "左下角",
  },
  {
    value: "bottom-right",
    label: "右下角",
  },
  {
    value: "center",
    label: "居中",
  },
]

// 复制选项（encode 模式含 CSS，url 模式不含，由单一源数据派生）
const copyOptionBase = computed(() => [
  {
    value: "base64",
    label: props.i18n.base64Image_copyBase64,
  },
  {
    value: "html",
    label: props.i18n.base64Image_copyHtml,
  },
  {
    value: "markdown",
    label: props.i18n.base64Image_copyMarkdown,
  },
])

const copyOptions = computed(() => [
  ...copyOptionBase.value,
  {
    value: "css",
    label: props.i18n.base64Image_copyCss,
  },
])

const urlCopyOptions = computed(() => copyOptionBase.value)

// UI状态
const isDecoding = ref(false)

// 预览滤镜样式（与 processImage 共用构建函数，保证一致）
const buildFilterString = (f: {
  grayscale: number
  blur: number
  brightness: number
  contrast: number
  saturation: number
}) =>
  `grayscale(${f.grayscale}%) blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%)`

const previewFilterStyle = computed(() => ({
  filter: buildFilterString(filterSettings.value),
}))

// 计算 dataURL 实际字节数（去除 MIME 前缀后按 Base64 解码估算）
const calcDataUrlBytes = (data: string) => {
  if (!data) return 0
  const commaIndex = data.indexOf(",")
  const pure = commaIndex >= 0 ? data.slice(commaIndex + 1) : data
  let padding = 0
  if (pure.endsWith("==")) {
    padding = 2
  } else if (pure.endsWith("=")) {
    padding = 1
  }
  return Math.max(0, Math.floor((pure.length * 3) / 4) - padding)
}

const base64OutputBytes = computed(() => calcDataUrlBytes(base64Output.value))
const urlBase64OutputBytes = computed(() => calcDataUrlBytes(urlBase64Output.value))

// 释放图片预览的 ObjectURL，防止内存泄漏
const releasePreviewUrl = () => {
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value)
    imagePreviewUrl.value = ""
  }
}

// 切换模式
const switchMode = (mode: Mode) => {
  currentMode.value = mode
  if (decodeTimer) {
    clearTimeout(decodeTimer)
    decodeTimer = null
  }
  clearAll()
}

// 处理文件
const handleFile = (file: File) => {
  if (!file.type.startsWith("image/")) {
    showMessage(props.i18n.base64Image_pleaseSelectImage, 3000, "error")
    return
  }
  selectedFile.value = file
  originalSize.value = file.size
  releasePreviewUrl()
  imagePreviewUrl.value = URL.createObjectURL(file)
  processImage()
}

// 处理图片（带请求序列号，丢弃过期异步结果，避免竞态）
let processRequestId = 0

const processImage = () => {
  if (!selectedFile.value || !imagePreviewUrl.value) return

  const requestId = ++processRequestId
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    showMessage(props.i18n.base64Image_decodeFailed, 3000, "error")
    return
  }
  const img = new Image()

  img.onload = () => {
    if (requestId !== processRequestId) return

    let {
      width,
      height,
    } = img

    if (maintainAspectRatio.value && width > maxWidth.value) {
      height = (height * maxWidth.value) / width
      width = maxWidth.value
    }

    canvas.width = width
    canvas.height = height

    ctx.filter = buildFilterString(filterSettings.value)
    ctx.drawImage(img, 0, 0, width, height)
    ctx.filter = "none"

    // 添加水印
    if (watermarkSettings.value.enabled && watermarkSettings.value.text) {
      const {
        text,
        position,
        opacity,
        fontSize,
      } = watermarkSettings.value
      ctx.globalAlpha = opacity / 100
      ctx.font = `${fontSize}px Arial`
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)"
      ctx.lineWidth = 1

      const textWidth = ctx.measureText(text).width
      const padding = 10
      let x = padding
      let y = padding + fontSize

      switch (position) {
        case "top-right":
          x = width - textWidth - padding
          break
        case "bottom-left":
          y = height - padding
          break
        case "bottom-right":
          x = width - textWidth - padding
          y = height - padding
          break
        case "center":
          x = (width - textWidth) / 2
          y = height / 2
          break
      }

      ctx.strokeText(text, x, y)
      ctx.fillText(text, x, y)
      ctx.globalAlpha = 1
    }

    const quality = compressionQuality.value / 100
    base64Output.value = canvas.toDataURL(outputFormat.value, quality)
  }

  img.onerror = () => {
    if (requestId !== processRequestId) return
    showMessage(props.i18n.base64Image_decodeFailed, 3000, "error")
  }

  img.src = imagePreviewUrl.value
}

// 重置滤镜
const resetFilters = () => {
  filterSettings.value = {
    grayscale: 0,
    blur: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  }
  processImage()
}

// URL转Base64
const fetchUrlToBase64 = async () => {
  if (!imageUrlInput.value) return
  isFetchingUrl.value = true

  try {
    const response = await fetch(imageUrlInput.value)
    if (!response.ok) {
      showMessage(props.i18n.base64Image_fetchFailed, 3000, "error")
      return
    }
    const blob = await response.blob()

    if (!blob.type.startsWith("image/")) {
      showMessage(props.i18n.base64Image_pleaseSelectImage, 3000, "error")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      urlBase64Output.value = reader.result as string
      showMessage(props.i18n.base64Image_decodeSuccess, 2000, "info")
    }
    reader.onerror = () => {
      showMessage(props.i18n.base64Image_fetchFailed, 3000, "error")
    }
    reader.readAsDataURL(blob)
  } catch {
    showMessage(props.i18n.base64Image_fetchCorsFailed, 3000, "error")
  } finally {
    isFetchingUrl.value = false
  }
}

// 生成二维码
const generateQrcode = async () => {
  if (!qrcodeInput.value) return

  try {
    const options: QRCode.QRCodeToDataURLOptions = {
      width: qrcodeSize.value,
      margin: 2,
      color: {
        dark: qrcodeDarkMode.value ? "#ffffff" : "#000000",
        light: qrcodeDarkMode.value ? "#000000" : "#ffffff",
      },
    }
    qrcodeOutput.value = await QRCode.toDataURL(qrcodeInput.value, options)
  } catch {
    showMessage(props.i18n.base64Image_qrcodeFailed, 3000, "error")
  }
}

// 解码Base64（异步加载完成后再结束 loading，失败时清除预览）
let decodeRequestId = 0

const decodeBase64 = () => {
  if (!base64Input.value.trim()) {
    showMessage(props.i18n.base64Image_pleaseInputBase64, 3000, "error")
    return
  }

  const requestId = ++decodeRequestId
  isDecoding.value = true

  let base64 = base64Input.value.trim()
  if (!base64.startsWith("data:image/")) {
    base64 = `data:image/png;base64,${base64}`
  }

  decodedImageUrl.value = base64

  const img = new Image()
  img.onload = () => {
    if (requestId !== decodeRequestId) return
    decodedImageSize.value = `${img.width} × ${img.height}px`
    isDecoding.value = false
    showMessage(props.i18n.base64Image_decodeSuccess, 2000, "info")
  }
  img.onerror = () => {
    if (requestId !== decodeRequestId) return
    decodedImageUrl.value = ""
    isDecoding.value = false
    showMessage(props.i18n.base64Image_decodeFailed, 3000, "error")
  }
  img.src = base64
}

// 复制结果反馈
const showCopyResult = async (content: string) => {
  const ok = await copyToClipboard(content)
  showMessage(
    ok ? props.i18n.base64Image_copySuccess : props.i18n.base64Image_copyFailed,
    2000,
    ok ? "info" : "error",
  )
}

/**
 * 按类型格式化并复制输出内容。
 * @param type      输出格式：base64 / html / markdown / css
 * @param raw       原始 dataURL
 * @param alt       图片 alt 文案
 * @param withCss   是否提供 CSS 格式选项（encode 模式含 CSS，url 模式不含）
 */
const copyFormatted = (type: string, raw: string, alt: string, withCss: boolean) => {
  const MIME_RE = /^data:image\/.*;base64,/
  let content = ""

  switch (type) {
    case "base64":
      content = raw.replace(MIME_RE, "")
      break
    case "html":
      content = `<img src="${raw}" alt="${alt}">`
      break
    case "markdown":
      content = `![${alt}](${raw})`
      break
    case "css":
      if (withCss) {
        content = `background-image: url('${raw}');`
      } else {
        // 该模式不支持 CSS 格式，提示而非复制空内容
        showMessage(props.i18n.base64Image_cssUnavailable, 3000, "error")
        return
      }
      break
  }

  showCopyResult(content)
}

const handleCopySelect = (type: string) =>
  copyFormatted(type, base64Output.value, selectedFile.value?.name || "image", true)

const handleUrlCopySelect = (type: string) =>
  copyFormatted(type, urlBase64Output.value, "image", false)

const copyDecodedImageUrl = () => showCopyResult(decodedImageUrl.value)
const copyQrcodeBase64 = () =>
  showCopyResult(qrcodeOutput.value.replace(/^data:image\/.*;base64,/, ""))

// 下载函数
const downloadBase64 = () => triggerDownload(base64Output.value, `${selectedFile.value?.name || "base64"}.txt`)
const downloadDecodedImage = () => triggerDownload(decodedImageUrl.value, "decoded-image.png")
const downloadUrlBase64 = () => triggerDownload(urlBase64Output.value, "url-base64.txt")
const downloadQrcode = () => triggerDownload(qrcodeOutput.value, "qrcode.png")

// 清空所有
const clearAll = () => {
  releasePreviewUrl()
  selectedFile.value = null
  base64Output.value = ""
  originalSize.value = 0
  base64Input.value = ""
  decodedImageUrl.value = ""
  decodedImageSize.value = ""
  imageUrlInput.value = ""
  urlBase64Output.value = ""
  qrcodeInput.value = ""
  qrcodeOutput.value = ""
}

// 处理粘贴事件
const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  const imageItem = Array.from(items).find((item) =>
    item.type.startsWith("image/"),
  )
  const file = imageItem?.getAsFile()

  if (file && currentMode.value === "encode") {
    showMessage(props.i18n.base64Image_pasteSuccess, 2000, "info")
    handleFile(file)
  }
}

// 监听Base64输入变化（500ms 防抖）
let decodeTimer: ReturnType<typeof setTimeout> | null = null

watch(base64Input, (newValue) => {
  if (decodeTimer) {
    clearTimeout(decodeTimer)
    decodeTimer = null
  }
  if (newValue && currentMode.value === "decode") {
    decodeTimer = setTimeout(decodeBase64, 500)
  }
})

// 监听二维码输入变化（300ms 防抖，与 base64Input 行为一致）
let qrcodeTimer: ReturnType<typeof setTimeout> | null = null

watch(qrcodeInput, (newValue) => {
  if (qrcodeTimer) {
    clearTimeout(qrcodeTimer)
    qrcodeTimer = null
  }
  if (newValue && currentMode.value === "qrcode") {
    qrcodeTimer = setTimeout(generateQrcode, 300)
  }
})

// 生命周期
onMounted(() => document.addEventListener("paste", handlePaste))
onUnmounted(() => {
  document.removeEventListener("paste", handlePaste)
  if (decodeTimer) {
    clearTimeout(decodeTimer)
    decodeTimer = null
  }
  if (qrcodeTimer) {
    clearTimeout(qrcodeTimer)
    qrcodeTimer = null
  }
  releasePreviewUrl()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
