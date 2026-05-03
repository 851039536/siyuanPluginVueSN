<template>
  <component :is="tag" :class="labelClasses" :for="forAttr" :style="labelStyle">
    <IconWrapper v-if="icon && iconPosition === 'left'" :name="icon" :size="iconSize" class="si-label__icon" />
    <span v-if="$slots.default" class="si-label__text">
      <slot />
    </span>
    <IconWrapper v-if="icon && iconPosition === 'right'" :name="icon" :size="iconSize" class="si-label__icon" />
    <span v-if="required" class="si-label__required">*</span>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import IconWrapper from "@/components/IconWrapper.vue";
import type { IconKey } from "@/config/icons";

type LabelSize = "small" | "medium" | "large";
type LabelVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";
type LabelState = "default" | "error" | "success" | "warning";

interface Props {
  /** 是否必填 */
  required?: boolean;
  /** 标签尺寸 */
  size?: LabelSize;
  /** 标签变体（用于独立展示） */
  variant?: LabelVariant;
  /** 状态 */
  state?: LabelState;
  /** 图标名称 */
  icon?: IconKey;
  /** 图标大小 */
  iconSize?: number;
  /** 图标位置 */
  iconPosition?: "left" | "right";
  /** HTML 标签类型 */
  tag?: "label" | "span" | "div";
  /** 关联的表单元素 id（仅当 tag="label" 时有效） */
  for?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义宽度 */
  width?: string | number;
  /** 文本对齐 */
  align?: "left" | "center" | "right";
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  size: "medium",
  variant: "default",
  state: "default",
  iconPosition: "left",
  tag: "label",
  disabled: false,
  align: "left",
});

const labelClasses = computed(() => [
  "si-label",
  `si-label--${props.size}`,
  `si-label--${props.state}`,
  `si-label--align-${props.align}`,
  {
    "si-label--required": props.required,
    "si-label--disabled": props.disabled,
    "si-label--has-icon": !!props.icon,
    "si-label--inline": props.tag !== "label",
  },
]);

const labelStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.width) {
    style.width =
      typeof props.width === "number" ? `${props.width}px` : props.width;
  }
  return style;
});

const forAttr = computed(() => (props.tag === "label" ? props.for : undefined));
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: $font-body;
  font-weight: 500;
  line-height: 1.5;
  user-select: none;
  white-space: nowrap;

  // 尺寸变体
  &--small {
    font-size: $font-size-xs;
  }

  &--medium {
    font-size: $font-size-sm;
  }

  &--large {
    font-size: $font-size-base;
  }

  // 状态变体
  &--default {
    color: var(--b3-theme-on-background, $brand-dark);
  }

  &--error {
    color: var(--b3-theme-destructive, $brand-destructive);
  }

  &--success {
    color: var(--b3-theme-success, $brand-success);
  }

  &--warning {
    color: var(--b3-theme-warning, $brand-warning);
  }

  // 禁用状态
  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // 必填标记
  &__required {
    color: var(--b3-theme-destructive, $brand-destructive);
    margin-left: 2px;
    font-weight: 600;
  }

  // 文本
  &__text {
    flex: 1;
  }

  // 图标
  &__icon {
    flex-shrink: 0;
  }

  // 对齐方式
  &--align-left {
    justify-content: flex-start;
  }

  &--align-center {
    justify-content: center;
  }

  &--align-right {
    justify-content: flex-end;
  }

  // 内联模式（非 label 标签）
  &--inline {
    display: inline-flex;
    padding: 4px 10px;
    border-radius: $radius-md;
    background: var(--b3-theme-surface-lighter, $brand-light-gray);

    &.si-label--primary {
      background: var(--b3-theme-primary, $brand-orange);
      color: var(--b3-theme-on-primary, $brand-light);
    }

    &.si-label--success {
      background: var(--b3-theme-success, $brand-success);
      color: white;
    }

    &.si-label--warning {
      background: var(--b3-theme-warning, $brand-warning);
      color: white;
    }

    &.si-label--danger {
      background: var(--b3-theme-destructive, $brand-destructive);
      color: white;
    }

    &.si-label--info {
      background: var(--b3-theme-info, $brand-info);
      color: white;
    }
  }
}

// 独立 Label 样式（用于表单标签）
.si-label:not(.si-label--inline) {
  display: inline-flex;
  margin-bottom: 4px;
}
</style>
