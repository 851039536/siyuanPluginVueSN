<template>
  <div class="code-image-tab">
    <div class="cover-layout">
      <!-- 左侧：配置面板 -->
      <div class="config-panel">
        <!-- 内容模式 -->
        <div class="config-section">
          <label class="config-label">内容类型</label>
          <div class="mode-toggle">
            <button
              class="mode-btn"
              :class="{ active: contentType === 'code' }"
              @click="contentType = 'code'"
            >
              代码
            </button>
            <button
              class="mode-btn"
              :class="{ active: contentType === 'text' }"
              @click="contentType = 'text'"
            >
              文字
            </button>
          </div>
        </div>

        <!-- 内容输入 -->
        <div class="config-section">
          <label class="config-label">
            {{ contentType === 'code' ? '代码内容' : '文字内容' }}
          </label>
          <textarea
            v-model="codeContent"
            class="content-textarea code-input"
            :placeholder="contentType === 'code' ? '输入代码...' : '输入文字内容...'"
            rows="8"
            style="font-family: monospace"
          ></textarea>
        </div>

        <!-- 语言选择（仅代码模式） -->
        <div
          v-if="contentType === 'code'"
          class="config-section"
        >
          <label class="config-label">语言</label>
          <Select
            v-model="selectedLanguage"
            :options="languageOptions"
            size="small"
          />
        </div>

        <!-- 风格选择 -->
        <div class="config-section">
          <label class="config-label">风格</label>
          <Select
            v-model="selectedStyle"
            :options="currentStyleOptions"
            size="small"
          />
        </div>

        <!-- 主题 -->
        <div class="config-section">
          <label class="config-label">主题</label>
          <Select
            v-model="selectedTheme"
            :options="themeOptions"
            size="small"
          />
        </div>

        <!-- 字体大小 -->
        <div class="config-section">
          <label class="config-label">字体大小 {{ fontSize }}px</label>
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
            <span class="decoration-title-text">装饰选项</span>
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
                label="显示水印"
                size="small"
                @update:model-value="enableWatermark = $event"
              />
              <input
                v-if="enableWatermark"
                v-model="watermarkText"
                class="deco-input"
                placeholder="水印文字"
              />
            </div>
            <!-- 作者 -->
            <div class="deco-row">
              <Switch
                :model-value="enableAuthor"
                label="显示作者"
                size="small"
                @update:model-value="enableAuthor = $event"
              />
              <input
                v-if="enableAuthor"
                v-model="authorName"
                class="deco-input"
                placeholder="作者名称"
              />
            </div>
            <!-- 时间戳 -->
            <div class="deco-row">
              <Switch
                :model-value="enableTimestamp"
                label="显示时间"
                size="small"
                @update:model-value="enableTimestamp = $event"
              />
            </div>

            <!-- 高级样式 -->
            <div class="deco-group-title">
              高级样式
            </div>
            <div class="deco-slider-row">
              <span class="deco-slider-label">边框宽度</span>
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
              <span class="deco-slider-label">圆角</span>
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
              <span class="deco-slider-label">内边距</span>
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
              <span class="deco-slider-label">背景透明度</span>
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
              <span class="deco-slider-label">阴影强度</span>
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
          <span>预览</span>
          <div class="preview-actions">
            <Button
              variant="ghost"
              size="small"
              icon="contentCopy"
              title="复制为图片"
              :disabled="!codeContent"
              @click="handleCopy"
            />
            <Button
              variant="ghost"
              size="small"
              icon="download"
              title="下载为图片"
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
                {{ codeContent || '在这里输入文字...' }}
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
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import Switch from "@/components/Switch.vue"
import {
  languageOptions,
  themeOptions,
  useCodeImageGenerator,
} from "../composables/useCodeImageGenerator"

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
  currentStyleOptions,
  highlightedCode,
  currentTime,
  previewCustomStyle,
  getLanguageDisplay,
  copyImage,
  downloadImage,
} = useCodeImageGenerator()

const handleCopy = () => copyImage("图片已复制到剪贴板", "复制失败")
const handleDownload = () => downloadImage("图片已下载", "下载失败")
</script>

<style lang="scss" scoped>
@use "../styles/cover-generator.scss";
@use "../styles/code-image-styles";

.code-image-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
}

// 内容类型切换
.mode-toggle {
  display: flex;
  border: 1px solid var(--b3-theme-background-light);
  border-radius: 6px;
  overflow: hidden;

  .mode-btn {
    flex: 1;
    padding: 5px 12px;
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;

    &.active {
      background: var(--b3-theme-primary);
      color: #fff;
    }

    &:not(.active):hover {
      background: var(--b3-theme-background-light);
    }
  }
}

// 代码输入
.code-input {
  font-family: "Fira Code", "Cascadia Code", Consolas, monospace !important;
  resize: vertical;
}

// 滑块
.slider-control {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--b3-theme-background-light);
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--b3-theme-primary);
    cursor: pointer;
  }
}

// 装饰选项
.decoration-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--b3-theme-background-light);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  .decoration-title-text {
    font-size: 12px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .decoration-chevron {
    color: var(--b3-theme-on-surface);
    transition: transform 0.2s;

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.decoration-body {
  padding: 10px;
  border: 1px solid var(--b3-theme-background-light);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deco-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deco-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--b3-theme-background-light);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 11px;
  outline: none;

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.deco-group-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0 2px;
}

.deco-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deco-slider-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  min-width: 65px;
}

.deco-slider-val {
  font-size: 10px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  min-width: 32px;
  text-align: right;
}

// 预览区域
.code-preview-wrapper {
  padding: 12px;
  overflow: auto;
}

.code-preview {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 400px;
  max-width: 100%;
}

// 窗口装饰
.window-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  gap: 10px;
}

.window-buttons {
  display: flex;
  gap: 6px;
}

.window-btn {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: block;

  &.close { background: #ff5f56; }
  &.minimize { background: #ffbd2e; }
  &.maximize { background: #27c93f; }
}

.window-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  flex: 1;
  text-align: center;
}

.code-content {
  padding: 12px;
  overflow-x: auto;

  pre {
    margin: 0;
    line-height: 1.5;
  }

  code {
    display: block;
    white-space: pre;
  }
}

// 文字预览
.text-preview {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  min-width: 400px;
  max-width: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.text-content {
  flex: 1;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.text-body {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.8;
}

// 装饰元素
.decorations {
  position: relative;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.watermark {
  font-size: 9px;
  color: rgba(0, 0, 0, 0.5);
  font-weight: 500;
}

.metadata {
  display: flex;
  gap: 10px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.7);
}

.author::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 3px;
  vertical-align: -1px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E") no-repeat center;
  mask-size: contain;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E") no-repeat center;
  -webkit-mask-size: contain;
}
.timestamp::before {
  content: "";
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 3px;
  vertical-align: -1px;
  background: currentColor;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'/%3E%3C/svg%3E") no-repeat center;
  mask-size: contain;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z'/%3E%3C/svg%3E") no-repeat center;
  -webkit-mask-size: contain;
}
</style>
