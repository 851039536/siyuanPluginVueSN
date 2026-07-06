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
type ButtonSize = "xsmall" | "small" | "medium" | "large"

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
  size: "small",
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
@use './styles/Button.scss';
</style>
