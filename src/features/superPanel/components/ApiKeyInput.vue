<template>
  <div class="setting-input-wrapper">
    <TextInput
      :model-value="modelValue"
      :type="visible ? 'text' : 'password'"
      :placeholder="getPlaceholder()"
      @update:model-value="handleInput"
    />
    <Button
      variant="ghost"
      size="small"
      :icon="visible ? 'eyeOff' : 'eye'"
      :icon-size="14"
      :title="visible ? '隐藏密钥' : '显示密钥'"
      @click="toggleVisibility"
    />
  </div>
  <div class="setting-desc">
    {{ getDescription() }}
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Button from "@/components/Button.vue"
import {
  getProviderDisplayName,
  PROVIDER_MAP,
} from "./providers"
import TextInput from "./TextInput.vue"

interface Props {
  provider: string
  modelValue: string
  i18n: Record<string, any>
}

interface Emits {
  (e: "update:modelValue", value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = ref(false)

const toggleVisibility = () => {
  visible.value = !visible.value
}

const getPlaceholder = () => {
  const meta = PROVIDER_MAP[props.provider]
  const i18nPlaceholder = meta ? props.i18n[`${meta.i18nKey}Placeholder`] : undefined
  return i18nPlaceholder
    || `请输入${getProviderDisplayName(props.provider, props.i18n)}API密钥`
}

const getDescription = () => {
  return `${getProviderDisplayName(props.provider, props.i18n)} API密钥，用于所有AI功能`
}

const handleInput = (value: string) => {
  emit("update:modelValue", value)
}
</script>
