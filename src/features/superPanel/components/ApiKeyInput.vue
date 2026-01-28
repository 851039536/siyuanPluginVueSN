<template>
  <div class="setting-input-wrapper">
    <TextInput
      :model-value="modelValue"
      :type="visible ? 'text' : 'password'"
      :placeholder="getPlaceholder()"
      @update:model-value="handleInput"
    />
    <button
      class="toggle-visibility-btn"
      type="button"
      @click="toggleVisibility"
      :title="visible ? '隐藏密钥' : '显示密钥'"
    >
      <IconWrapper :name="visible ? 'eyeOff' : 'eye'" :size="14" />
    </button>
  </div>
  <div class="setting-desc">{{ getDescription() }}</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import TextInput from './TextInput.vue'

interface Props {
  provider: string
  modelValue: string
  i18n: {
    tongyiQianwen?: string
    openAI?: string
    deepSeek?: string
    customApi?: string
    tongyiQianwenPlaceholder?: string
    openAIPlaceholder?: string
    deepSeekPlaceholder?: string
    customApiPlaceholder?: string
    [key: string]: any
  }
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = ref(false)

const toggleVisibility = () => {
  visible.value = !visible.value
}

const getPlaceholder = () => {
  const i18nPlaceholders: Record<string, string | undefined> = {
    tongyi: props.i18n.tongyiQianwenPlaceholder,
    openai: props.i18n.openAIPlaceholder,
    deepseek: props.i18n.deepSeekPlaceholder,
    custom: props.i18n.customApiPlaceholder
  }

  return (
    i18nPlaceholders[props.provider] ||
    `请输入${props.provider === 'tongyi' ? '通义千问' : props.provider === 'openai' ? 'OpenAI' : props.provider === 'deepseek' ? 'DeepSeek' : '自定义API'}API密钥`
  )
}

const getDescription = () => {
  const providerNames: Record<string, string> = {
    tongyi: props.i18n.tongyiQianwen || '通义千问',
    openai: props.i18n.openAI || 'OpenAI',
    deepseek: props.i18n.deepSeek || 'DeepSeek',
    custom: props.i18n.customApi || '自定义API'
  }

  return `${providerNames[props.provider]} API密钥，用于所有AI功能`
}

const handleInput = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as *;

.setting-input-wrapper {
  display: flex;
  align-items: center;
  position: relative;

  .setting-input {
    flex: 1;
    border-radius: 6px 0 0 6px;
    border-right: none;

    &:focus {
      z-index: 1;
    }
  }
}

.toggle-visibility-btn {
  @include button-reset;
  padding: $spacing-sm $spacing-md;
  background: var(--b3-theme-surface);
  border: 2px solid var(--b3-theme-surface-light);
  border-left: none;
  border-radius: 0 6px 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface);
  height: 100%;

  &:hover {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
}

.setting-desc {
  margin-top: $spacing-xs;
}
</style>
