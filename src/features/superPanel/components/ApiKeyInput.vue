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
      size="xsmall"
      :icon="visible ? 'eyeOff' : 'eye'"
      :icon-size="14"
      :title="visible ? (i18n.hideApiKey || '隐藏密钥') : (i18n.showApiKey || '显示密钥')"
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
import { PROVIDER_MAP } from "./providers"
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
  // 供应商专属占位 → 通用占位 → 中文兜底
  return i18nPlaceholder
    || props.i18n.apiKeyPlaceholder
    || "请输入API密钥"
}

const getDescription = () => {
  return props.i18n.apiKeyDesc || "API密钥，用于所有AI功能"
}

const handleInput = (value: string) => {
  emit("update:modelValue", value)
}
</script>
