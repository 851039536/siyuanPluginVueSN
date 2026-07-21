<!-- HTML展示 - 源码编辑面板 -->
<template>
  <div
    class="source-panel"
    :class="{ 'split-mode': split }"
  >
    <div class="panel-header">
      <span>源码</span>
      <div class="panel-actions">
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          title="复制源码"
          @click="$emit('copy-source')"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          title="复制渲染内容（带样式，适配公众号等平台）"
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
          icon="edit"
          title="格式化HTML"
          @click="$emit('format-html')"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="regex"
          title="适配手机宽度"
          @click="$emit('normalize-widths')"
        />
        <Button
          variant="ghost"
          size="xsmall"
          :class="{ 'json-btn-active': isJsonFormatted }"
          title="格式化JSON（公众号浅色背景）"
          @click="$emit('format-json')"
        >
          JSON
        </Button>
      </div>
    </div>
    <textarea
      :value="modelValue"
      class="html-source-editor"
      placeholder="在此输入或粘贴HTML代码..."
      spellcheck="false"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

defineProps<{
  modelValue: string
  split?: boolean
  isJsonFormatted?: boolean
  i18n?: Record<string, any>
}>()

defineEmits<{
  "update:modelValue": [value: string]
  "copy-source": []
  "copy-rendered": []
  "copy-text-table": []
  "format-html": []
  "normalize-widths": []
  "format-json": []
}>()
</script>
