<template>
  <div
    :class="avatarClasses"
    :style="avatarStyle"
    @click="handleClick"
  >
    <img
      v-if="src && !hasError"
      :src="src"
      :alt="alt"
      class="si-avatar__image"
      @error="handleImageError"
    />
    <span
      v-else-if="text"
      class="si-avatar__text"
    >{{ displayText }}</span>
    <IconWrapper
      v-else-if="icon"
      :name="icon"
      :size="iconSize"
      class="si-avatar__icon"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

type AvatarSize = "xsmall" | "small" | "medium" | "large" | "xlarge"
type AvatarShape = "circle" | "square"

interface Props {
  /** 图片源 */
  src?: string
  /** 替代文本 */
  alt?: string
  /** 显示文本（优先级高于 icon） */
  text?: string
  /** 图标名称 */
  icon?: IconKey
  /** 头像尺寸 */
  size?: AvatarSize
  /** 头像形状 */
  shape?: AvatarShape
  /** 背景颜色 */
  color?: string
  /** 文本颜色 */
  textColor?: string
  /** 自定义尺寸（像素） */
  customSize?: number
  /** 是否可点击 */
  clickable?: boolean
  /** 激活状态 */
  active?: boolean
  /** 禁用状态 */
  disabled?: boolean
  /** 文本最大长度（默认：2） */
  maxTextLength?: number
}

type Emits = (e: "click", event: MouseEvent) => void

const props = withDefaults(defineProps<Props>(), {
  alt: "Avatar",
  size: "medium",
  shape: "circle",
  maxTextLength: 2,
  clickable: false,
  active: false,
  disabled: false,
})

const emit = defineEmits<Emits>()

const hasError = ref(false)

const avatarClasses = computed(() => [
  "si-avatar",
  `si-avatar--${props.size}`,
  `si-avatar--${props.shape}`,
  {
    "si-avatar--clickable": props.clickable && !props.disabled,
    "si-avatar--active": props.active,
    "si-avatar--disabled": props.disabled,
  },
])

const avatarStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.customSize) {
    style.width = `${props.customSize}px`
    style.height = `${props.customSize}px`
    style.fontSize = `${props.customSize * 0.4}px`
  }

  if (props.color && !props.src) {
    style.backgroundColor = props.color
  }

  if (props.textColor) {
    style.color = props.textColor
  }

  return style
})

const iconSize = computed(() => {
  const sizeMap: Record<AvatarSize, number> = {
    xsmall: 12,
    small: 16,
    medium: 20,
    large: 24,
    xlarge: 28,
  }
  return sizeMap[props.size]
})

const displayText = computed(() => {
  if (!props.text) return ""
  const text = props.text.trim()
  if (text.length <= props.maxTextLength) {
    return text
  }
  return text.slice(-props.maxTextLength).toUpperCase()
})

const handleImageError = () => {
  hasError.value = true
}

const handleClick = (event: MouseEvent) => {
  if (props.clickable && !props.disabled) {
    emit("click", event)
  }
}
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--b3-theme-surface-lighter, $brand-light-gray);
  color: var(--b3-theme-on-surface, $brand-dark);
  font-family: $font-body;
  font-weight: 500;
  user-select: none;

  // 尺寸变体
  &--xsmall {
    width: 24px;
    height: 24px;
    font-size: 10px;
  }

  &--small {
    width: 32px;
    height: 32px;
    font-size: $font-size-xs;
  }

  &--medium {
    width: 40px;
    height: 40px;
    font-size: $font-size-sm;
  }

  &--large {
    width: 48px;
    height: 48px;
    font-size: $font-size-base;
  }

  &--xlarge {
    width: 64px;
    height: 64px;
    font-size: $font-size-xl;
  }

  // 形状变体
  &--circle {
    border-radius: $radius-full;
  }

  &--square {
    border-radius: $radius-md;
  }

  // 交互状态
  &--clickable {
    cursor: pointer;

    &:hover:not(.si-avatar--disabled) {
      transform: scale(1.05);
      box-shadow: $shadow-md;
    }

    &:active:not(.si-avatar--disabled) {
      transform: scale(0.98);
    }
  }

  &--active {
    box-shadow: 0 0 0 2px var(--b3-theme-primary, $brand-orange);
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  // 图片
  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  // 文本
  &__text {
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
  }

  // 图标
  &__icon {
    flex-shrink: 0;
  }
}
</style>
