<template>
  <input
    :type="type"
    class="setting-input"
    :value="modelValue"
    :placeholder="placeholder"
    @input="handleInput"
  />
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
  type?: 'text' | 'password'
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

withDefaults(defineProps<Props>(), {
  type: 'text'
})

const emit = defineEmits<Emits>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped lang="scss">
.setting-input {
  padding: 8px 12px;
  border: 2px solid var(--b3-theme-surface-light);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  outline: none;
  font-size: 13px;
  transition: all 0.2s ease;
  width: 100%;

  &:hover {
    border-color: var(--b3-theme-primary-lighter);
  }

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
}
</style>
