<!-- gitPush 搜索框子组件 -->
<template>
  <Input
    :model-value="modelValue"
    size="small"
    :placeholder="placeholder"
    :prefix-icon="searchIcon"
    clearable
    autocomplete="off"
    @update:model-value="$emit('update:modelValue', String($event ?? ''))"
  />
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import Input from "@/components/Input.vue"

defineProps<{
  modelValue: string
  placeholder: string
}>()

defineEmits<{
  "update:modelValue": [value: string]
}>()

const searchIcon: IconKey = "mdi:magnify" as IconKey
</script>
