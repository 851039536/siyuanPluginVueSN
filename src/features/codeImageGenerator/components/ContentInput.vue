<template>
  <div class="input-section">
    <label class="section-label">
      {{ contentType === 'code' ? codeLabel : textLabel }}
    </label>
    <Input
      type="textarea"
      :model-value="modelValue"
      :placeholder="contentType === 'code' ? codePlaceholder : textPlaceholder"
      :rows="10"
      :spellcheck="false"
      @update:model-value="onInputChange"
    />
  </div>
</template>

<script setup lang="ts">
import Input from "@/components/Input.vue"

interface Props {
  modelValue: string
  contentType: "code" | "text"
  codeLabel: string
  textLabel: string
  codePlaceholder: string
  textPlaceholder: string
}

defineProps<Props>()
const emit = defineEmits<{
  "update:modelValue": [value: string]
}>()

const onInputChange = (value: string | null) => {
  emit("update:modelValue", value ?? "")
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
