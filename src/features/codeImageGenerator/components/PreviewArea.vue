<template>
  <div class="preview-section">
    <label class="section-label">{{ previewLabel }}</label>
    <div class="preview-container">
      <!-- 代码模式预览 -->
      <div
        v-if="contentType === 'code'"
        class="code-preview"
        :class="[`style-${selectedStyle}`, `theme-${selectedTheme}`]"
        :style="customStyle"
        ref="previewRef"
      >
        <!-- 窗口装饰 -->
        <div class="window-header">
          <div class="window-buttons">
            <span class="window-btn close"></span>
            <span class="window-btn minimize"></span>
            <span class="window-btn maximize"></span>
          </div>
          <div class="window-title">{{ languageDisplay }}</div>
        </div>
        <!-- 代码内容 -->
        <div class="code-content" :style="{ fontSize: fontSize + 'px' }">
          <pre><code v-html="highlightedCode"></code></pre>
        </div>
        <!-- 装饰元素 -->
        <div v-if="showDecorations" class="decorations">
          <div v-if="enableWatermark" class="watermark">{{ watermarkText }}</div>
          <div v-if="enableAuthor || enableTimestamp" class="metadata">
            <span v-if="enableAuthor" class="author">{{ authorName }}</span>
            <span v-if="enableTimestamp" class="timestamp">{{ currentTime }}</span>
          </div>
        </div>
      </div>

      <!-- 文字模式预览 -->
      <div
        v-else
        class="text-preview"
        :class="[`text-style-${selectedStyle}`, `theme-${selectedTheme}`]"
        :style="customStyle"
        ref="previewRef"
      >
        <div class="text-content" :style="{ fontSize: fontSize + 'px' }">
          <div class="text-body">{{ content || defaultText }}</div>
        </div>
        <!-- 装饰元素 -->
        <div v-if="showDecorations" class="decorations">
          <div v-if="enableWatermark" class="watermark">{{ watermarkText }}</div>
          <div v-if="enableAuthor || enableTimestamp" class="metadata">
            <span v-if="enableAuthor" class="author">{{ authorName }}</span>
            <span v-if="enableTimestamp" class="timestamp">{{ currentTime }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

interface Props {
  contentType: "code" | "text";
  selectedStyle: string;
  selectedTheme: string;
  fontSize: number;
  customStyle: CSSProperties;
  highlightedCode: string;
  languageDisplay: string;
  content: string;
  defaultText: string;
  currentTime: string;
  showDecorations: boolean;
  enableWatermark: boolean;
  watermarkText: string;
  enableAuthor: boolean;
  authorName: string;
  enableTimestamp: boolean;
  previewLabel: string;
}

defineProps<Props>();

const previewRef = defineModel<HTMLDivElement | undefined>("previewRef", {
  default: undefined,
});
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
