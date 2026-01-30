<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="button-spinner"></span>
    <IconWrapper v-if="icon && !loading" :name="icon" :size="iconSize" :class="iconClass" />
    <span v-if="$slots.default" :class="textClass">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import type { IconKey } from '@/config/icons'

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
type ButtonSize = 'small' | 'medium' | 'large'

interface Props {
  /** 按钮变体 */
  variant?: ButtonVariant
  /** 按钮尺寸 */
  size?: ButtonSize
  /** 图标名称 */
  icon?: IconKey
  /** 图标大小 */
  iconSize?: number
  /** 禁用状态 */
  disabled?: boolean
  /** 加载状态 */
  loading?: boolean
  /** 图标位置 */
  iconPosition?: 'left' | 'right'
  /** 是否为块级按钮 */
  block?: boolean
}

interface Emits {
  (e: 'click', event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  iconSize: 16,
  iconPosition: 'left',
  disabled: false,
  loading: false,
  block: false
})

const emit = defineEmits<Emits>()

const slots = useSlots()

const buttonClasses = computed(() => [
  'si-button',
  `si-button--${props.variant}`,
  `si-button--${props.size}`,
  {
    'si-button--disabled': props.disabled || props.loading,
    'si-button--loading': props.loading,
    'si-button--icon-only': !slots.default && props.icon,
    'si-button--block': props.block,
    'si-button--icon-right': props.iconPosition === 'right'
  }
])

const iconClass = computed(() => ({
  'si-button__icon': true,
  'si-button__icon--left': props.iconPosition === 'left',
  'si-button__icon--right': props.iconPosition === 'right'
}))

const textClass = computed(() => ({
  'si-button__text': true
}))

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-button {
  // 基础样式
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: $font-body;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  white-space: nowrap;
  user-select: none;
  position: relative;

  // 尺寸变体
  &--small {
    padding: 6px 12px;
    font-size: 13px;
    min-height: 28px;
  }

  &--medium {
    padding: 8px 16px;
    font-size: 14px;
    min-height: 36px;
  }

  &--large {
    padding: 10px 20px;
    font-size: 15px;
    min-height: 44px;
  }

  // 颜色变体
  &--primary {
    background: var(--b3-theme-primary, $brand-orange);
    color: var(--b3-theme-on-primary, $brand-light);

    &:hover:not(.si-button--disabled):not(.si-button--loading) {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    &:active:not(.si-button--disabled):not(.si-button--loading) {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
  }

  &--secondary {
    background: var(--b3-theme-background, $brand-blue);
    color: var(--b3-theme-on-background, $brand-light);
    border: 1px solid var(--b3-theme-border, rgba(0, 0, 0, 0.1));

    &:hover:not(.si-button--disabled):not(.si-button--loading) {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    &:active:not(.si-button--disabled):not(.si-button--loading) {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
  }

  &--success {
    background: #10b981;
    color: white;

    &:hover:not(.si-button--disabled):not(.si-button--loading) {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    &:active:not(.si-button--disabled):not(.si-button--loading) {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
    }
  }

  &--danger {
    background: transparent;
    color: #ef4444;
    border-color: #ef4444;

    &:hover:not(.si-button--disabled):not(.si-button--loading) {
      background: rgba(239, 68, 68, 0.1);
      border-color: #dc2626;
    }

    &:active:not(.si-button--disabled):not(.si-button--loading) {
      background: rgba(239, 68, 68, 0.15);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--b3-theme-on-surface, $brand-dark);
    border-color: var(--b3-theme-surface-lighter, $brand-subtle-gray);

    &:hover:not(.si-button--disabled):not(.si-button--loading) {
      background: var(--b3-theme-surface-lighter, rgba(0, 0, 0, 0.05));
      border-color: var(--b3-theme-on-surface-variant, $brand-mid-gray);
    }

    &:active:not(.si-button--disabled):not(.si-button--loading) {
      background: rgba(0, 0, 0, 0.08);
    }
  }

  // 禁用状态
  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  // 加载状态
  &--loading {
    cursor: wait;
    pointer-events: none;

    .si-button__text,
    .si-button__icon {
      opacity: 0.7;
    }
  }

  // 仅图标按钮
  &--icon-only {
    padding: 0;
    width: var(--button-size, 36px);
    height: var(--button-size, 36px);

    &.si-button--small {
      --button-size: 28px;
    }

    &.si-button--medium {
      --button-size: 36px;
    }

    &.si-button--large {
      --button-size: 44px;
    }
  }

  // 块级按钮
  &--block {
    display: flex;
    width: 100%;
  }

  // 图标右侧
  &--icon-right {
    flex-direction: row-reverse;
  }

  // 内部元素样式
  &__icon {
    flex-shrink: 0;

    &--left {
      // margin-right: 4px;
    }

    &--right {
      // margin-left: 4px;
    }
  }

  &__text {
    flex: 1;
    line-height: 1.4;
  }

  // 加载动画
  .button-spinner {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
</style>
