<!-- 文章封面 Tab：左侧配置表单 + 封面预览面板 + AI 关键字提取 -->
<template>
  <div class="cover-layout">
    <!-- 左侧：配置区 -->
    <div class="config-panel">
      <!-- 文章标题 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："文章标题" -->
          {{ t.coverTitleLabel }}
        </label>
        <Input
          v-model="config.title"
          type="text"
          :placeholder="t.coverTitlePlaceholder"
        />
      </div>

      <!-- 分类挂饰 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："分类挂饰" -->
          {{ t.categoryLabel }}
          <!-- 辅助说明："（标题右侧，如：原创 · 技术 · 前端）" -->
          <span class="config-hint">{{ t.categoryHint }}</span>
        </label>
        <Input
          v-model="config.category"
          type="text"
          :placeholder="t.categoryPlaceholder"
        />
      </div>

      <!-- 内容摘要：AI 提取关键字 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："内容摘要" -->
          {{ t.contentSummaryLabel }}
          <!-- 辅助说明："（AI 自动提取关键字）" -->
          <span class="config-hint">{{ t.contentSummaryHint }}</span>
        </label>
        <textarea
          v-model="contentText"
          class="content-textarea"
          :placeholder="t.contentSummaryPlaceholder"
          rows="4"
        ></textarea>
        <Button
          variant="secondary"
          size="xsmall"
          :disabled="!contentText.trim() || aiExtracting"
          @click="aiExtractKeywords"
        >
          <!-- 按钮文案："AI提取中..." / "AI提取关键字" -->
          {{ aiExtracting ? t.aiExtracting : t.aiExtract }}
        </Button>
      </div>

      <!-- 关键字 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："关键字" -->
          {{ t.keywordsLabel }}
          <!-- 辅助说明："（空格分隔，如：Vue 3 响应式 原理）" -->
          <span class="config-hint">{{ t.keywordsHint }}</span>
        </label>
        <Input
          v-model="config.keywords"
          type="text"
          :placeholder="t.keywordsPlaceholder"
        />
      </div>

      <!-- 水印 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："水印" -->
          {{ t.watermarkLabel }}
          <!-- 辅助说明："（左下角显示）" -->
          <span class="config-hint">{{ t.watermarkHint }}</span>
        </label>
        <Input
          v-model="config.watermark"
          type="text"
          :placeholder="t.watermarkPlaceholder"
        />
      </div>

      <!-- 封面尺寸 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："封面尺寸" -->
          {{ t.sizeLabel }}
        </label>
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
              :placeholder="t.widthPlaceholder"
              size="xsmall"
              @change="updateCustomSize"
            />
            <span class="size-x">×</span>
            <Input
              v-model="heightInput"
              type="number"
              :placeholder="t.heightPlaceholder"
              size="xsmall"
              @change="updateCustomSize"
            />
            <span class="size-unit">px</span>
          </div>
        </div>
      </div>

      <!-- 封面风格 -->
      <div class="config-section">
        <label class="config-label">
          <!-- 标签："封面风格" -->
          {{ t.styleLabel }}
        </label>
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
          variant="primary"
          :disabled="!config.title.trim()"
          @click="generateCover()"
        >
          <!-- 按钮文案："刷新封面" / "生成封面" -->
          {{ generationStatus === 'done' ? t.refreshCover : t.generateCover }}
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

    <!-- 右侧：预览面板 -->
    <CoverPreview
      :visible="visible"
      :cover-html="coverHtml"
      :width="config.width"
      :height="config.height"
      :status="generationStatus"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 文章封面 Tab：配置表单 + AI 关键字提取 + 尺寸/风格选择（预览见 CoverPreview）
 */
import type { CoverSizePreset } from "../types"
import type { ImageCreationI18n } from "../types"
import { showMessage } from "siyuan"
import {
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import { usePlugin } from "@/main"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { useCoverGenerator } from "../composables/useCoverGenerator"
import CoverPreview from "./CoverPreview.vue"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const {
  coverHtml,
  generationStatus,
  errorMessage,
  currentConfig: config,
  generateCover,
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
} = useCoverGenerator(t)

const widthInput = ref(String(config.value.width))
const heightInput = ref(String(config.value.height))

// AI 关键字提取
const contentText = ref("")
const aiExtracting = ref(false)

async function aiExtractKeywords() {
  if (!contentText.value.trim() || aiExtracting.value) return
  aiExtracting.value = true
  try {
    const apiConfig = getApiConfigFromPlugin(plugin)
    const prompt = `从以下文章内容中提取 3-8 个核心关键字，以空格分隔，只返回关键字不要解释：\n\n${contentText.value.slice(0, 3000)}`
    const result = await callAI(prompt, apiConfig)
    const keywords = result.trim().replace(/[,，、\n]/g, " ").replace(/\s+/g, " ")
    config.value.keywords = keywords
    showMessage(t.msgKeywordsExtracted, 2000, "info")
  } catch (error) {
    console.error("AI提取关键字失败:", error)
    showMessage(t.msgAiFailed, 3000, "error")
  } finally {
    aiExtracting.value = false
  }
}

// 选择尺寸预设
function selectSizePreset(preset: CoverSizePreset) {
  config.value.width = preset.width
  config.value.height = preset.height
  widthInput.value = String(preset.width)
  heightInput.value = String(preset.height)
}

// 更新自定义尺寸
function updateCustomSize() {
  const w = Number.parseInt(widthInput.value, 10)
  const h = Number.parseInt(heightInput.value, 10)
  if (w > 0 && h > 0) {
    config.value.width = w
    config.value.height = h
  }
}

// 响应式自动生成：文字变化 debounce 200ms 避免频繁触发
let autoGenTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [config.value.title, config.value.category, config.value.keywords],
  () => {
    if (autoGenTimer) clearTimeout(autoGenTimer)
    autoGenTimer = setTimeout(() => {
      if (config.value.title.trim()) {
        generateCover()
      }
    }, 200)
  },
)

// 尺寸/风格变化：即时生成（无需 debounce）
watch(
  () => [config.value.styleId, config.value.width, config.value.height],
  () => {
    if (config.value.title.trim()) {
      generateCover()
    }
  },
)

// 组件卸载时清理防抖定时器
onUnmounted(() => {
  if (autoGenTimer) {
    clearTimeout(autoGenTimer)
    autoGenTimer = null
  }
})

// 监听打开，同步自定义尺寸输入框
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      widthInput.value = String(config.value.width)
      heightInput.value = String(config.value.height)
    }
  },
)
</script>

<style scoped lang="scss">
@use "../styles/CoverTab.scss";
@use "../styles/index.scss";
</style>
