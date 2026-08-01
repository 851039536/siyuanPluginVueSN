<!-- gitPush 搜索框子组件 -->
<template>
  <div class="gp-search-wrap">
    <Input
      :model-value="modelValue"
      size="xsmall"
      :placeholder="placeholder"
      prefix-icon="search"
      clearable
      autocomplete="off"
      @update:model-value="$emit('update:modelValue', String($event ?? ''))"
    />
  </div>
</template>

<script setup lang="ts">
import Input from "@/components/Input.vue"

defineProps<{
  modelValue: string
  placeholder: string
}>()

defineEmits<{
  "update:modelValue": [value: string]
}>()
</script>
