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
.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.setting-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  line-height: 1.4;
}
</style>
