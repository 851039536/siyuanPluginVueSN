<!-- 代码图片 Tab：代码/文字输入 + 装饰选项 + 实时预览 -->
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
              :class="{ active: contentType === 'code' }"
              @click="contentType = 'code'"
            >
              <!-- 选项："代码" -->
              {{ t.modeCode }}
            </button>
            <button
              class="mode-btn"
              :class="{ active: contentType === 'text' }"
              @click="contentType = 'text'"
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
            {{ contentType === 'code' ? t.codeContentLabel : t.textContentLabel }}
          </label>
          <textarea
            v-model="codeContent"
            class="content-textarea code-input"
            :placeholder="contentType === 'code' ? t.codePlaceholder : t.textPlaceholder"
            rows="8"
          ></textarea>
        </div>

        <!-- 语言选择（仅代码模式） -->
        <div
          v-if="contentType === 'code'"
          class="config-section"
        >
          <label class="config-label">
            <!-- 标签："语言" -->
            {{ t.languageLabel }}
          </label>
          <Select
            v-model="selectedLanguage"
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
            v-model="selectedStyle"
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
            v-model="selectedTheme"
            :options="themeOptions"
            size="xsmall"
          />
        </div>

        <!-- 字体大小 -->
        <div class="config-section">
          <label class="config-label">
            <!-- 标签："字体大小 {值}px" -->
            {{ t.fontSizeLabel }} {{ fontSize }}px
          </label>
          <input
            :value="fontSize"
            type="range"
            min="12"
            max="60"
            step="1"
            class="slider-control"
            @input="fontSize = Number(($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- 装饰选项 -->
        <div class="config-section">
          <div
            class="decoration-header"
            @click="showDecorations = !showDecorations"
          >
            <!-- 折叠标题："装饰选项" -->
            <span class="decoration-title-text">{{ t.decorationsLabel }}</span>
            <IconWrapper
              :name="showDecorations ? 'chevronUp' : 'chevronDown'"
              :size="14"
              class="decoration-chevron"
              :class="{ expanded: showDecorations }"
            />
          </div>

          <div
            v-if="showDecorations"
            class="decoration-body"
          >
            <!-- 水印 -->
            <div class="deco-row">
              <Switch
                :model-value="enableWatermark"
                :label="t.showWatermark"
                size="xsmall"
                @update:model-value="enableWatermark = $event"
              />
              <input
                v-if="enableWatermark"
                v-model="watermarkText"
                class="deco-input"
                :placeholder="t.watermarkTextPlaceholder"
              />
            </div>
            <!-- 作者 -->
            <div class="deco-row">
              <Switch
                :model-value="enableAuthor"
                :label="t.showAuthor"
                size="xsmall"
                @update:model-value="enableAuthor = $event"
              />
              <input
                v-if="enableAuthor"
                v-model="authorName"
                class="deco-input"
                :placeholder="t.authorPlaceholder"
              />
            </div>
            <!-- 时间戳 -->
            <div class="deco-row">
              <Switch
                :model-value="enableTimestamp"
                :label="t.showTimestamp"
                size="xsmall"
                @update:model-value="enableTimestamp = $event"
              />
            </div>

            <!-- 高级样式 -->
            <div class="deco-group-title">
              <!-- 分组标题："高级样式" -->
              {{ t.advancedStyles }}
            </div>
            <div class="deco-slider-row">
              <!-- 滑块标签："边框宽度" -->
              <span class="deco-slider-label">{{ t.borderWidth }}</span>
              <input
                :value="borderWidth"
                type="range"
                min="0"
                max="10"
                step="1"
                class="mini-slider"
                @input="borderWidth = Number(($event.target as HTMLInputElement).value)"
              />
              <span class="deco-slider-val">{{ borderWidth }}px</span>
            </div>
            <div class="deco-slider-row">
              <!-- 滑块标签："圆角" -->
              <span class="deco-slider-label">{{ t.borderRadius }}</span>
              <input
                :value="borderRadius"
                type="range"
                min="0"
                max="32"
                step="2"
                class="mini-slider"
                @input="borderRadius = Number(($event.target as HTMLInputElement).value)"
              />
              <span class="deco-slider-val">{{ borderRadius }}px</span>
            </div>
            <div class="deco-slider-row">
              <!-- 滑块标签："内边距" -->
              <span class="deco-slider-label">{{ t.paddingSize }}</span>
              <input
                :value="paddingSize"
                type="range"
                min="0"
                max="48"
                step="4"
                class="mini-slider"
                @input="paddingSize = Number(($event.target as HTMLInputElement).value)"
              />
              <span class="deco-slider-val">{{ paddingSize }}px</span>
            </div>
            <div class="deco-slider-row">
              <!-- 滑块标签："背景透明度" -->
              <span class="deco-slider-label">{{ t.backgroundOpacity }}</span>
              <input
                :value="backgroundOpacity"
                type="range"
                min="0"
                max="100"
                step="5"
                class="mini-slider"
                @input="backgroundOpacity = Number(($event.target as HTMLInputElement).value)"
              />
              <span class="deco-slider-val">{{ backgroundOpacity }}%</span>
            </div>
            <div class="deco-slider-row">
              <!-- 滑块标签："阴影强度" -->
              <span class="deco-slider-label">{{ t.shadowIntensity }}</span>
              <input
                :value="shadowIntensity"
                type="range"
                min="0"
                max="100"
                step="10"
                class="mini-slider"
                @input="shadowIntensity = Number(($event.target as HTMLInputElement).value)"
              />
              <span class="deco-slider-val">{{ shadowIntensity }}%</span>
            </div>
          </div>
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
              icon="contentCopy"
              :title="t.copyImage"
              :disabled="!codeContent"
              @click="handleCopy"
            />
            <Button
              variant="ghost"
              size="xsmall"
              icon="download"
              :title="t.downloadImage"
              :disabled="!codeContent"
              @click="handleDownload"
            />
          </div>
        </div>

        <div class="preview-content code-preview-wrapper">
          <!-- 代码模式预览 -->
          <div
            v-if="contentType === 'code'"
            ref="codePreview"
            class="code-preview"
            :class="[`style-${selectedStyle}`, `theme-${selectedTheme}`]"
            :style="previewCustomStyle"
          >
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
              :style="{ fontSize: `${fontSize}px` }"
            >
              <pre><code v-html="highlightedCode" /></pre>
            </div>
            <div
              v-if="enableWatermark || enableAuthor || enableTimestamp"
              class="decorations"
            >
              <div
                v-if="enableWatermark"
                class="watermark"
              >
                {{ watermarkText }}
              </div>
              <div
                v-if="enableAuthor || enableTimestamp"
                class="metadata"
              >
                <span
                  v-if="enableAuthor"
                  class="author"
                >{{ authorName }}</span>
                <span
                  v-if="enableTimestamp"
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
            :class="[`text-style-${selectedStyle}`, `theme-${selectedTheme}`]"
            :style="previewCustomStyle"
          >
            <div
              class="text-content"
              :style="{ fontSize: `${fontSize}px` }"
            >
              <div class="text-body">
                <!-- 空内容提示："在这里输入文字..." -->
                {{ codeContent || t.textEmptyHint }}
              </div>
            </div>
            <div
              v-if="enableWatermark || enableAuthor || enableTimestamp"
              class="decorations"
            >
              <div
                v-if="enableWatermark"
                class="watermark"
              >
                {{ watermarkText }}
              </div>
              <div
                v-if="enableAuthor || enableTimestamp"
                class="metadata"
              >
                <span
                  v-if="enableAuthor"
                  class="author"
                >{{ authorName }}</span>
                <span
                  v-if="enableTimestamp"
                  class="timestamp"
                >{{ currentTime }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 代码图片 Tab：代码/文字输入 + 语言/风格/主题选择 + 装饰选项 + 实时预览
 */
import type { ImageCreationI18n } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"
import { usePlugin } from "@/main"
import { useCodeImageGenerator } from "../composables/useCodeImageGenerator"

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const {
  contentType,
  codeContent,
  selectedLanguage,
  selectedStyle,
  selectedTheme,
  fontSize,
  codePreview,
  showDecorations,
  enableWatermark,
  watermarkText,
  enableAuthor,
  authorName,
  enableTimestamp,
  borderWidth,
  borderRadius,
  paddingSize,
  backgroundOpacity,
  shadowIntensity,
  languageOptions,
  themeOptions,
  currentStyleOptions,
  highlightedCode,
  currentTime,
  previewCustomStyle,
  getLanguageDisplay,
  copyImage,
  downloadImage,
} = useCodeImageGenerator(t)

const handleCopy = () => copyImage()
const handleDownload = () => downloadImage()
</script>

<style scoped lang="scss">
@use "../styles/CodeImageTab.scss";
@use "../styles/index.scss";
</style>
