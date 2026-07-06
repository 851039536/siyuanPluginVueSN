<template>
  <component
    :is="tag"
    :class="labelClasses"
    :for="forAttr"
    :style="labelStyle"
  >
    <IconWrapper
      v-if="icon && iconPosition === 'left'"
      :name="icon"
      :size="iconSize"
      class="si-label__icon"
    />
    <span
      v-if="$slots.default"
      class="si-label__text"
    >
      <slot />
    </span>
    <IconWrapper
      v-if="icon && iconPosition === 'right'"
      :name="icon"
      :size="iconSize"
      class="si-label__icon"
    />
    <span
      v-if="required"
      class="si-label__required"
    >*</span>
  </component>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

type LabelSize = "xsmall" | "small" | "medium" | "large"
type LabelVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
type LabelState = "default" | "error" | "success" | "warning"

interface Props {
  /** 是否必填 */
  required?: boolean
  /** 标签尺寸 */
  size?: LabelSize
  /** 标签变体（用于独立展示） */
  variant?: LabelVariant
  /** 状态 */
  state?: LabelState
  /** 图标名称 */
  icon?: IconKey
  /** 图标大小 */
  iconSize?: number
  /** 图标位置 */
  iconPosition?: "left" | "right"
  /** HTML 标签类型 */
  tag?: "label" | "span" | "div"
  /** 关联的表单元素 id（仅当 tag="label" 时有效） */
  for?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义宽度 */
  width?: string | number
  /** 文本对齐 */
  align?: "left" | "center" | "right"
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  size: "small",
  variant: "default",
  state: "default",
  iconPosition: "left",
  tag: "label",
  disabled: false,
  align: "left",
})

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
])

const labelStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) {
    style.width =
      typeof props.width === "number" ? `${props.width}px` : props.width
  }
  return style
})

const forAttr = computed(() => (props.tag === "label" ? props.for : undefined))
</script>

<style scoped lang="scss">
@use './styles/Label.scss';
</style>
