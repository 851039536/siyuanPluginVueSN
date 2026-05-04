<template>
  <div :class="badgeClasses">
    <slot />
    <span
      v-if="(dot || content !== undefined) && !hidden"
      :class="contentClasses"
      :style="contentStyle"
    >
      <span
        v-if="!dot"
        class="si-badge__inner"
      >{{ displayContent }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

type BadgeSize = "small" | "medium" | "large"
type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
type BadgePosition = "top-right" | "top-left" | "bottom-right" | "bottom-left"

interface Props {
  /** 徽标内容 */
  content?: string | number
  /** 是否显示为圆点 */
  dot?: boolean
  /** 徽标尺寸 */
  size?: BadgeSize
  /** 徽标变体 */
  variant?: BadgeVariant
  /** 徽标位置 */
  position?: BadgePosition
  /** 是否隐藏徽标 */
  hidden?: boolean
  /** 最大数值（超过显示 max+） */
  max?: number
  /** 是否显示零值 */
  showZero?: boolean
  /** 自定义颜色 */
  color?: string
  /** 徽标偏移量（像素） */
  offset?: [number, number]
}

const props = withDefaults(defineProps<Props>(), {
  dot: false,
  size: "medium",
  variant: "danger",
  position: "top-right",
  hidden: false,
  max: 99,
  showZero: false,
})

const badgeClasses = computed(() => [
  "si-badge",
  `si-badge--${props.size}`,
  `si-badge--${props.position}`,
])

const contentClasses = computed(() => [
  "si-badge__content",
  `si-badge__content--${props.variant}`,
  `si-badge__content--${props.size}`,
  {
    "si-badge__content--dot": props.dot,
    "si-badge__content--custom-color": !!props.color,
  },
])

const contentStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.color) {
    style.backgroundColor = props.color
  }

  if (props.offset) {
    const [x, y] = props.offset
    const positionMap: Record<BadgePosition, { x: string, y: string }> = {
      "top-right": {
        x: "right",
        y: "top",
      },
      "top-left": {
        x: "left",
        y: "top",
      },
      "bottom-right": {
        x: "right",
        y: "bottom",
      },
      "bottom-left": {
        x: "left",
        y: "bottom",
      },
    }
    const pos = positionMap[props.position]
    style[pos.x] = `${-x}px`
    style[pos.y] = `${-y}px`
  }

  return style
})

const displayContent = computed(() => {
  if (props.dot) return ""
  if (typeof props.content === "number") {
    return props.content > props.max ? `${props.max}+` : props.content
  }
  return props.content
})
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-badge {
  display: inline-flex;
  position: relative;
  vertical-align: middle;

  &__content {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(0, 0);
    white-space: nowrap;
    font-family: $font-body;
    font-weight: 500;
    z-index: 10;

    // 尺寸变体
    &--small {
      height: 16px;
      padding: 0 5px;
      font-size: 10px;
      line-height: 1;
      min-width: 16px;
    }

    &--medium {
      height: 20px;
      padding: 0 6px;
      font-size: 11px;
      line-height: 1;
      min-width: 20px;
    }

    &--large {
      height: 24px;
      padding: 0 8px;
      font-size: 12px;
      line-height: 1;
      min-width: 24px;
    }

    // 圆点样式
    &--dot {
      width: 8px;
      height: 8px;
      min-width: 8px;
      padding: 0;
      border-radius: $radius-full;
    }

    // 默认样式（非圆点）
    &:not(.si-badge__content--dot) {
      border-radius: $radius-full;
      box-shadow: 0 0 0 1px var(--b3-theme-background, $brand-light);
    }

    // 颜色变体
    &--default {
      background: var(--b3-theme-on-surface, $brand-dark);
      color: var(--b3-theme-background, $brand-light);
    }

    &--primary {
      background: var(--b3-theme-primary, $brand-orange);
      color: var(--b3-theme-on-primary, $brand-light);
    }

    &--success {
      background: var(--b3-theme-success, $brand-success);
      color: white;
    }

    &--warning {
      background: var(--b3-theme-warning, $brand-warning);
      color: white;
    }

    &--danger {
      background: var(--b3-theme-destructive, $brand-destructive);
      color: white;
    }

    &--info {
      background: var(--b3-theme-info, $brand-info);
      color: white;
    }

    // 自定义颜色
    &--custom-color {
      color: white;
    }

    // 位置变体
    .si-badge--top-right & {
      top: 0;
      right: 0;
      transform: translate(50%, -50%);
    }

    .si-badge--top-left & {
      top: 0;
      left: 0;
      transform: translate(-50%, -50%);
    }

    .si-badge--bottom-right & {
      bottom: 0;
      right: 0;
      transform: translate(50%, 50%);
    }

    .si-badge--bottom-left & {
      bottom: 0;
      left: 0;
      transform: translate(-50%, 50%);
    }

    // 内部文本
    &__inner {
      display: block;
    }
  }
}
</style>
