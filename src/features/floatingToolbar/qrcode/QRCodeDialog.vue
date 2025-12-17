<template>
  <div v-if="visible" class="qrcode-overlay" @click.self="closeDialog">
    <div class="qrcode-dialog">
      <!-- 对话框头部 -->
      <div class="dialog-header">
        <div class="dialog-title">
          <svg class="dialog-icon" viewBox="0 0 24 24">
            <path fill="currentColor" d="M3,11H11V3H3M5,5H9V9H5M13,3V11H21V3M19,9H15V5H19M3,21H11V13H3M5,15H9V19H5M18,13H16V15H13V18H15V21H18V18H21V15H18M21,21H19V19H21V21Z"/>
          </svg>
          <span>{{ i18n.qrcodeGenerate || '二维码生成' }}</span>
        </div>
        <button class="close-btn" @click="closeDialog" :title="i18n.close || '关闭'">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-body">
        <!-- 输入内容 -->
        <div class="input-section">
          <label class="input-label">{{ i18n.qrcodeContent || '内容' }}</label>
          <textarea
            v-model="inputContent"
            class="content-input"
            :placeholder="i18n.qrcodePlaceholder || '输入或选择内容生成二维码...'"
            @input="regenerateQRCode"
          ></textarea>
        </div>

        <!-- 二维码预览 -->
        <div class="qrcode-section">
          <label class="qrcode-label">{{ i18n.qrcodePreview || '二维码预览' }}</label>
          <div class="qrcode-preview" ref="qrcodeContainer"></div>
        </div>

        <!-- 设置选项 -->
        <div class="settings-section">
          <div class="setting-item">
            <label class="setting-label">{{ i18n.qrcodeSize || '大小' }}</label>
            <div class="size-control">
              <input
                v-model.number="qrcodeSize"
                type="range"
                min="100"
                max="500"
                step="10"
                class="size-slider"
                @input="regenerateQRCode"
              />
              <span class="size-value">{{ qrcodeSize }}px</span>
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">{{ i18n.qrcodeErrorCorrection || '纠错级别' }}</label>
            <select v-model="errorCorrection" class="error-select" @change="regenerateQRCode">
              <option value="L">{{ i18n.qrcodeErrorL || 'L (7%)' }}</option>
              <option value="M">{{ i18n.qrcodeErrorM || 'M (15%)' }}</option>
              <option value="Q">{{ i18n.qrcodeErrorQ || 'Q (25%)' }}</option>
              <option value="H">{{ i18n.qrcodeErrorH || 'H (30%)' }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 对话框底部 -->
      <div class="dialog-footer">
        <button class="btn-copy" @click="copyQRCode" :disabled="!inputContent">
          <svg class="btn-icon"><use xlink:href="#iconCopy"></use></svg>
          <span>{{ i18n.qrcodeCopy || '复制图片' }}</span>
        </button>
        <button class="btn-download" @click="downloadQRCode" :disabled="!inputContent">
          <svg class="btn-icon"><use xlink:href="#iconDownload"></use></svg>
          <span>{{ i18n.qrcodeDownload || '下载' }}</span>
        </button>
        <button class="btn-close" @click="closeDialog">
          {{ i18n.close || '关闭' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import QRCode from 'qrcode'
import { showMessage } from 'siyuan'

interface Props {
  visible: boolean
  content?: string
  i18n?: Record<string, any>
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

const emit = defineEmits<Emits>()

// 状态
const inputContent = ref(props.content || '')
const qrcodeSize = ref(180)
const errorCorrection = ref<'L' | 'M' | 'Q' | 'H'>('M')
const qrcodeContainer = ref<HTMLDivElement>()
const isGenerating = ref(false)
const errorMessage = ref('')
let lastGeneratedContent = ''

// 监听props变化
watch(() => props.content, (newContent) => {
  if (newContent && newContent !== lastGeneratedContent) {
    inputContent.value = newContent
    lastGeneratedContent = newContent
    nextTick(() => {
      regenerateQRCode()
    })
  }
})

// 生成二维码
async function regenerateQRCode() {
  if (!inputContent.value || !qrcodeContainer.value) return

  try {
    isGenerating.value = true
    errorMessage.value = ''

    // 清空容器
    qrcodeContainer.value.innerHTML = ''

    // 生成二维码
    const canvas = await QRCode.toCanvas(inputContent.value, {
      width: qrcodeSize.value,
      errorCorrectionLevel: errorCorrection.value,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    qrcodeContainer.value.appendChild(canvas)
    isGenerating.value = false
  } catch (error) {
    console.error('生成二维码失败:', error)
    errorMessage.value = props.i18n.qrcodeGenerateFailed || '生成二维码失败'
    showMessage(errorMessage.value, 3000, 'error')
    isGenerating.value = false
  }
}

// 复制二维码到剪贴板
async function copyQRCode() {
  if (!qrcodeContainer.value) return

  try {
    const canvas = qrcodeContainer.value.querySelector('canvas')
    if (!canvas) {
      showMessage(props.i18n.qrcodeNotGenerated || '请先生成二维码', 3000, 'info')
      return
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        showMessage(props.i18n.qrcodeCopyFailed || '复制失败', 3000, 'error')
        return
      }

      try {
        const item = new ClipboardItem({ 'image/png': blob })
        navigator.clipboard.write([item]).then(() => {
          showMessage(props.i18n.qrcodeCopied || '二维码已复制到剪贴板', 3000, 'info')
        }).catch((err) => {
          console.error('剪贴板写入失败:', err)
          showMessage(props.i18n.qrcodeCopyFailed || '复制失败', 3000, 'error')
        })
      } catch (err) {
        console.error('复制错误:', err)
        showMessage(props.i18n.qrcodeCopyFailed || '复制失败', 3000, 'error')
      }
    })
  } catch (error) {
    console.error('复制二维码失败:', error)
    showMessage(props.i18n.qrcodeCopyFailed || '复制失败', 3000, 'error')
  }
}

// 下载二维码
function downloadQRCode() {
  if (!qrcodeContainer.value) return

  try {
    const canvas = qrcodeContainer.value.querySelector('canvas')
    if (!canvas) {
      showMessage(props.i18n.qrcodeNotGenerated || '请先生成二维码', 3000, 'info')
      return
    }

    try {
      const link = document.createElement('a')
      const dataUrl = canvas.toDataURL('image/png')

      if (!dataUrl) {
        showMessage(props.i18n.qrcodeDownloadFailed || '下载失败', 3000, 'error')
        return
      }

      link.href = dataUrl
      link.download = `qrcode-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showMessage(props.i18n.qrcodeDownloaded || '二维码已下载', 3000, 'info')
    } catch (downloadErr) {
      console.error('下载需要未捕获的错误:', downloadErr)
      showMessage(props.i18n.qrcodeDownloadFailed || '下载失败', 3000, 'error')
    }
  } catch (error) {
    console.error('下载二维码失败:', error)
    showMessage(props.i18n.qrcodeDownloadFailed || '下载失败', 3000, 'error')
  }
}

// 关闭对话框
function closeDialog() {
  emit('update:visible', false)
  emit('close')
}
</script>

<style lang="scss">
@use "./index.scss";
</style>
