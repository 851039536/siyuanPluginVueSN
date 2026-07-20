<!-- Markdown 编辑器组件 - 纯文本输入框 -->
<template>
  <div class="md-editor">
    <div class="md-editor-header">
      <span class="md-editor-label">Markdown</span>
      <span class="md-editor-hint">支持标准 Markdown 语法</span>
    </div>
    <textarea
      ref="textareaRef"
      class="md-editor-textarea"
      :value="modelValue"
      :placeholder="placeholder"
      spellcheck="false"
      @input="handleInput"
      @scroll="handleScroll"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

interface Props {
  modelValue: string
  placeholder?: string
}

interface Emits {
  (e: "update:modelValue", value: string): void
  (e: "scroll", scrollTop: number): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "在此输入或粘贴 Markdown...",
})

const emit = defineEmits<Emits>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit("update:modelValue", target.value)
}

function handleScroll() {
  const el = textareaRef.value
  if (el) {
    emit("scroll", el.scrollTop)
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/MarkdownEditor.scss";
</style>
