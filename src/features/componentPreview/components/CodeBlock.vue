<!-- 组件预览 — 代码块：等宽字体展示 + 复制按钮（已复制反馈） -->
<template>
  <div class="cp-codeblock">
    <pre class="cp-codeblock__pre"><code>{{ code }}</code></pre>
    <button
      class="cp-codeblock__copy"
      :class="{ 'cp-codeblock__copy--copied': copied }"
      type="button"
      :title="copied ? i18n.copied : i18n.copyCode"
      @click="handleCopy"
    >
      <!-- 复制 / 已复制图标反馈 -->
      <IconWrapper
        :name="copied ? 'check' : 'copy'"
        :size="13"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
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
