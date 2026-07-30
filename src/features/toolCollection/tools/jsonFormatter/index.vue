<!-- JSON 格式化工具 — 输入区 + 格式化/压缩/校验 + 输出区 -->
<template>
  <div class="json-formatter">
    <!-- 工具栏 -->
    <div class="jf-toolbar">
      <!-- 格式化按钮 -->
      <button
        class="jf-btn primary"
        @click="handleFormat"
      >
        {{ i18n.jsonFormatter?.format }}
      </button>
      <!-- 压缩按钮 -->
      <button
        class="jf-btn"
        @click="handleMinify"
      >
        {{ i18n.jsonFormatter?.minify }}
      </button>
      <!-- 校验按钮 -->
      <button
        class="jf-btn"
        @click="handleValidate"
      >
        {{ i18n.jsonFormatter?.validate }}
      </button>
      <!-- 复制结果按钮 -->
      <button
        class="jf-btn"
        :disabled="!output"
        @click="handleCopy"
      >
        {{ i18n.jsonFormatter?.copyResult }}
      </button>
      <!-- 清空按钮 -->
      <button
        class="jf-btn"
        @click="handleClear"
      >
        {{ i18n.jsonFormatter?.clear }}
      </button>
      <!-- 缩进选择 -->
      <select
        v-model="indent"
        class="jf-indent-select"
      >
        <option :value="2">2 spaces</option>
        <option :value="4">4 spaces</option>
        <option :value="8">tab</option>
      </select>
      <!-- 状态提示 -->
      <span
        class="jf-status"
        :class="statusType"
      >{{ statusText }}</span>
    </div>

    <!-- 输入/输出面板 -->
    <div class="jf-panels">
      <!-- 输入区 -->
      <div class="jf-panel">
        <!-- 输入标签 -->
        <span class="jf-panel-label">{{ i18n.jsonFormatter?.input }}</span>
        <textarea
          v-model="inputText"
          :placeholder="i18n.jsonFormatter?.inputPlaceholder"
          spellcheck="false"
        />
      </div>
      <!-- 输出区 -->
      <div class="jf-panel">
        <!-- 输出标签 -->
        <span class="jf-panel-label">{{ i18n.jsonFormatter?.output }}</span>
        <pre class="jf-output">{{ output }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * JSON 格式化工具 - 主组件
 * 支持格式化、压缩、校验 JSON 文本
 */
import type { Plugin } from "siyuan"
import { ref } from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import {
  formatJson,
  minifyJson,
  validateJson,
} from "./utils/format"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const inputText = ref("")
const output = ref("")
const indent = ref(2)
const statusText = ref("")
const statusType = ref<"success" | "error" | "">("")

const handleFormat = () => {
  const result = formatJson(inputText.value, indent.value)
  applyResult(result)
}

const handleMinify = () => {
  const result = minifyJson(inputText.value)
  applyResult(result)
}

const handleValidate = () => {
  const result = validateJson(inputText.value)
  if (result.success) {
    statusText.value = props.i18n.jsonFormatter?.validMsg ?? "✓ Valid JSON"
    statusType.value = "success"
    output.value = ""
  } else {
    statusText.value = result.error ?? "Invalid"
    statusType.value = "error"
    output.value = ""
  }
}

const handleCopy = () => {
  if (output.value) copyToClipboard(output.value)
}

const handleClear = () => {
  inputText.value = ""
  output.value = ""
  statusText.value = ""
  statusType.value = ""
}

function applyResult(result: { success: boolean; output: string; error?: string }) {
  if (result.success) {
    output.value = result.output
    statusText.value = props.i18n.jsonFormatter?.successMsg ?? "✓ Done"
    statusType.value = "success"
  } else {
    output.value = ""
    statusText.value = result.error ?? "Error"
    statusType.value = "error"
  }
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
