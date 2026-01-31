<template>
  <div class="base64-image-panel">
    <!-- 顶部操作栏 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper name="image" :size="20" />
        {{ props.i18n.base64Image || 'Base64图片转换' }}
      </h3>
      <div class="header-actions">
        <Button variant="ghost" size="small" icon="delete" :icon-size="16" @click="clearAll" :title="props.i18n.base64Image_clearAll || '清空全部'" />
      </div>
    </div>

    <!-- 转换模式切换 -->
    <div class="mode-tabs">
      <Button
        class="mode-tab"
        :class="{ active: currentMode === 'encode' }"
        variant="ghost"
        @click="switchMode('encode')"
      >
        📤 {{ props.i18n.base64Image_encode || '图片转Base64' }}
      </Button>
      <Button
        class="mode-tab"
        :class="{ active: currentMode === 'decode' }"
        variant="ghost"
        @click="switchMode('decode')"
      >
        📥 {{ props.i18n.base64Image_decode || 'Base64转图片' }}
      </Button>
    </div>

    <!-- 图片转Base64模式 -->
    <div v-if="currentMode === 'encode'" class="mode-content">
      <div class="upload-section">
        <div
          class="upload-area"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          :class="{ 'drag-over': isDragOver }"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            style="display: none"
          />
          <div class="upload-content">
            <IconWrapper name="image" :size="48" class="upload-icon" />
            <p class="upload-text">{{ props.i18n.base64Image_dragImageHere || '拖拽图片到此处，或' }}</p>
            <Button class="upload-btn" variant="primary" @click="triggerFileSelect">
              {{ props.i18n.base64Image_selectFile || '选择文件' }}
            </Button>
          </div>
        </div>
      </div>

      <!-- 图片预览和Base64输出 -->
      <div v-if="selectedFile" class="result-section">
        <div class="preview-section">
          <h4>{{ props.i18n.imagePreview || '图片预览' }}</h4>
          <div class="image-preview">
            <img :src="imagePreviewUrl" alt="Preview" />
          </div>
          <div class="file-info">
            <p><strong>{{ props.i18n.base64Image_fileName || '文件名' }}:</strong> {{ selectedFile.name }}</p>
            <p><strong>{{ props.i18n.base64Image_fileSize || '文件大小' }}:</strong> {{ formatFileSize(selectedFile.size) }}</p>
            <p><strong>{{ props.i18n.base64Image_fileType || '文件类型' }}:</strong> {{ selectedFile.type }}</p>
          </div>
        </div>

        <div class="output-section">
          <!-- 压缩和格式转换设置 -->
          <div class="compression-settings">
            <h4>{{ props.i18n.base64Image_compressionSettings || '压缩设置' }}</h4>
            <div class="setting-group">
              <Select
                :label="props.i18n.base64Image_outputFormat || '输出格式'"
                :options="formatOptions"
                v-model="outputFormat"
                size="small"
                @change="handleFile(selectedFile!)"
              />
            </div>
            <div class="setting-group">
              <label>
                {{ props.i18n.base64Image_quality || '图片质量' }}: {{ compressionQuality }}%
              </label>
              <input
                type="range"
                v-model="compressionQuality"
                min="10"
                max="100"
                step="5"
                class="quality-slider"
                @change="handleFile(selectedFile!)"
              />
            </div>
            <div class="setting-group">
              <label>
                {{ props.i18n.base64Image_maxWidth || '最大宽度' }}: {{ maxWidth }}px
              </label>
              <input
                type="range"
                v-model="maxWidth"
                min="100"
                max="2000"
                step="50"
                class="width-slider"
                @change="handleFile(selectedFile!)"
              />
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="maintainAspectRatio"
                  @change="handleFile(selectedFile!)"
                />
                {{ props.i18n.base64Image_maintainAspectRatio || '保持纵横比' }}
              </label>
            </div>
          </div>

          <h4>{{ props.i18n.base64Image_base64Output || 'Base64输出' }}</h4>
          <div class="output-controls">
            <div class="copy-dropdown">
              <Button class="dropdown-toggle" variant="ghost" size="small" icon="contentCopy" :icon-size="14" @click="toggleCopyDropdown">
                {{ props.i18n.base64Image_copy || '复制' }}
                <span class="dropdown-arrow">▼</span>
              </Button>
              <div v-if="showCopyDropdown" class="dropdown-menu">
                <button class="dropdown-item" @click="copyBase64">
                  {{ props.i18n.base64Image_copyBase64 || '纯Base64' }}
                </button>
                <button class="dropdown-item" @click="copyHtmlTag">
                  {{ props.i18n.base64Image_copyHtml || 'HTML <img> 标签' }}
                </button>
                <button class="dropdown-item" @click="copyMarkdown">
                  {{ props.i18n.base64Image_copyMarkdown || 'Markdown 图片语法' }}
                </button>
                <button class="dropdown-item" @click="copyCssBackground">
                  {{ props.i18n.base64Image_copyCss || 'CSS 背景图片语法' }}
                </button>
              </div>
            </div>
            <Button class="download-btn" variant="primary" size="small" @click="downloadBase64">
              {{ props.i18n.base64Image_download || '下载' }}
            </Button>
          </div>
          <Textarea
            v-model="base64Output"
            class="output-textarea"
            :placeholder="props.i18n.base64Image_base64Placeholder || 'Base64编码将显示在这里...'"
            :readonly="true"
            :rows="8"
          />
          <div class="output-info">
            <p><strong>{{ props.i18n.base64Image_outputSize || '输出大小' }}:</strong> {{ formatFileSize(base64Output.length) }}</p>
            <p v-if="compressionApplied"><strong>{{ props.i18n.base64Image_compressedSize || '压缩后大小' }}:</strong> {{ formatFileSize(selectedFile?.size || 0) }}</p>
          </div>
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
          :placeholder="props.i18n.base64Image_base64InputPlaceholder || '在此粘贴Base64编码（支持 data:image/ 格式）...'"
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
            <Button class="download-btn" variant="primary" size="small" @click="downloadDecodedImage">
              {{ props.i18n.base64Image_downloadImage || '下载图片' }}
            </Button>
            <Button class="copy-btn" variant="ghost" size="small" icon="contentCopy" :icon-size="14" @click="copyDecodedImageUrl">
              {{ props.i18n.base64Image_copyUrl || '复制URL' }}
            </Button>
          </div>
          <div class="output-info">
            <p><strong>{{ props.i18n.base64Image_imageSize || '图片大小' }}:</strong> {{ decodedImageSize }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 转换按钮 -->
    <div v-if="currentMode === 'decode' && base64Input" class="action-section">
      <Button class="convert-btn" variant="primary" @click="decodeBase64" :loading="isDecoding" :disabled="isDecoding">
        🔄 {{ props.i18n.base64Image_decode || '解码' }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
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

// 当前模式
const currentMode = ref<'encode' | 'decode'>('encode')

// 编码模式相关
const selectedFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const base64Output = ref('')

// 解码模式相关
const base64Input = ref('')
const decodedImageUrl = ref('')
const decodedImageSize = ref('')

// 压缩和格式转换设置
const outputFormat = ref('image/png')
const compressionQuality = ref(80)
const maxWidth = ref(1920)
const maintainAspectRatio = ref(true)
const compressionApplied = ref(false)

// 格式选项
const formatOptions: SelectOption[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/gif', label: 'GIF' }
]

// 复制选项
const showCopyDropdown = ref(false)

// UI状态
const isDragOver = ref(false)
const isDecoding = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// 切换模式
const switchMode = (mode: 'encode' | 'decode') => {
  currentMode.value = mode
  clearAll()
}

// 触发文件选择
const triggerFileSelect = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    handleFile(file)
  }
}

// 处理拖拽
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  // 只有当真正离开拖拽区域时才取消高亮
  const rect = (e.currentTarget as Element).getBoundingClientRect()
  const x = e.clientX
  const y = e.clientY
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragOver.value = false
  }
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  // 处理拖拽的文件（支持文件夹）
  const fileList: File[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith('image/')) {
      fileList.push(file)
    }
  }

  if (fileList.length === 0) {
    showMessage(props.i18n.base64Image_pleaseSelectImage || '请选择图片文件', 3000, 'error')
    return
  }

  // 如果有多张图片，使用第一张
  if (fileList.length > 1) {
    showMessage(`已选择 ${fileList.length} 个文件，使用第一张`, 2000, 'info')
  }

  handleFile(fileList[0])
}

// 处理文件
const handleFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    showMessage(props.i18n.base64Image_pleaseSelectImage || '请选择图片文件', 3000, 'error')
    return
  }

  selectedFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)

  // 压缩和格式转换
  compressAndConvert(file)
}

// 压缩和转换图片
const compressAndConvert = (file: File) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = new Image()

  img.onload = () => {
    // 计算新尺寸
    let { width, height } = img

    if (maintainAspectRatio.value && width > maxWidth.value) {
      height = (height * maxWidth.value) / width
      width = maxWidth.value
    }

    canvas.width = width
    canvas.height = height

    // 绘制压缩后的图片
    ctx?.drawImage(img, 0, 0, width, height)

    // 转换为Base64
    const quality = compressionQuality.value / 100
    const base64 = canvas.toDataURL(outputFormat.value, quality)
    base64Output.value = base64
    compressionApplied.value = outputFormat.value !== file.type || quality < 1 || width !== img.width

    URL.revokeObjectURL(img.src)
  }

  img.src = URL.createObjectURL(file)
}

// 解码Base64
const decodeBase64 = () => {
  if (!base64Input.value.trim()) {
    showMessage(props.i18n.base64Image_pleaseInputBase64 || '请输入Base64编码', 3000, 'error')
    return
  }

  isDecoding.value = true

  try {
    // 如果不是以 data:image/ 开头，添加前缀
    let base64 = base64Input.value.trim()
    if (!base64.startsWith('data:image/')) {
      base64 = `data:image/png;base64,${base64}`
    }

    decodedImageUrl.value = base64

    // 获取图片尺寸
    const img = new Image()
    img.onload = () => {
      decodedImageSize.value = `${img.width} × ${img.height}px`
      URL.revokeObjectURL(img.src)
    }
    img.src = base64

    showMessage(props.i18n.base64Image_decodeSuccess || '解码成功', 2000, 'info')
  } catch (error) {
    showMessage(props.i18n.base64Image_decodeFailed || '解码失败，请检查Base64格式', 3000, 'error')
  } finally {
    isDecoding.value = false
  }
}

// 切换复制下拉菜单
const toggleCopyDropdown = () => {
  showCopyDropdown.value = !showCopyDropdown.value
}

// 复制纯Base64
const copyBase64 = async () => {
  try {
    const base64Only = base64Output.value.replace(/^data:image\/.*;base64,/, '')
    await navigator.clipboard.writeText(base64Only)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
    showCopyDropdown.value = false
  } catch (error) {
    showMessage(props.i18n.base64Image_copyFailed || '复制失败', 3000, 'error')
  }
}

// 复制HTML img标签
const copyHtmlTag = async () => {
  try {
    const altText = selectedFile.value?.name || 'image'
    const htmlTag = `<img src="${base64Output.value}" alt="${altText}">`
    await navigator.clipboard.writeText(htmlTag)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
    showCopyDropdown.value = false
  } catch (error) {
    showMessage(props.i18n.base64Image_copyFailed || '复制失败', 3000, 'error')
  }
}

// 复制Markdown图片语法
const copyMarkdown = async () => {
  try {
    const altText = selectedFile.value?.name || 'image'
    const markdown = `![${altText}](${base64Output.value})`
    await navigator.clipboard.writeText(markdown)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
    showCopyDropdown.value = false
  } catch (error) {
    showMessage(props.i18n.base64Image_copyFailed || '复制失败', 3000, 'error')
  }
}

// 复制CSS背景图片语法
const copyCssBackground = async () => {
  try {
    const cssBackground = `background-image: url('${base64Output.value}');`
    await navigator.clipboard.writeText(cssBackground)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
    showCopyDropdown.value = false
  } catch (error) {
    showMessage(props.i18n.base64Image_copyFailed || '复制失败', 3000, 'error')
  }
}

// 下载Base64
const downloadBase64 = () => {
  const blob = new Blob([base64Output.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedFile.value?.name || 'base64'}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 下载解码后的图片
const downloadDecodedImage = () => {
  const a = document.createElement('a')
  a.href = decodedImageUrl.value
  a.download = 'decoded-image.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// 复制解码后的图片URL
const copyDecodedImageUrl = async () => {
  try {
    await navigator.clipboard.writeText(decodedImageUrl.value)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
  } catch (error) {
    showMessage(props.i18n.base64Image_copyFailed || '复制失败', 3000, 'error')
  }
}

// 清空所有
const clearAll = () => {
  selectedFile.value = null
  imagePreviewUrl.value = ''
  base64Output.value = ''
  base64Input.value = ''
  decodedImageUrl.value = ''
  decodedImageSize.value = ''
  isDragOver.value = false
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 监听Base64输入变化，自动解码
watch(base64Input, (newValue) => {
  if (newValue && currentMode.value === 'decode') {
    // 延迟解码，避免频繁操作
    const timer = setTimeout(() => {
      decodeBase64()
    }, 500)
    return () => clearTimeout(timer)
  }
})

// 处理粘贴事件
const handlePaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        showMessage(props.i18n.base64Image_pasteSuccess || '粘贴图片成功', 2000, 'info')
        handleFile(file)
        return
      }
    }
  }
}

// 组件挂载时添加粘贴监听
onMounted(() => {
  document.addEventListener('paste', handlePaste)
})

// 组件卸载时移除粘贴监听
onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
})
</script>

<style scoped lang="scss">
// 使用思源笔记主题 CSS 变量实现黑色主题兼容
.base64-image-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel-background, var(--b3-theme-background));
  color: var(--panel-text-color, var(--b3-theme-on-background));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);

  .panel-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--b3-theme-on-surface);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.mode-tabs {
  display: flex;
  padding: 8px;
  gap: 8px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);

  .mode-tab {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface-variant);
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-surface-lighter);
    }

    &.active {
      background: var(--b3-theme-primary-container);
      color: var(--b3-theme-on-primary-container);
      border-color: var(--b3-theme-primary);
    }
  }
}

.mode-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.upload-section {
  margin-bottom: 16px;

  .upload-area {
    border: 2px dashed var(--b3-theme-surface-lighter);
    border-radius: 8px;
    padding: 32px;
    text-align: center;
    transition: all 0.3s;
    background: var(--b3-theme-surface);

    &.drag-over {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-container);
    }

    .upload-content {
      .upload-icon {
        color: var(--b3-theme-on-surface-variant);
        margin-bottom: 12px;
      }

      .upload-text {
        margin: 0 0 12px 0;
        color: var(--b3-theme-on-surface-variant);
        font-size: 14px;
      }
    }
  }
}

.result-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
}

.preview-section,
.output-section {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .compression-settings {
    background: var(--b3-theme-surface-lighter);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
    }

    .setting-group {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        color: var(--b3-theme-on-surface-variant);
        font-weight: 500;
      }

      .quality-slider,
      .width-slider {
        width: 100%;
        height: 4px;
        background: var(--b3-theme-surface-lighter);
        border-radius: 2px;
        outline: none;
        cursor: pointer;

        &::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: var(--b3-theme-primary);
          border-radius: 50%;
          cursor: pointer;
        }

        &::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: var(--b3-theme-primary);
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;

        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      }
    }
  }

  .image-preview {
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 6px;
    padding: 8px;
    background: var(--b3-theme-background);
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 150px;
    margin-bottom: 12px;

    img {
      max-width: 100%;
      max-height: 300px;
      object-fit: contain;
      border-radius: 4px;
    }
  }

  .file-info,
  .output-info {
    p {
      margin: 4px 0;
      font-size: 12px;
      color: var(--b3-theme-on-surface-variant);

      strong {
        color: var(--b3-theme-on-surface);
      }
    }
  }

  .output-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;

    .copy-dropdown {
      position: relative;

      .dropdown-toggle {
        .dropdown-arrow {
          margin-left: 4px;
          font-size: 10px;
        }
      }

      .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 4px;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-theme-surface-lighter);
        border-radius: 4px;
        box-shadow: 0 2px 8px var(--b3-theme-shadow, rgba(0, 0, 0, 0.15));
        z-index: 1000;
        min-width: 180px;

        .dropdown-item {
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--b3-theme-on-surface);
          cursor: pointer;
          font-size: 12px;
          text-align: left;
          transition: background 0.2s;

          &:hover {
            background: var(--b3-theme-surface-lighter);
          }

          &:first-child {
            border-radius: 4px 4px 0 0;
          }

          &:last-child {
            border-radius: 0 0 4px 4px;
          }
        }
      }
    }
  }
}

.input-section {
  margin-bottom: 16px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }
}

.action-section {
  margin-top: 16px;

  .convert-btn {
    width: 100%;
  }
}
</style>
