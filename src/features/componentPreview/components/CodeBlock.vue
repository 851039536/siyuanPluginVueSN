<!-- 组件预览 — 代码块：等宽字体展示 + 复制按钮（已复制反馈） -->
<template>
  <div class="cp-codeblock">
    <pre class="cp-codeblock__pre"><code>{{ code }}</code></pre>
    <!-- 复制 / 已复制：纯图标走共享 Button（icon-only 必须给 ariaLabel，成功态由 severity 表达） -->
    <Button
      class="cp-codeblock__copy"
      size="xsmall"
      variant="ghost"
      text
      :severity="copied ? 'success' : undefined"
      :icon="copied ? 'check' : 'copy'"
      :ariaLabel="copied ? i18n.copied : i18n.copyCode"
      :title="copied ? i18n.copied : i18n.copyCode"
      @click="handleCopy"
    />
    <!-- 复制结果播报：视觉隐藏，仅供屏幕阅读器感知状态变化 -->
    <span
      class="cp-sr-only"
      aria-live="polite"
    >{{ copied ? i18n.copied : "" }}</span>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import { copyToClipboard } from "@/utils/domUtils"
import type { I18n } from "../types"

interface Props {
  code: string
  i18n: I18n
}

const props = defineProps<Props>()

const copied = ref(false)

const handleCopy = async () => {
  if (copied.value) return
  const ok = await copyToClipboard(props.code)
  if (ok) {
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  }
}
</script>

<style lang="scss">
@use '../styles/CodeBlock.scss';
@use '../styles/index.scss';
</style>
