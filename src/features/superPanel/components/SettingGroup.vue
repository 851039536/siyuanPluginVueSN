<template>
  <div class="setting-group">
    <label v-if="label || $slots.label" class="setting-label">
      <slot name="label">{{ label }}</slot>
    </label>
    <slot />
    <div v-if="description || $slots.description" class="setting-desc">
      <slot name="description">{{ description }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  description?: string
}

withDefaults(defineProps<Props>(), {})
</script>

<style scoped lang="scss">
@use '../styles/index.scss';
</style>
