<template>
  <button
    ref="buttonRef"
    type="button"
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span
      v-if="loading"
      class="si-button__spinner"
    ></span>
    <IconWrapper
      v-if="icon && !loading"
      :name="icon"
      :size="iconSize"
      class="si-button__icon"
    />
    <span
      v-if="$slots.default"
      class="si-button__text"
    >
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
  useSlots,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost"
type ButtonSize = "small" | "medium" | "large"

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
  iconPosition?: "left" | "right"
  /** 是否为块级按钮 */
  block?: boolean
}

type Emits = (e: "click", event: MouseEvent) => void

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "medium",
  iconSize: 16,
  iconPosition: "left",
  disabled: false,
  loading: false,
  block: false,
})

const emit = defineEmits<Emits>()

const slots = useSlots()
const buttonRef = ref<HTMLButtonElement>()

const buttonClasses = computed(() => [
  "si-button",
  `si-button--${props.variant}`,
  `si-button--${props.size}`,
  {
    "si-button--disabled": props.disabled || props.loading,
    "si-button--loading": props.loading,
    "si-button--icon-only": !slots.default && props.icon,
    "si-button--block": props.block,
    "si-button--icon-right": props.iconPosition === "right",
  },
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit("click", event)
  }
}

defineExpose({
  focus: () => buttonRef.value?.focus(),
  blur: () => buttonRef.value?.blur(),
})
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

// 公共交互反馈 mixin（Codex 风格：使用 border-color + brightness，禁用 box-shadow）
@mixin interactive-raised($border-color: var(--b3-theme-primary)) {
  transition: all 0.12s;

  &:hover:not(.si-button--disabled):not(.si-button--loading) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    border-color: $border-color;
  }

  &:active:not(.si-button--disabled):not(.si-button--loading) {
    filter: brightness(0.95);
    transform: translateY(0);
  }
}

.si-button {
  // 基础样式
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  border: 1px solid transparent;
  border-radius: $vp-radius;
  font-family: $font-body;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  user-select: none;
  position: relative;

  // 尺寸变体
  &--small {
    padding: $spacing-2 $spacing-3;
    font-size: $font-size-xs;
    min-height: 28px;
  }

  &--medium {
    padding: $spacing-2 $spacing-4;
    font-size: $font-size-sm;
    min-height: 36px;
  }

  &--large {
    padding: $spacing-3 $spacing-5;
    font-size: 15px;
    min-height: 44px;
  }

  // 颜色变体
  &--primary {
    background: var(--b3-theme-primary, $brand-orange);
    color: var(--b3-theme-on-primary, $brand-light);
    @include interactive-raised;
  }

  &--secondary {
    background: var(--b3-theme-background, $brand-blue);
    color: var(--b3-theme-on-background, $brand-light);
    border: 1px solid var(--b3-theme-border, rgba(0, 0, 0, 0.1));
    @include interactive-raised;
  }

  &--success {
    background: var(--b3-theme-success, $brand-success);
    color: var(--b3-theme-on-primary, $brand-light);
    @include interactive-raised(var(--b3-theme-success, $brand-success));
  }

  &--danger {
    background: transparent;
    color: var(--b3-theme-error, #ef4444);
    border-color: var(--b3-theme-error, #ef4444);

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
  }

  &__text {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: $spacing-1;
    line-height: 1.4;
  }

  // 加载动画
  &__spinner {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: si-btn-spin 0.6s linear infinite;
  }
}

@keyframes si-btn-spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
</style>
