<!-- 颜色字段：颜色拾取器 + 文本输入框双向联动，供代码块设置等复用 -->
<template>
  <div class="color-field">
    <input
      :value="modelValue"
      type="color"
      class="color-picker"
      @input="onChange"
    />
    <input
      :value="modelValue"
      type="text"
      class="color-input"
      :placeholder="placeholder"
      @input="onChange"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  placeholder?: string
}

defineProps<Props>()

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>()

function onChange(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value)
}
</script>

<style scoped lang="scss">
@use "../styles/ColorField.scss";
</style>
