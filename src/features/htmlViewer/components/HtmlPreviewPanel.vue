<!-- HTML展示 - 预览面板（iframe） -->
<template>
  <div
    class="preview-panel"
    :class="{ 'split-mode': split }"
  >
    <div class="panel-header">
      <span>预览</span>
      <div class="panel-actions">
        <Button
          v-if="isJsonFormatted"
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          title="复制格式化JSON HTML"
          @click="$emit('copy-json-html')"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          title="复制渲染内容（带样式，适配哔哩哔哩等平台）"
          @click="$emit('copy-rendered')"
        >
          带样式
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          title="复制为 Unicode 文本表格（适配B站等不支持table标签的平台）"
          @click="$emit('copy-text-table')"
        >
          文本表格
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          title="复制为图片"
          @click="$emit('copy-image')"
        />
      </div>
    </div>
    <div
      v-if="isJsonFormatted"
      class="json-format-badge"
    >
      <span class="json-badge-icon">{ }</span>
      <span>JSON 格式化 · GitHub浅色主题 · 公众号可用</span>
      <Button
        variant="ghost"
        size="xsmall"
        @click="$emit('revert-json')"
      >
        还原
      </Button>
    </div>
    <div class="html-preview-container">
      <iframe
        ref="iframeRef"
        class="html-preview-iframe"
        sandbox="allow-scripts allow-same-origin"
        :srcdoc="previewHtml"
      ></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Button from "@/components/Button.vue"

defineProps<{
  previewHtml: string
  split?: boolean
  isJsonFormatted?: boolean
  i18n?: Record<string, any>
}>()

defineEmits<{
  "copy-json-html": []
  "copy-rendered": []
  "copy-text-table": []
  "copy-image": []
  "revert-json": []
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)

defineExpose({ iframeRef })
</script>
