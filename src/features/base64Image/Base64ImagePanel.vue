<template>
  <div class="base64-image-panel">
    <!-- 顶部操作栏 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper name="image" :size="20" />
        {{ props.i18n.base64Image || 'Base64图片转换' }}
      </h3>
      <div class="header-actions">
        <button class="action-btn" @click="clearAll" :title="props.i18n.base64Image_clearAll || '清空全部'">
          <IconWrapper name="trash" :size="16" />
        </button>
      </div>
    </div>

    <!-- 转换模式切换 -->
    <div class="mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: currentMode === 'encode' }"
        @click="switchMode('encode')"
      >
        📤 {{ props.i18n.base64Image_encode || '图片转Base64' }}
      </button>
      <button
        class="mode-tab"
        :class="{ active: currentMode === 'decode' }"
        @click="switchMode('decode')"
      >
        📥 {{ props.i18n.base64Image_decode || 'Base64转图片' }}
      </button>
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
            <button class="upload-btn" @click="triggerFileSelect">
              {{ props.i18n.base64Image_selectFile || '选择文件' }}
            </button>
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
          <h4>{{ props.i18n.base64Image_base64Output || 'Base64输出' }}</h4>
          <div class="output-controls">
            <button class="copy-btn" @click="copyToClipboard">
              <IconWrapper name="copy" :size="14" />
              {{ props.i18n.base64Image_copy || '复制' }}
            </button>
            <button class="download-btn" @click="downloadBase64">
              <IconWrapper name="download" :size="14" />
              {{ props.i18n.base64Image_download || '下载' }}
            </button>
          </div>
          <textarea
            v-model="base64Output"
            class="output-textarea"
            :placeholder="props.i18n.base64Image_base64Placeholder || 'Base64编码将显示在这里...'"
            readonly
          ></textarea>
          <div class="output-info">
            <p><strong>{{ props.i18n.base64Image_outputSize || '输出大小' }}:</strong> {{ formatFileSize(base64Output.length) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Base64转图片模式 -->
    <div v-if="currentMode === 'decode'" class="mode-content">
      <div class="input-section">
        <h4>{{ props.i18n.base64Image_base64Input || 'Base64输入' }}</h4>
        <textarea
          v-model="base64Input"
          class="input-textarea"
          :placeholder="props.i18n.base64Image_base64InputPlaceholder || '在此粘贴Base64编码（支持 data:image/ 格式）...'"
        ></textarea>
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
            <button class="download-btn" @click="downloadDecodedImage">
              <IconWrapper name="download" :size="14" />
              {{ props.i18n.base64Image_downloadImage || '下载图片' }}
            </button>
            <button class="copy-btn" @click="copyDecodedImageUrl">
              <IconWrapper name="copy" :size="14" />
              {{ props.i18n.base64Image_copyUrl || '复制URL' }}
            </button>
          </div>
          <div class="output-info">
            <p><strong>{{ props.i18n.base64Image_imageSize || '图片大小' }}:</strong> {{ decodedImageSize }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 转换按钮 -->
    <div v-if="currentMode === 'decode' && base64Input" class="action-section">
      <button class="convert-btn" @click="decodeBase64" :disabled="isDecoding">
        <div v-if="isDecoding" class="loading-spinner"></div>
        <span v-else>🔄 {{ props.i18n.base64Image_decode || '解码' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
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

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false

  const file = e.dataTransfer?.files[0]
  if (file) {
    handleFile(file)
  }
}

// 处理文件
const handleFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    showMessage(props.i18n.base64Image_pleaseSelectImage || '请选择图片文件', 3000, 'error')
    return
  }

  selectedFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)

  // 转换为Base64
  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    base64Output.value = result
  }
  reader.readAsDataURL(file)
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

// 复制到剪贴板
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(base64Output.value)
    showMessage(props.i18n.base64Image_copySuccess || '复制成功', 2000, 'info')
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
</script>

<style scoped lang="scss">
.base64-image-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel-bg, #fff);
  color: var(--panel-text, #333);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e5e5e5);
  background: var(--header-bg, #f8f9fa);

  .panel-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-color, #333);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    color: var(--text-secondary, #666);
    transition: all 0.2s;

    &:hover {
      background: var(--hover-bg, #f0f0f0);
      color: var(--text-color, #333);
    }
  }
}

.mode-tabs {
  display: flex;
  padding: 8px;
  gap: 8px;
  border-bottom: 1px solid var(--border-color, #e5e5e5);

  .mode-tab {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #e5e5e5);
    background: var(--tab-bg, #f8f9fa);
    color: var(--text-secondary, #666);
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;

    &:hover {
      background: var(--hover-bg, #f0f0f0);
    }

    &.active {
      background: var(--primary-bg, #e3f2fd);
      color: var(--primary-color, #1976d2);
      border-color: var(--primary-color, #1976d2);
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
    border: 2px dashed var(--border-color, #ddd);
    border-radius: 8px;
    padding: 32px;
    text-align: center;
    transition: all 0.3s;
    background: var(--upload-bg, #fafafa);

    &.drag-over {
      border-color: var(--primary-color, #1976d2);
      background: var(--primary-light-bg, #e3f2fd);
    }

    .upload-content {
      .upload-icon {
        color: var(--text-secondary, #999);
        margin-bottom: 12px;
      }

      .upload-text {
        margin: 0 0 12px 0;
        color: var(--text-secondary, #666);
        font-size: 14px;
      }

      .upload-btn {
        padding: 8px 16px;
        background: var(--primary-color, #1976d2);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;

        &:hover {
          background: var(--primary-dark-color, #1565c0);
        }
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
    color: var(--text-color, #333);
  }

  .image-preview {
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 6px;
    padding: 8px;
    background: var(--bg-color, #fff);
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
      color: var(--text-secondary, #666);

      strong {
        color: var(--text-color, #333);
      }
    }
  }

  .output-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;

    .copy-btn,
    .download-btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color, #e5e5e5);
      background: var(--btn-bg, #fff);
      color: var(--text-color, #333);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;

      &:hover {
        background: var(--hover-bg, #f0f0f0);
      }
    }

    .download-btn {
      background: var(--primary-color, #1976d2);
      color: white;
      border-color: var(--primary-color, #1976d2);

      &:hover {
        background: var(--primary-dark-color, #1565c0);
      }
    }
  }

  .output-textarea,
  .input-textarea {
    width: 100%;
    min-height: 200px;
    padding: 8px;
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    resize: vertical;
    background: var(--textarea-bg, #fafafa);
    color: var(--text-color, #333);

    &:focus {
      outline: none;
      border-color: var(--primary-color, #1976d2);
    }
  }
}

.input-section {
  margin-bottom: 16px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color, #333);
  }

  .input-textarea {
    width: 100%;
    min-height: 200px;
    padding: 8px;
    border: 1px solid var(--border-color, #e5e5e5);
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    resize: vertical;
    background: var(--textarea-bg, #fafafa);
    color: var(--text-color, #333);

    &:focus {
      outline: none;
      border-color: var(--primary-color, #1976d2);
    }
  }
}

.action-section {
  margin-top: 16px;

  .convert-btn {
    width: 100%;
    padding: 12px;
    background: var(--primary-color, #1976d2);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &:hover:not(:disabled) {
      background: var(--primary-dark-color, #1565c0);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
