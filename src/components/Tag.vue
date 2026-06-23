<template>
  <div
    :class="tagClasses"
    :style="tagStyle"
  >
    <IconWrapper
      v-if="icon"
      :name="icon"
      :size="iconSize"
      class="si-tag__icon"
    />
    <span
      v-if="$slots.default"
      class="si-tag__content"
    >
      <slot />
    </span>
    <button
      v-if="closable"
      type="button"
      class="si-tag__close"
      @click="handleClose"
    >
      <IconWrapper
        name="close"
        :size="closeIconSize"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

type TagSize = "small" | "medium" | "large"
type TagVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
type TagShape = "rounded" | "square" | "circle"

interface Props {
  /** 标签尺寸 */
  size?: TagSize
  /** 标签变体 */
  variant?: TagVariant
  /** 标签形状 */
  shape?: TagShape
  /** 图标名称 */
  icon?: IconKey
  /** 图标大小 */
  iconSize?: number
  /** 是否可关闭 */
  closable?: boolean
  /** 关闭按钮图标大小 */
  closeIconSize?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义背景色 */
  color?: string
  /** 自定义文本色 */
  textColor?: string
  /** 自定义边框色 */
  borderColor?: string
}

interface Emits {
  (e: "close"): void
  (e: "click", event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  size: "medium",
  variant: "default",
  shape: "rounded",
  iconSize: 12,
  closeIconSize: 10,
  closable: false,
  disabled: false,
})

const emit = defineEmits<Emits>()

const tagClasses = computed(() => [
  "si-tag",
  `si-tag--${props.size}`,
  `si-tag--${props.variant}`,
  `si-tag--${props.shape}`,
  {
    "si-tag--closable": props.closable,
    "si-tag--disabled": props.disabled,
    "si-tag--has-icon": !!props.icon,
    "si-tag--custom-color": !!props.color,
  },
])

const tagStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.color) {
    style.backgroundColor = props.color
  }

  if (props.textColor) {
    style.color = props.textColor
  }

  if (props.borderColor) {
    style.borderColor = props.borderColor
  }

  return style
})

const handleClose = (event: MouseEvent) => {
  event.stopPropagation()
  if (!props.disabled) {
    emit("close")
  }
}
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: $spacing-1 10px;
  border: 1px solid transparent;
  font-family: $font-body;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
  user-select: none;
  cursor: default;

  // 尺寸变体
  &--small {
    font-size: $font-size-xs;
    padding: 2px $spacing-2;
  }

  &--medium {
    font-size: $font-size-sm;
    padding: $spacing-1 10px;
  }

  &--large {
    font-size: $font-size-base;
    padding: 6px 14px;
  }

  // 形状变体
  &--rounded {
    border-radius: $radius-md;
  }

  &--square {
    border-radius: $radius-sm;
  }

  &--circle {
    border-radius: $radius-full;
  }

  // 变体样式
  &--default {
    background: var(--b3-theme-surface-lighter, $brand-light-gray);
    color: var(--b3-theme-on-surface, $brand-dark);
    border-color: var(--b3-border-color, $brand-subtle-gray);
  }

  &--primary {
    background: hsla(from var(--b3-theme-primary, $brand-orange) h s l / 0.1);
    color: var(--b3-theme-primary, $brand-orange);
    border-color: hsla(from var(--b3-theme-primary, $brand-orange) h s l / 0.2);
  }

  &--success {
    background: hsla(from var(--b3-theme-success, $brand-success) h s l / 0.1);
    color: var(--b3-theme-success, $brand-success);
    border-color: hsla(from var(--b3-theme-success, $brand-success) h s l / 0.2);
  }

  &--warning {
    background: hsla(from var(--b3-theme-warning, $brand-warning) h s l / 0.1);
    color: var(--b3-theme-warning, $brand-warning);
    border-color: hsla(from var(--b3-theme-warning, $brand-warning) h s l / 0.2);
  }

  &--danger {
    background: hsla(from var(--b3-theme-destructive, $brand-destructive) h s l / 0.1);
    color: var(--b3-theme-destructive, $brand-destructive);
    border-color: hsla(from var(--b3-theme-destructive, $brand-destructive) h s l / 0.2);
  }

  &--info {
    background: hsla(from var(--b3-theme-info, $brand-info) h s l / 0.1);
    color: var(--b3-theme-info, $brand-info);
    border-color: hsla(from var(--b3-theme-info, $brand-info) h s l / 0.2);
  }

  // 自定义颜色
  &--custom-color {
    &.si-tag--closable {
      .si-tag__close {
        color: var(--tag-text-color, inherit);
      }
    }
  }

  // 可关闭
  &--closable {
    padding-right: 6px;
  }

  // 禁用状态
  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // 图标
  &__icon {
    flex-shrink: 0;
  }

  // 内容
  &__content {
    flex: 1;
  }

  // 关闭按钮
  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    margin-left: 2px;
    color: inherit;
    opacity: 0.6;
    border-radius: $radius-sm;

    &:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.05);
    }
  }

  &--disabled &__close {
    cursor: not-allowed;
    pointer-events: none;
  }
}
</style>
