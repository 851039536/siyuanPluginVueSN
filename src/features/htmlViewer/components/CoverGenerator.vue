<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="cover-generator-overlay"
        @click.self="close"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="cover-generator-dialog"
            @click.stop
          >
            <!-- 头部 -->
            <div class="dialog-header">
              <div class="header-title">
                <IconWrapper
                  name="image"
                  :size="22"
                />
                <h2>AI 文章封面</h2>
              </div>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="close"
              />
            </div>

            <!-- 内容区 -->
            <div class="dialog-body">
              <div class="cover-layout">
                <!-- 左侧：配置区 -->
                <div class="config-panel">
                  <!-- 标题输入 -->
                  <div class="config-section">
                    <label class="config-label">文章标题</label>
                    <Input
                      v-model="config.title"
                      type="text"
                      placeholder="输入文章标题..."
                    />
                  </div>

                  <!-- 内容摘要 -->
                  <div class="config-section">
                    <label class="config-label">内容摘要 <span class="config-hint">（简短一句话或完整文章均可）</span></label>
                    <textarea
                      ref="contentTextarea"
                      v-model="config.content"
                      class="content-textarea"
                      placeholder="输入文章内容摘要，可以是简短一句话，也可以粘贴完整文章..."
                      rows="3"
                      @input="autoResizeTextarea"
                    ></textarea>
                  </div>

                  <!-- 尺寸选择 -->
                  <div class="config-section">
                    <label class="config-label">封面尺寸</label>
                    <div class="size-presets">
                      <button
                        v-for="preset in COVER_SIZE_PRESETS"
                        :key="preset.label"
                        class="size-preset-btn"
                        :class="{ active: config.width === preset.width && config.height === preset.height }"
                        @click="selectSizePreset(preset)"
                      >
                        {{ preset.label }}
                      </button>
                    </div>
                    <div class="size-custom">
                      <div class="size-input-group">
                        <Input
                          v-model="widthInput"
                          type="number"
                          placeholder="宽"
                          size="small"
                          @change="updateCustomSize"
                        />
                        <span class="size-x">×</span>
                        <Input
                          v-model="heightInput"
                          type="number"
                          placeholder="高"
                          size="small"
                          @change="updateCustomSize"
                        />
                        <span class="size-unit">px</span>
                      </div>
                    </div>
                  </div>

                  <!-- 风格选择 -->
                  <div class="config-section">
                    <label class="config-label">封面风格</label>
                    <div class="style-grid">
                      <button
                        v-for="style in COVER_STYLE_PRESETS"
                        :key="style.id"
                        class="style-btn"
                        :class="{ active: config.styleId === style.id }"
                        @click="config.styleId = style.id"
                      >
                        <span class="style-name">{{ style.label }}</span>
                        <span class="style-desc">{{ style.description }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="config-actions">
                    <Button
                      v-if="generationStatus === 'generating'"
                      variant="ghost"
                      @click="cancelGeneration"
                    >
                      取消生成
                    </Button>
                    <Button
                      v-else
                      variant="primary"
                      :disabled="!config.title.trim() && !config.content.trim()"
                      @click="handleGenerate"
                    >
                      {{ generationStatus === 'done' ? '重新生成' : '生成封面' }}
                    </Button>
                  </div>

                  <!-- 错误信息 -->
                  <div
                    v-if="errorMessage"
                    class="error-message"
                  >
                    {{ errorMessage }}
                  </div>
                </div>

                <!-- 右侧：预览区 -->
                <div class="preview-panel">
                  <div class="preview-header">
                    <span>封面预览</span>
                    <div
                      v-if="generationStatus === 'done'"
                      class="preview-actions"
                    >
                      <Button
                        variant="ghost"
                        size="small"
                        icon="contentCopy"
                        title="复制为图片"
                        @click="copyCoverAsImage"
                      />
                      <Button
                        variant="ghost"
                        size="small"
                        icon="download"
                        title="下载为图片"
                        @click="downloadCoverAsImage"
                      />
                    </div>
                  </div>

                  <div
                    ref="previewWrapper"
                    class="preview-content"
                  >
                    <!-- 生成中 -->
                    <div
                      v-if="generationStatus === 'generating'"
                      class="preview-loading"
                    >
                      <div class="loading-spinner"></div>
                      <span>AI 正在生成封面...</span>
                    </div>

                    <!-- 空状态 -->
                    <div
                      v-else-if="!coverHtml"
                      class="preview-empty"
                    >
                      <IconWrapper
                        name="image"
                        :size="48"
                      />
                      <p>输入标题和内容，点击"生成封面"</p>
                      <p class="preview-hint">AI 将根据文章信息生成 HTML 封面</p>
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
                          :srcdoc="coverSrcdoc"
                        ></iframe>
                      </div>
                    </div>
                  </div>

                  <!-- 尺寸信息 -->
                  <div
                    v-if="coverHtml"
                    class="preview-meta"
                  >
                    {{ config.width }} × {{ config.height }} px
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { CoverSizePreset } from "../types"
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { useCoverGenerator } from "../composables/useCoverGenerator"

interface Props {
  visible: boolean
  /** 初始标题 */
  initialTitle?: string
  /** 初始内容 */
  initialContent?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialTitle: "",
  initialContent: "",
})

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "close"): void
  (e: "generated", html: string): void
}>()

const {
  coverHtml,
  generationStatus,
  errorMessage,
  currentConfig: config,
  generateCover,
  cancelGeneration,
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
} = useCoverGenerator()

const coverFrame = ref<HTMLIFrameElement | null>(null)
const contentTextarea = ref<HTMLTextAreaElement | null>(null)
const previewWrapper = ref<HTMLDivElement | null>(null)
const widthInput = ref(String(config.value.width))
const heightInput = ref(String(config.value.height))
const previewScale = ref(1)

// 构建 srcdoc，注入缩放逻辑
const coverSrcdoc = computed(() => {
  if (!coverHtml.value) return ""
  return coverHtml.value
})

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
  const w = config.value.width
  const h = config.value.height
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `scale(${s})`,
    transformOrigin: "center center",
  }
})

// iframe 内联样式（设置 iframe 自身的尺寸与封面一致）
const iframeStyle = computed(() => ({
  width: `${config.value.width}px`,
  height: `${config.value.height}px`,
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
  const scaleX = availW / config.value.width
  const scaleY = availH / config.value.height
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

// 监听 visible 变化，初始化标题/内容
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      if (props.initialTitle && !config.value.title) {
        config.value.title = props.initialTitle
      }
      if (props.initialContent && !config.value.content) {
        config.value.content = props.initialContent
      }
      widthInput.value = String(config.value.width)
      heightInput.value = String(config.value.height)
      // 打开时自适应 textarea 高度 + 启动缩放监听
      nextTick(() => {
        autoResizeTextarea()
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

// 选择尺寸预设
function selectSizePreset(preset: CoverSizePreset) {
  config.value.width = preset.width
  config.value.height = preset.height
  widthInput.value = String(preset.width)
  heightInput.value = String(preset.height)
  nextTick(() => updatePreviewScale())
}

// 更新自定义尺寸
function updateCustomSize() {
  const w = Number.parseInt(widthInput.value, 10)
  const h = Number.parseInt(heightInput.value, 10)
  if (w > 0 && h > 0) {
    config.value.width = w
    config.value.height = h
    nextTick(() => updatePreviewScale())
  }
}

// 生成封面
async function handleGenerate() {
  await generateCover()
  nextTick(() => updatePreviewScale())
}

// 监听 coverHtml 变化（生成完成后），重新计算缩放
watch(coverHtml, () => {
  if (coverHtml.value) {
    nextTick(() => updatePreviewScale())
  }
})

// 自适应 textarea 高度
function autoResizeTextarea() {
  const el = contentTextarea.value
  if (!el) return
  el.style.height = "auto"
  // 最小3行高度，最大10行高度
  const minHeight = 72
  const maxHeight = 240
  el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`
}

// 复制为图片
async function copyCoverAsImage() {
  const iframe = coverFrame.value
  if (!iframe?.contentDocument?.body?.firstElementChild) {
    showMessage("没有可复制的内容", 2000, "info")
    return
  }

  try {
    await nextTick()
    // 优先截取 body 下第一个子元素（通常是封面容器），否则截取 body
    const target = (iframe.contentDocument.body.firstElementChild as HTMLElement) ?? iframe.contentDocument.body
    const canvas = await html2canvas(target, {
      useCORS: true,
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      width: config.value.width,
      height: config.value.height,
      windowWidth: config.value.width,
      windowHeight: config.value.height,
    })

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error("Canvas toBlob 失败"))
      }, "image/png")
    })

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ])

    showMessage("封面已复制为图片", 2000, "info")
  } catch (error) {
    console.error("复制封面为图片失败:", error)
    // 兜底：下载图片
    try {
      const target = (iframe.contentDocument!.body.firstElementChild as HTMLElement) ?? iframe.contentDocument!.body
      const canvas = await html2canvas(target, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        width: config.value.width,
        height: config.value.height,
        windowWidth: config.value.width,
        windowHeight: config.value.height,
      })
      const link = document.createElement("a")
      link.download = `cover-${config.value.width}x${config.value.height}-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      showMessage("已下载为图片（剪贴板不可用）", 2000, "info")
    } catch {
      showMessage("复制失败", 2000, "error")
    }
  }
}

// 下载为图片
async function downloadCoverAsImage() {
  const iframe = coverFrame.value
  if (!iframe?.contentDocument?.body?.firstElementChild) {
    showMessage("没有可下载的内容", 2000, "info")
    return
  }

  try {
    await nextTick()
    const target = (iframe.contentDocument.body.firstElementChild as HTMLElement) ?? iframe.contentDocument.body
    const canvas = await html2canvas(target, {
      useCORS: true,
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      width: config.value.width,
      height: config.value.height,
      windowWidth: config.value.width,
      windowHeight: config.value.height,
    })

    const link = document.createElement("a")
    link.download = `cover-${config.value.width}x${config.value.height}-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
    showMessage("封面已下载", 2000, "info")
  } catch (error) {
    console.error("下载封面失败:", error)
    showMessage("下载失败", 2000, "error")
  }
}

// 关闭
function close() {
  cancelGeneration()
  emit("update:visible", false)
  emit("close")
}
</script>

<style lang="scss" scoped>
@use '../styles/cover-generator.scss';
</style>
