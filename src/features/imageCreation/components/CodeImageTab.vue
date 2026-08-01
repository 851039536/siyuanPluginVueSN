<!-- 代码图片 Tab：配置表单 + 字体/主题/导出设置 + 装饰/底色 + 预览与灵感候选 -->
<template>
  <div class="code-image-tab">
    <div class="cover-layout">
      <!-- 左侧：配置面板 -->
      <div class="config-panel">
        <!-- 内容类型 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："内容类型" -->
            {{ t.contentTypeLabel }}
          </label>
          <div class="mode-toggle">
            <button
              class="mode-btn"
              :class="{ active: state.contentType === 'code' }"
              @click="state.contentType = 'code'"
            >
              <!-- 选项："代码" -->
              {{ t.modeCode }}
            </button>
            <button
              class="mode-btn"
              :class="{ active: state.contentType === 'text' }"
              @click="state.contentType = 'text'"
            >
              <!-- 选项："文字" -->
              {{ t.modeText }}
            </button>
          </div>
        </div>

        <!-- 内容输入 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："代码内容" / "文字内容" -->
            {{ state.contentType === 'code' ? t.codeContentLabel : t.textContentLabel }}
          </label>
          <textarea
            v-model="state.codeContent"
            class="content-textarea code-input"
            :placeholder="state.contentType === 'code' ? t.codePlaceholder : t.textPlaceholder"
            rows="8"
          ></textarea>
        </div>

        <!-- 语言选择（仅代码模式） -->
        <div
          v-if="state.contentType === 'code'"
          class="config-section"
        >
          <label class="config-label">
            <!-- 标签："语言" -->
            {{ t.languageLabel }}
          </label>
          <Select
            v-model="state.selectedLanguage"
            :options="languageOptions"
            size="xsmall"
          />
        </div>

        <!-- 风格选择 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："风格" -->
            {{ t.codeStyleLabel }}
          </label>
          <Select
            v-model="state.selectedStyle"
            :options="currentStyleOptions"
            size="xsmall"
          />
        </div>

        <!-- 主题 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："主题" -->
            {{ t.themeLabel }}
          </label>
          <Select
            v-model="state.selectedTheme"
            :options="themeOptions"
            size="xsmall"
          />
        </div>

        <!-- 字体 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："字体" -->
            {{ t.fontLabel }}
          </label>
          <Select
            v-model="state.fontFamily"
            :options="fontOptions"
            size="xsmall"
          />
        </div>

        <!-- 高亮主题（仅代码模式） -->
        <div
          v-if="state.contentType === 'code'"
          class="config-section"
        >
          <label class="config-label">
            <!-- 标签："高亮主题" -->
            {{ t.hljsThemeLabel }}
          </label>
          <Select
            :model-value="state.hljsTheme"
            :options="hljsThemeOptions"
            size="xsmall"
            @update:model-value="onHljsThemeChange"
          />
        </div>

        <!-- 字体大小 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："字体大小 {值}px" -->
            {{ t.fontSizeLabel }} {{ state.fontSize }}px
          </label>
          <input
            :value="state.fontSize"
            type="range"
            min="12"
            max="60"
            step="1"
            class="slider-control"
            @input="state.fontSize = Number(($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- 装饰选项（水印/作者/时间戳 + 高级样式） -->
        <CodeImageDecorationSettings :service="service" />

        <!-- 底色与背景图 -->
        <div class="config-section">
          <div class="deco-group-title">
            <!-- 分组标题："自定义底色" -->
            {{ t.bgColorLabel }}
          </div>
          <div class="deco-row">
            <Switch
              :model-value="state.bgColorEnabled"
              :label="t.bgColorEnable"
              size="xsmall"
              @update:model-value="state.bgColorEnabled = $event"
            />
            <input
              v-if="state.bgColorEnabled"
              v-model="state.bgColor"
              type="color"
              class="color-swatch"
            />
          </div>
          <div class="deco-group-title">
            <!-- 分组标题："背景图" -->
            {{ t.bgImageLabel }}
          </div>
          <div class="deco-row">
            <Button
              variant="ghost"
              size="xsmall"
              icon="upload"
              :title="t.bgImageUpload"
              @click="triggerBgFileInput"
            />
            <Button
              v-if="codeSettings.bgImagePath"
              variant="ghost"
              size="xsmall"
              icon="delete"
              :title="t.bgImageRemove"
              @click="removeBgImage"
            />
            <!-- 空提示："未设置背景图" -->
            <span
              v-if="!codeSettings.bgImagePath"
              class="bg-empty-hint"
            >{{ t.bgImageEmptyHint }}</span>
            <img
              v-if="bgImageDataUrl"
              class="bg-thumb"
              :src="bgImageDataUrl"
              alt="bg"
            />
          </div>
          <input
            ref="bgFileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            @change="onBgFileChange"
          />
        </div>
      </div>

      <!-- 右侧：预览面板 -->
      <div class="preview-panel">
        <div class="preview-header">
          <!-- 预览标题："预览" -->
          <span>{{ t.preview }}</span>
          <div class="preview-actions">
            <Button
              variant="ghost"
              size="xsmall"
              @click="generateCandidates"
            >
              <!-- 按钮文案："灵感模式" -->
              {{ t.inspirationLabel }}
            </Button>
            <Select
              v-model="state.exportFormat"
              :options="exportFormatOptions"
              size="xsmall"
            />
            <Select
              v-model="state.exportScale"
              :options="scaleOptions"
              size="xsmall"
            />
            <Slider
              v-if="state.exportFormat === 'jpeg'"
              v-model="state.jpegQuality"
              :label="t.jpegQualityLabel"
              :min="0.5"
              :max="1"
              :step="0.05"
              size="xsmall"
              :show-value="true"
              :format-value="qualityFormat"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="contentCopy"
              :title="t.copyImage"
              :disabled="!state.codeContent"
              @click="copyImage"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="download"
              :title="t.downloadImage"
              :disabled="!state.codeContent"
              @click="downloadImage"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="code"
              :title="t.copyHtml"
              :disabled="!state.codeContent"
              @click="copyHtml"
            />
          </div>
        </div>

        <div class="preview-content code-preview-wrapper">
          <!-- 代码模式预览 -->
          <div
            v-if="state.contentType === 'code'"
            ref="codePreview"
            class="code-preview"
            :class="[`style-${state.selectedStyle}`, `theme-${state.selectedTheme}`, `hljs-theme-${state.hljsTheme}`]"
            :style="previewCustomStyle"
          >
            <div
              class="bg-layer"
              :class="[`style-${state.selectedStyle}`, `theme-${state.selectedTheme}`]"
              :style="bgLayerStyle"
            ></div>
            <div class="window-header">
              <div class="window-buttons">
                <span class="window-btn close" />
                <span class="window-btn minimize" />
                <span class="window-btn maximize" />
              </div>
              <div class="window-title">
                {{ getLanguageDisplay() }}
              </div>
            </div>
            <div
              class="code-content"
              :style="contentStyle"
            >
              <pre><code v-html="highlightedCode" /></pre>
            </div>
            <div
              v-if="state.enableWatermark || state.enableAuthor || state.enableTimestamp"
              class="decorations"
            >
              <div
                v-if="state.enableWatermark"
                class="watermark"
              >
                {{ state.watermarkText }}
              </div>
              <div
                v-if="state.enableAuthor || state.enableTimestamp"
                class="metadata"
              >
                <span
                  v-if="state.enableAuthor"
                  class="author"
                >{{ state.authorName }}</span>
                <span
                  v-if="state.enableTimestamp"
                  class="timestamp"
                >{{ currentTime }}</span>
              </div>
            </div>
          </div>

          <!-- 文字模式预览 -->
          <div
            v-else
            ref="codePreview"
            class="text-preview"
            :class="[`text-style-${state.selectedStyle}`, `theme-${state.selectedTheme}`]"
            :style="previewCustomStyle"
          >
            <div
              class="bg-layer"
              :class="[`text-style-${state.selectedStyle}`, `theme-${state.selectedTheme}`]"
              :style="bgLayerStyle"
            ></div>
            <div
              class="text-content"
              :style="contentStyle"
            >
              <div class="text-body">
                <!-- 空内容提示："在这里输入文字..." -->
                {{ state.codeContent || t.textEmptyHint }}
              </div>
            </div>
            <div
              v-if="state.enableWatermark || state.enableAuthor || state.enableTimestamp"
              class="decorations"
            >
              <div
                v-if="state.enableWatermark"
                class="watermark"
              >
                {{ state.watermarkText }}
              </div>
              <div
                v-if="state.enableAuthor || state.enableTimestamp"
                class="metadata"
              >
                <span
                  v-if="state.enableAuthor"
                  class="author"
                >{{ state.authorName }}</span>
                <span
                  v-if="state.enableTimestamp"
                  class="timestamp"
                >{{ currentTime }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 灵感模式候选条 -->
        <CodeImageCandidateStrip :service="service" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 代码图片 Tab：配置表单 + 字体/主题/导出设置 + 装饰/底色 + 预览与灵感候选
 */
import type { SelectOption } from "@/components/Select.vue"
import type { ImageCreationI18n } from "../types"
import {
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import Slider from "@/components/Slider.vue"
import Switch from "@/components/Switch.vue"
import { usePlugin } from "@/main"
import { useCodeImageGenerator } from "../composables/useCodeImageGenerator"
import { useCodeImageSettings } from "../composables/useCodeImageSettings"
import CodeImageCandidateStrip from "./CodeImageCandidateStrip.vue"
import CodeImageDecorationSettings from "./CodeImageDecorationSettings.vue"

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const codeImageSettings = useCodeImageSettings(plugin, t)
const service = useCodeImageGenerator(t, codeImageSettings)

const {
  state,
  codePreview,
  languageOptions,
  themeOptions,
  fontOptions,
  hljsThemeOptions,
  scaleOptions,
  currentStyleOptions,
  highlightedCode,
  currentTime,
  previewCustomStyle,
  bgLayerStyle,
  contentStyle,
  getLanguageDisplay,
  onHljsThemeChange,
  generateCandidates,
  copyImage,
  copyHtml,
  downloadImage,
  applyPersistedPrefs,
} = service

const exportFormatOptions: SelectOption[] = [
  { value: "png", label: t.formatPng },
  { value: "jpeg", label: t.formatJpeg },
  { value: "webp", label: t.formatWebp },
]

// 背景图
const bgFileInput = ref<HTMLInputElement>()
const codeSettings = codeImageSettings.settings
const bgImageDataUrl = codeImageSettings.bgImageDataUrl
const { removeBgImage } = codeImageSettings

function triggerBgFileInput() {
  bgFileInput.value?.click()
}

function onBgFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void codeImageSettings.uploadBgImage(file)
  }
  // 清空以允许再次选择同一文件
  input.value = ""
}

const qualityFormat = (v: number) => `${Math.round(v * 100)}%`

// 启动时应用持久化偏好（字体/主题/装饰/导出/底色等）
onMounted(() => {
  void applyPersistedPrefs()
})
</script>

<style scoped lang="scss">
@use "../styles/CodeImageTab.scss";
@use "../styles/index.scss";
</style>
