<template>
  <label
    v-if="label || $slots.label"
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
type FormFieldSize = "small" | "medium" | "large"

interface Props {
  label?: string
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
@use '@/variables.scss' as *;

.si-form-field {
  &__label {
    display: flex;
    align-items: center;
    margin-bottom: $spacing-1;
    font-weight: 500;
    color: var(--b3-theme-on-background, $brand-dark);
    font-family: $font-heading;

    &--small {
      font-size: $font-size-xs;
    }

    &--medium {
      font-size: $font-size-sm;
    }

    &--large {
      font-size: $font-size-base;
    }
  }

  &__required {
    color: var(--b3-theme-primary, $brand-orange);
    margin-left: 2px;
  }

  &__hint {
    margin-top: $spacing-1;
    font-size: $font-size-xs;
    color: var(--b3-theme-secondary, $brand-mid-gray);

    &--error {
      color: var(--b3-theme-error, $brand-orange);
    }
  }

  &__count {
    margin-top: $spacing-1;
    font-size: $font-size-xs;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    text-align: right;
  }
}
</style>
