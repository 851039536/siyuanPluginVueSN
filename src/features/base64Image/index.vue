<template>
  <div class="base64-image-panel">
    <!-- 顶部操作栏 -->
    <PanelHeader
      :title="props.i18n.base64Image || 'Base64图片转换'"
      :clear-title="props.i18n.base64Image_clearAll || '清空全部'"
      @clear="clearAll"
    />

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
    <div v-if="currentMode === 'encode'" class="mode-content">
      <UploadArea
        :drag-text="props.i18n.base64Image_dragImageHere || '拖拽图片到此处，或'"
        :select-text="props.i18n.base64Image_selectFile || '选择文件'"
        @file-select="handleFile"
      />

      <!-- 图片预览和Base64输出 -->
      <div v-if="selectedFile" class="result-section">
        <div class="preview-section">
          <h4>{{ props.i18n.imagePreview || '图片预览' }}</h4>
          <div class="image-preview" :style="previewFilterStyle">
            <img :src="imagePreviewUrl" alt="Preview" />
          </div>
          <div class="file-info">
            <p><strong>{{ props.i18n.base64Image_fileName || '文件名' }}:</strong> {{ selectedFile.name }}</p>
            <p><strong>{{ props.i18n.base64Image_fileSize || '文件大小' }}:</strong> {{ formatFileSize(selectedFile.size) }}</p>
            <p><strong>{{ props.i18n.base64Image_fileType || '文件类型' }}:</strong> {{ selectedFile.type }}</p>
          </div>
        </div>

        <div class="output-section">
          <!-- 压缩设置 -->
          <div class="compression-settings">
            <h4>{{ props.i18n.base64Image_compressionSettings || '压缩设置' }}</h4>
            <div class="setting-group">
              <Select
                :label="props.i18n.base64Image_outputFormat || '输出格式'"
                :options="formatOptions"
                v-model="outputFormat"
                size="small"
                @change="processImage"
              />
            </div>
            <div class="setting-group">
              <label>{{ props.i18n.base64Image_quality || '图片质量' }}: {{ compressionQuality }}%</label>
              <input type="range" v-model="compressionQuality" min="10" max="100" step="5" class="quality-slider" @change="processImage" />
            </div>
            <div class="setting-group">
              <label>{{ props.i18n.base64Image_maxWidth || '最大宽度' }}: {{ maxWidth }}px</label>
              <input type="range" v-model="maxWidth" min="100" max="2000" step="50" class="width-slider" @change="processImage" />
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="maintainAspectRatio" @change="processImage" />
                {{ props.i18n.base64Image_maintainAspectRatio || '保持纵横比' }}
              </label>
            </div>
          </div>

          <!-- 滤镜设置 -->
          <FilterSettings
            v-model="filterSettings"
            :title="props.i18n.base64Image_filterSettings || '滤镜效果'"
            :grayscale-label="props.i18n.base64Image_grayscale || '灰度'"
            :blur-label="props.i18n.base64Image_blur || '模糊'"
            :brightness-label="props.i18n.base64Image_brightness || '亮度'"
            :contrast-label="props.i18n.base64Image_contrast || '对比度'"
            :saturation-label="props.i18n.base64Image_saturation || '饱和度'"
            :reset-text="props.i18n.base64Image_resetFilters || '重置滤镜'"
            @reset="resetFilters"
            @update:model-value="processImage"
          />

          <!-- 水印设置 -->
          <WatermarkSettings
            v-model="watermarkSettings"
            :title="props.i18n.base64Image_watermarkSettings || '水印设置'"
            :enable-text="props.i18n.base64Image_enableWatermark || '启用水印'"
            :text-placeholder="props.i18n.base64Image_watermarkText || '水印文字'"
            :position-label="props.i18n.base64Image_watermarkPosition || '水印位置'"
            :position-options="watermarkPositionOptions"
            :opacity-label="props.i18n.base64Image_watermarkOpacity || '透明度'"
            :font-size-label="props.i18n.base64Image_watermarkSize || '字体大小'"
            @update:model-value="processImage"
          />

          <h4>{{ props.i18n.base64Image_base64Output || 'Base64输出' }}</h4>
          <div class="output-controls">
            <CopyDropdown
              :button-text="props.i18n.base64Image_copy || '复制'"
              :options="copyOptions"
              @select="handleCopySelect"
            />
            <Button variant="primary" size="small" @click="downloadBase64">
              {{ props.i18n.base64Image_download || '下载' }}
            </Button>
          </div>
          <Textarea
            v-model="base64Output"
            class="output-textarea"
            :placeholder="props.i18n.base64Image_base64Placeholder || 'Base64编码将显示在这里...'"
            :readonly="true"
            :rows="6"
          />

          <!-- 对比统计 -->
          <StatsSection
            :title="props.i18n.base64Image_statistics || '对比统计'"
            :original-label="props.i18n.base64Image_originalSize || '原始大小'"
            :output-label="props.i18n.base64Image_outputSize || '输出大小'"
            :ratio-label="props.i18n.base64Image_compressionRatio || '压缩率'"
            :original-size="originalSize"
            :output-size="base64Output.length"
          />
        </div>
      </div>
    </div>

    <!-- Base64转图片模式 -->
    <div v-if="currentMode === 'decode'" class="mode-content">
      <div class="input-section">
        <h4>{{ props.i18n.base64Image_base64Input || 'Base64输入' }}</h4>
        <Textarea
          v-model="base64Input"
          class="input-textarea"
          :placeholder="props.i18n.base64Image_base64InputPlaceholder || '在此粘贴Base64编码...'"
          :rows="8"
        />
      </div>

      <div v-if="decodedImageUrl" class="result-section">
        <div class="preview-section">
          <h4>{{ props.i18n.base64Image_imagePreview || '图片预览' }}</h4>
          <div class="image-preview">
            <img :src="decodedImageUrl" alt="Decoded Image" />
          </div>
        </div>

        <div class="output-section">
          <div class="output-controls">
            <Button variant="primary" size="small" @click="downloadDecodedImage">
              {{ props.i18n.base64Image_downloadImage || '下载图片' }}
            </Button>
            <Button variant="ghost" size="small" icon="contentCopy" :icon-size="14" @click="copyDecodedImageUrl">
              {{ props.i18n.base64Image_copyUrl || '复制URL' }}
            </Button>
          </div>
          <div class="output-info">
            <p><strong>{{ props.i18n.base64Image_imageSize || '图片大小' }}:</strong> {{ decodedImageSize }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- URL转Base64模式 -->
    <div v-if="currentMode === 'url'" class="mode-content">
      <div class="input-section">
        <h4>{{ props.i18n.base64Image_urlInput || 'URL输入' }}</h4>
        <input
          type="text"
          v-model="imageUrlInput"
          class="text-input url-input"
          :placeholder="props.i18n.base64Image_urlPlaceholder || '请输入图片URL地址...'"
        />
        <Button variant="primary" @click="fetchUrlToBase64" :loading="isFetchingUrl" :disabled="!imageUrlInput || isFetchingUrl" class="fetch-btn">
          {{ props.i18n.base64Image_fetch || '获取并转换' }}
        </Button>
      </div>

      <div v-if="urlBase64Output" class="result-section">
        <div class="preview-section">
          <h4>{{ props.i18n.base64Image_imagePreview || '图片预览' }}</h4>
          <div class="image-preview">
            <img :src="urlBase64Output" alt="URL Preview" />
          </div>
        </div>

        <div class="output-section">
          <div class="output-controls">
            <CopyDropdown
              :button-text="props.i18n.base64Image_copy || '复制'"
              :options="urlCopyOptions"
              @select="handleUrlCopySelect"
            />
            <Button variant="primary" size="small" @click="downloadUrlBase64">
              {{ props.i18n.base64Image_download || '下载' }}
            </Button>
          </div>
          <Textarea v-model="urlBase64Output" class="output-textarea" :readonly="true" :rows="6" />
          <div class="output-info">
            <p><strong>{{ props.i18n.base64Image_outputSize || '输出大小' }}:</strong> {{ formatFileSize(urlBase64Output.length) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 二维码生成模式 -->
    <div v-if="currentMode === 'qrcode'" class="mode-content">
      <QrcodeGenerator
        v-model:content="qrcodeInput"
        v-model:size="qrcodeSize"
        v-model:dark-mode="qrcodeDarkMode"
        :output="qrcodeOutput"
        :input-title="props.i18n.base64Image_qrcodeInput || '二维码内容'"
        :placeholder="props.i18n.base64Image_qrcodePlaceholder || '输入文本或URL生成二维码...'"
        :size-label="props.i18n.base64Image_qrcodeSize || '二维码大小'"
        :dark-mode-label="props.i18n.base64Image_qrcodeDark || '深色模式'"
        :generate-text="props.i18n.base64Image_generateQrcode || '生成二维码'"
        :preview-title="props.i18n.base64Image_qrcodePreview || '二维码预览'"
        :download-text="props.i18n.base64Image_download || '下载'"
        :copy-text="props.i18n.base64Image_copyBase64 || '复制Base64'"
        :content-label="props.i18n.base64Image_content || '内容'"
        @generate="generateQrcode"
        @download="downloadQrcode"
        @copy="copyQrcodeBase64"
      />
    </div>

    <!-- 转换按钮（解码模式） -->
    <div v-if="currentMode === 'decode' && base64Input" class="action-section">
      <Button class="convert-btn" variant="primary" @click="decodeBase64" :loading="isDecoding" :disabled="isDecoding">
        🔄 {{ props.i18n.base64Image_decode || '解码' }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import QRCode from 'qrcode'
import PanelHeader from './components/PanelHeader.vue'
import UploadArea from './components/UploadArea.vue'
import FilterSettings from './components/FilterSettings.vue'
import WatermarkSettings from './components/WatermarkSettings.vue'
import StatsSection from './components/StatsSection.vue'
import CopyDropdown from './components/CopyDropdown.vue'
import QrcodeGenerator from './components/QrcodeGenerator.vue'
import Button from '@/components/Button.vue'
import Select from '@/components/Select.vue'
import Textarea from '@/components/Textarea.vue'
import type { SelectOption } from '@/components/Select.vue'
import { showMessage } from 'siyuan'

interface Props {
  i18n: any
  plugin: any
}

const props = defineProps<Props>()

// 模式选项
type Mode = 'encode' | 'decode' | 'url' | 'qrcode'
const modes = computed(() => [
  { value: 'encode' as Mode, label: props.i18n.base64Image_encode || '图片转Base64' },
  { value: 'decode' as Mode, label: props.i18n.base64Image_decode || 'Base64转图片' },
  { value: 'url' as Mode, label: 'URL' },
  { value: 'qrcode' as Mode, label: props.i18n.base64Image_qrcode || '二维码' }
])

const currentMode = ref<Mode>('encode')

// 编码模式相关
const selectedFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const base64Output = ref('')
const originalSize = ref(0)

// 解码模式相关
const base64Input = ref('')
const decodedImageUrl = ref('')
const decodedImageSize = ref('')

// URL模式相关
const imageUrlInput = ref('')
const urlBase64Output = ref('')
const isFetchingUrl = ref(false)

// 二维码模式相关
const qrcodeInput = ref('')
const qrcodeOutput = ref('')
const qrcodeSize = ref(200)
const qrcodeDarkMode = ref(false)

// 压缩设置
const outputFormat = ref('image/png')
const compressionQuality = ref(80)
const maxWidth = ref(1920)
const maintainAspectRatio = ref(true)

// 滤镜设置
const filterSettings = ref({
  grayscale: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100
})

// 水印设置
const watermarkSettings = ref({
  enabled: false,
  text: 'Watermark',
  position: 'bottom-right',
  opacity: 50,
  fontSize: 24
})

// 格式选项
const formatOptions: SelectOption[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/gif', label: 'GIF' }
]

// 水印位置选项
const watermarkPositionOptions: SelectOption[] = [
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'center', label: '居中' }
]

// 复制选项
const copyOptions = [
  { value: 'base64', label: props.i18n.base64Image_copyBase64 || '纯Base64' },
  { value: 'html', label: props.i18n.base64Image_copyHtml || 'HTML <img> 标签' },
  { value: 'markdown', label: props.i18n.base64Image_copyMarkdown || 'Markdown 图片语法' },
  { value: 'css', label: props.i18n.base64Image_copyCss || 'CSS 背景图片语法' }
]

const urlCopyOptions = [
  { value: 'base64', label: props.i18n.base64Image_copyBase64 || '纯Base64' },
  { value: 'html', label: props.i18n.base64Image_copyHtml || 'HTML <img> 标签' },
  { value: 'markdown', label: props.i18n.base64Image_copyMarkdown || 'Markdown' }
]

// UI状态
const isDecoding = ref(false)

// 预览滤镜样式
const previewFilterStyle = computed(() => {
  const { grayscale, blur, brightness, contrast, saturation } = filterSettings.value
  return {
    filter: `grayscale(${grayscale}%) blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
  }
})

// 切换模式
const switchMode = (mode: Mode) => {
  currentMode.value = mode
  clearAll()
}

// 处理文件
const handleFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    showMessage(props.i18n.base64Image_pleaseSelectImage || '请选择图片文件', 3000, 'error')
    return
  }
  selectedFile.value = file
  originalSize.value = file.size
  imagePreviewUrl.value = URL.createObjectURL(file)
  processImage()
}

// 处理图片
const processImage = () => {
  if (!selectedFile.value) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = new Image()
  const objectUrl = URL.createObjectURL(selectedFile.value)

  img.onload = () => {
    let { width, height } = img

    if (maintainAspectRatio.value && width > maxWidth.value) {
      height = (height * maxWidth.value) / width
      width = maxWidth.value
    }

    canvas.width = width
    canvas.height = height

    const { grayscale, blur, brightness, contrast, saturation } = filterSettings.value
    ctx!.filter = `grayscale(${grayscale}%) blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
    ctx?.drawImage(img, 0, 0, width, height)
    ctx!.filter = 'none'

    // 添加水印
    if (watermarkSettings.value.enabled && watermarkSettings.value.text) {
      const { text, position, opacity, fontSize } = watermarkSettings.value
      ctx!.globalAlpha = opacity / 100
      ctx!.font = `${fontSize}px Arial`
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx!.strokeStyle = 'rgba(0, 0, 0, 0.5)'
      ctx!.lineWidth = 1

      const textWidth = ctx!.measureText(text).width
      const padding = 10
      let x = padding
      let y = padding + fontSize

      switch (position) {
        case 'top-right': x = width - textWidth - padding; break
        case 'bottom-left': y = height - padding; break
        case 'bottom-right': x = width - textWidth - padding; y = height - padding; break
        case 'center': x = (width - textWidth) / 2; y = height / 2; break
      }

      ctx!.strokeText(text, x, y)
      ctx!.fillText(text, x, y)
      ctx!.globalAlpha = 1
    }

    const quality = compressionQuality.value / 100
    base64Output.value = canvas.toDataURL(outputFormat.value, quality)
    URL.revokeObjectURL(objectUrl)
  }

  img.src = objectUrl
}

// 重置滤镜
const resetFilters = () => {
  filterSettings.value = { grayscale: 0, blur: 0, brightness: 100, contrast: 100, saturation: 100 }
  processImage()
}

// URL转Base64
const fetchUrlToBase64 = async () => {
  if (!imageUrlInput.value) return
  isFetchingUrl.value = true

  try {
    const response = await fetch(imageUrlInput.value)
    const blob = await response.blob()

    if (!blob.type.startsWith('image/')) {
      showMessage(props.i18n.base64Image_pleaseSelectImage || '请选择图片文件', 3000, 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      urlBase64Output.value = reader.result as string
      showMessage(props.i18n.base64Image_decodeSuccess || '转换成功', 2000, 'info')
    }
    reader.readAsDataURL(blob)
  } catch {
    showMessage(props.i18n.base64Image_fetchFailed || '获取图片失败', 3000, 'error')
  } finally {
    isFetchingUrl.value = false
  }
}

// 生成二维码
const generateQrcode = async () => {
  if (!qrcodeInput.value) return

  try {
    const options: QRCode.QRCodeToStringOptions = {
      width: qrcodeSize.value,
      margin: 2,
      color: {
        dark: qrcodeDarkMode.value ? '#ffffff' : '#000000',
        light: qrcodeDarkMode.value ? '#000000' : '#ffffff'
      }
    }
    qrcodeOutput.value = await QRCode.toDataURL(qrcodeInput.value, options)
  } catch {
    showMessage(props.i18n.base64Image_qrcodeFailed || '生成二维码失败', 3000, 'error')
  }
}

// 解码Base64
const decodeBase64 = () => {
  if (!base64Input.value.trim()) {
    showMessage(props.i18n.base64Image_pleaseInputBase64 || '请输入Base64编码', 3000, 'error')
    return
  }

  isDecoding.value = true

  try {
    let base64 = base64Input.value.trim()
    if (!base64.startsWith('data:image/')) {
      base64 = `data:image/png;base64,${base64}`
    }

    decodedImageUrl.value = base64

    const img = new Image()
    img.onload = () => {
      decodedImageSize.value = `${img.width} × ${img.height}px`
    }
    img.src = base64

    showMessage(props.i18n.base64Image_decodeSuccess || '解码成功', 2000, 'info')
  } catch {
    showMessage(props.i18n.base64Image_decodeFailed || '解码失败', 3000, 'error')
  } finally {
    isDecoding.value = false
  }
}

// 处理复制选择
const handleCopySelect = (type: string) => {
  const altText = selectedFile.value?.name || 'image'
  let content = ''

  switch (type) {
    case 'base64': content = base64Output.value.replace(/^data:image\/.*;base64,/, ''); break
    case 'html': content = `<img src="${base64Output.value}" alt="${altText}">`; break
    case 'markdown': content = `![${altText}](${base64Output.value})`; break
    case 'css': content = `background-image: url('${base64Output.value}');`; break
  }

  copyToClipboard(content)
}

const handleUrlCopySelect = (type: string) => {
  let content = ''

  switch (type) {
    case 'base64': content = urlBase64Output.value.replace(/^data:image\/.*;base64,/, ''); break
    case 'html': content = `<img src="${urlBase64Output.value}" alt="image">`; break
    case 'markdown': content = `![image](${urlBase64Output.value})`; break
  }

  copyToClipboard(content)
}

// 复制函数
const copyToClipboard = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
  } catch {
    showMessage(props.i18n.base64Image_copyFailed || '复制失败', 3000, 'error')
  }
}

const copyDecodedImageUrl = () => copyToClipboard(decodedImageUrl.value)
const copyQrcodeBase64 = () => copyToClipboard(qrcodeOutput.value.replace(/^data:image\/.*;base64,/, ''))

// 下载函数
const downloadFile = (url: string, filename: string) => {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const downloadBase64 = () => {
  const blob = new Blob([base64Output.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, `${selectedFile.value?.name || 'base64'}.txt`)
  URL.revokeObjectURL(url)
}

const downloadDecodedImage = () => downloadFile(decodedImageUrl.value, 'decoded-image.png')
const downloadUrlBase64 = () => {
  const blob = new Blob([urlBase64Output.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, 'url-base64.txt')
  URL.revokeObjectURL(url)
}
const downloadQrcode = () => downloadFile(qrcodeOutput.value, 'qrcode.png')

// 清空所有
const clearAll = () => {
  selectedFile.value = null
  imagePreviewUrl.value = ''
  base64Output.value = ''
  originalSize.value = 0
  base64Input.value = ''
  decodedImageUrl.value = ''
  decodedImageSize.value = ''
  imageUrlInput.value = ''
  urlBase64Output.value = ''
  qrcodeInput.value = ''
  qrcodeOutput.value = ''
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 处理粘贴事件
const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  const imageItem = Array.from(items).find(item => item.type.startsWith('image/'))
  const file = imageItem?.getAsFile()

  if (file && currentMode.value === 'encode') {
    showMessage(props.i18n.base64Image_pasteSuccess || '粘贴图片成功', 2000, 'info')
    handleFile(file)
  }
}

// 监听Base64输入变化
let decodeTimer: ReturnType<typeof setTimeout> | null = null

watch(base64Input, (newValue) => {
  if (decodeTimer) {
    clearTimeout(decodeTimer)
    decodeTimer = null
  }
  if (newValue && currentMode.value === 'decode') {
    decodeTimer = setTimeout(decodeBase64, 500)
  }
})

// 监听二维码输入变化
watch(qrcodeInput, (newValue) => {
  if (newValue && currentMode.value === 'qrcode') {
    generateQrcode()
  }
})

// 生命周期
onMounted(() => document.addEventListener('paste', handlePaste))
onUnmounted(() => document.removeEventListener('paste', handlePaste))
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
