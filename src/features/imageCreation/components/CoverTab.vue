<!-- 文章封面 Tab：配置表单 + AI 全自动封面 + 装饰设置 + 换风格（预览见 CoverPreview） -->
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

      <!-- 内容摘要：AI 提取关键字 + AI 全自动封面 -->
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
        <div class="config-actions">
          <Button
            variant="secondary"
            size="xsmall"
            :disabled="!contentText.trim() || aiExtracting"
            @click="aiExtractKeywords"
          >
            <!-- 按钮文案："AI提取中..." / "AI提取关键字" -->
            {{ aiExtracting ? t.aiExtracting : t.aiExtract }}
          </Button>
          <Button
            variant="secondary"
            size="xsmall"
            :disabled="!contentText.trim() || aiAutoRunning"
            @click="aiAutoGenerate"
          >
            <!-- 按钮文案："AI 生成中..." / "AI 全自动封面" -->
            {{ aiAutoRunning ? t.aiAutoRunning : t.aiAutoCover }}
          </Button>
        </div>
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

      <!-- 封面装饰设置（主题色/水印/Logo） -->
      <CoverDecorationSettings :service="coverSettings" />

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
        <Button
          variant="secondary"
          size="xsmall"
          icon="refresh"
          :title="t.shuffleStyle"
          @click="randomStyle"
        />
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
      :settings-service="coverSettings"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 文章封面 Tab：配置表单 + AI 关键字提取 + AI 全自动封面 + 装饰设置 + 换风格
 */
import type { CoverSizePreset } from "../types"
import type { ImageCreationI18n } from "../types"
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
import { usePlugin } from "@/main"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { COVER_STYLE_REGISTRY } from "../types"
import { useCoverGenerator } from "../composables/useCoverGenerator"
import { useCoverSettings } from "../composables/useCoverSettings"
import CoverDecorationSettings from "./CoverDecorationSettings.vue"
import CoverPreview from "./CoverPreview.vue"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const coverSettings = useCoverSettings(plugin, t)
const {
  coverHtml,
  generationStatus,
  errorMessage,
  currentConfig: config,
  generateCover,
  randomStyle,
  applyPersistedPrefs,
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
} = useCoverGenerator(t, coverSettings)

const widthInput = ref(String(config.value.width))
const heightInput = ref(String(config.value.height))

// AI 关键字提取
const contentText = ref("")
const aiExtracting = ref(false)

// AI 全自动封面
const aiAutoRunning = ref(false)

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

/** AI 全自动封面：产出标题/关键字/风格建议，填入并自动生成 */
async function aiAutoGenerate() {
  if (!contentText.value.trim() || aiAutoRunning.value) return
  aiAutoRunning.value = true
  try {
    const apiConfig = getApiConfigFromPlugin(plugin)
    const result = await callAI(buildAiAutoPrompt(contentText.value.slice(0, 3000)), apiConfig)
    const parsed = parseAiAutoResult(result)
    if (!parsed) {
      showMessage(t.aiAutoParseFailed, 3000, "error")
      return
    }
    if (parsed.title) config.value.title = parsed.title
    if (parsed.keywords.length) config.value.keywords = parsed.keywords.join(" ")
    if (parsed.styleId && COVER_STYLE_REGISTRY.some((s) => s.id === parsed.styleId)) {
      config.value.styleId = parsed.styleId
    }
    await generateCover()
  } catch (error) {
    console.error("AI 全自动封面失败:", error)
    showMessage(t.msgAiFailed, 3000, "error")
  } finally {
    aiAutoRunning.value = false
  }
}

/** AI 封面 prompt（按界面语言取中/英文模板，附风格注册表供 AI 选择） */
function buildAiAutoPrompt(content: string): string {
  const styleList = COVER_STYLE_REGISTRY
    .map((s) => `${s.id}: ${s.label}（${s.description}）`)
    .join("；")
  const zh = `你是封面设计助手。根据以下文章内容生成封面配置，严格只返回 JSON（不要任何其他文字）：
{"title":"不超过16字的吸引人标题","keywords":["关键字1","关键字2","关键字3"],"styleId":"风格id"}
可选风格（styleId: 名称（描述））：${styleList}
请根据内容主题选择最匹配的风格。
文章内容：
${content}`
  const en = `You are a cover design assistant. Based on the article content below, generate a cover config and return ONLY JSON (no extra text):
{"title":"an attractive title within 16 characters","keywords":["keyword1","keyword2","keyword3"],"styleId":"style id"}
Available styles (styleId: label (description)): ${styleList}
Pick the most fitting style based on the article topic.
Article content:
${content}`
  return navigator.language.toLowerCase().startsWith("zh") ? zh : en
}

/** 解析 AI 返回的 JSON（兼容 ```json 代码块包裹） */
function parseAiAutoResult(raw: string): { title: string, keywords: string[], styleId: string } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const obj = JSON.parse(match[0])
    const title = typeof obj.title === "string" ? obj.title.trim() : ""
    const keywords = Array.isArray(obj.keywords)
      ? obj.keywords
        .filter((k: unknown): k is string => typeof k === "string")
        .map((k) => k.trim())
        .filter(Boolean)
      : []
    const styleId = typeof obj.styleId === "string" ? obj.styleId.trim() : ""
    if (!title && !keywords.length) return null
    return { title, keywords, styleId }
  } catch {
    return null
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
        void generateCover()
      }
    }, 200)
  },
)

// 尺寸/风格变化：同步偏好设置 + 即时生成（无需 debounce）
watch(
  () => [config.value.styleId, config.value.width, config.value.height],
  () => {
    coverSettings.settings.value.styleId = config.value.styleId
    coverSettings.settings.value.width = config.value.width
    coverSettings.settings.value.height = config.value.height
    if (config.value.title.trim()) {
      void generateCover()
    }
  },
)

// 偏好设置中影响封面的部分（颜色/水印/Logo/尺寸/风格）变化时防抖重生成
const coverAffectingSettings = computed(() => JSON.stringify({
  colors: coverSettings.settings.value.colors,
  watermark: coverSettings.settings.value.watermark,
  logo: coverSettings.settings.value.logo,
  width: coverSettings.settings.value.width,
  height: coverSettings.settings.value.height,
  styleId: coverSettings.settings.value.styleId,
}))
watch(coverAffectingSettings, () => {
  if (autoGenTimer) clearTimeout(autoGenTimer)
  autoGenTimer = setTimeout(() => {
    if (config.value.title.trim()) {
      void generateCover()
    }
  }, 200)
})

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

// 启动时应用持久化偏好（尺寸/风格）
onMounted(async () => {
  await applyPersistedPrefs()
  widthInput.value = String(config.value.width)
  heightInput.value = String(config.value.height)
})
</script>

<style scoped lang="scss">
@use "../styles/CoverTab.scss";
@use "../styles/index.scss";
</style>
