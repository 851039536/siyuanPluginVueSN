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

type BadgeSize = "xsmall" | "small" | "medium" | "large"
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
  size: "small",
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
@use './styles/Badge.scss';
</style>
