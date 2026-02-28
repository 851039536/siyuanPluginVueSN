<template>
  <div class="input-section">
    <label class="section-label">
      {{ contentType === 'code' ? codeLabel : textLabel }}
    </label>
    <Textarea
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      :placeholder="contentType === 'code' ? codePlaceholder : textPlaceholder"
      :rows="10"
      :spellcheck="false"
    />
  </div>
</template>

<script setup lang="ts">
import Textarea from '@/components/Textarea.vue'

interface Props {
  modelValue: string
  contentType: 'code' | 'text'
  codeLabel: string
  textLabel: string
  codePlaceholder: string
  textPlaceholder: string
}

defineProps<Props>()
defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
