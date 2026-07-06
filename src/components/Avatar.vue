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
  size: "small",
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
@use './styles/Avatar.scss';
</style>
