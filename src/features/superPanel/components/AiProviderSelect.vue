<template>
  <select :value="modelValue" class="setting-select" @change="handleChange">
    <option value="tongyi">{{ i18n.tongyiQianwen || '通义千问' }}</option>
    <option value="openai">{{ i18n.openAI || 'OpenAI' }}</option>
    <option value="deepseek">{{ i18n.deepSeek || 'DeepSeek' }}</option>
    <option value="custom">{{ i18n.customApi || '自定义API' }}</option>
  </select>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  i18n: {
    tongyiQianwen?: string
    openAI?: string
    deepSeek?: string
    customApi?: string
    [key: string]: any
  }
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as *;

.setting-select {
  padding: $spacing-sm $spacing-md;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  font-size: 13px;
  transition: all $transition-fast ease;
  width: 100%;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667' d='M6 9L2 5h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right $spacing-md center;
  padding-right: 36px;

  &:hover {
    border-color: var(--b3-theme-primary-lighter);
  }

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
}
</style>
