<template>
  <label
    v-if="label || $slots.label"
    :id="labelId"
    class="si-form-field__label"
    :class="{ [`si-form-field__label--${size}`]: size }"
  >
    <slot name="label">{{ label }}</slot>
    <span
      v-if="required"
      class="si-form-field__required"
    >*</span>
    <slot name="label-extra" />
  </label>
  <slot />
  <div
    v-if="hint || error"
    class="si-form-field__hint"
    :class="{ 'si-form-field__hint--error': error }"
  >
    {{ error || hint }}
  </div>
  <div
    v-if="showCount && countMax"
    class="si-form-field__count"
  >
    {{ countCurrent }} / {{ countMax }}
  </div>
  <div
    v-else-if="showCount && showCountWithoutMax"
    class="si-form-field__count"
  >
    {{ countCurrent }}
  </div>
</template>

<script setup lang="ts">
type FormFieldSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  label?: string
  /** 标签元素 id，供控件用 aria-labelledby 建立无障碍关联（不传时输出不变） */
  labelId?: string
  required?: boolean
  hint?: string
  error?: string
  size?: FormFieldSize
  showCount?: boolean
  showCountWithoutMax?: boolean
  countCurrent?: number
  countMax?: number
}

withDefaults(defineProps<Props>(), {
  required: false,
  showCount: false,
  showCountWithoutMax: false,
  countCurrent: 0,
})
</script>

<style scoped lang="scss">
@use './styles/FormField.scss';
</style>
