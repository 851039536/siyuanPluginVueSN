<!-- Markdown 编辑器组件 - 纯文本输入框 -->
<template>
  <div class="md-editor">
    <div class="md-editor-header">
      <span class="md-editor-label">Markdown</span>
      <span class="md-editor-hint">支持标准 Markdown 语法</span>
    </div>
    <textarea
      class="md-editor-textarea"
      :value="modelValue"
      :placeholder="placeholder"
      spellcheck="false"
      @input="handleInput"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  placeholder?: string
}

interface Emits {
  (e: "update:modelValue", value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "在此输入或粘贴 Markdown...",
})

const emit = defineEmits<Emits>()

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit("update:modelValue", target.value)
}
</script>

<style lang="scss" scoped>
@use "../../styles/MarkdownEditor.scss";
</style>
