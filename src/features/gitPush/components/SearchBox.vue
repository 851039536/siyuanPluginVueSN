<!-- gitPush 搜索框子组件 -->
<template>
  <div class="gp-search-wrap">
    <Icon
      icon="mdi:magnify"
      class="gp-search-icon"
      height="12"
    />
    <input
      :value="modelValue"
      class="gp-search-input"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      class="gp-search-clear"
      @click="$emit('update:modelValue', '')"
    >
      <Icon
        icon="mdi:close"
        height="12"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"

defineProps<{
  modelValue: string
  placeholder: string
}>()

defineEmits<{
  "update:modelValue": [value: string]
}>()
</script>

<style lang="scss">
@use "../styles/SearchBox.scss";
</style>
