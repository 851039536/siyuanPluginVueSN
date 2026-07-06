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

type TagSize = "xsmall" | "small" | "medium" | "large"
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
  size: "small",
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
@use './styles/Tag.scss';
</style>
